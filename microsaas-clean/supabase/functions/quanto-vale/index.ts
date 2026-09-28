// TotexCar — "QUANTO VALE MEU CARRO": placa → valor FIPE, com o modelo identificado.
//
// É o motor da versão grátis ("aponta, digita a placa, sabe quanto vale"). Encadeia:
//   1) consulta de placa (puxaplaca) → marca / modelo / ano / combustível
//   2) casa com a tabela FIPE pública (parallelum) → valor + variante escolhida + candidatos
// Devolve SEMPRE o modelo identificado junto do valor (pra pessoa ver se acertou; nunca número solto).
// Cache: valor_cache por placa (não repaga a consulta) + fipe_cache (respeita o rate limit da FIPE).
//
// GET /functions/v1/quanto-vale?placa=ABC1D23   → { ok, placa, marca, modelo, ano, combustivel,
//                                                    valor, valor_num, codigo_fipe, ref, candidatos[] }
// Deploy com verify_jwt=false (a página grátis é pública). Custo protegido pelo cache por placa.

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const parseBRL = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

async function sbGet(path: string): Promise<any> {
  try { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function sbUpsert(table: string, row: unknown): Promise<void> {
  try { await fetch(`${SB}/rest/v1/${table}`, { method: "POST", headers: { ...H, prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) }); } catch { /* cache é best-effort */ }
}

// FIPE com cache (parallelum tem rate limit 429 agressivo)
const FIPE_TTL = 7 * 24 * 3600_000;
async function fipeGet(path: string): Promise<any> {
  const hit = await sbGet(`fipe_cache?path=eq.${encodeURIComponent(path)}&select=payload,fetched_at&limit=1`);
  if (hit?.[0] && Date.now() - new Date(hit[0].fetched_at).getTime() < FIPE_TTL) return hit[0].payload;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${FIPE}${path}`);
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 500 * (i + 1))); continue; }
    if (!r.ok) throw new Error(`FIPE ${r.status}`);
    const j = await r.json();
    await sbUpsert("fipe_cache", { path, payload: j, fetched_at: new Date().toISOString() });
    return j;
  }
  throw new Error("FIPE indisponível");
}

// consulta de placa (puxaplaca) — token no app_settings
async function consultaPlaca(placa: string): Promise<any | null> {
  const s = await sbGet("app_settings?id=eq.1&select=placa_api_url,placa_api_bearer,placa_api_device&limit=1");
  const bearer = s?.[0]?.placa_api_bearer || "";
  if (!bearer) return null;
  const cfgUrl = String(s?.[0]?.placa_api_url || "");
  try {
    let data: any = {};
    if (/apibrasil|gateway/i.test(cfgUrl)) {
      const url = cfgUrl || "https://gateway.apibrasil.io/api/v2/vehicles/dados";
      const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${bearer}` };
      if (s[0].placa_api_device) headers["DeviceToken"] = s[0].placa_api_device;
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ placa }) });
      if (!r.ok) return null; data = await r.json().catch(() => ({}));
    } else {
      const base = (/puxaplaca/i.test(cfgUrl) ? cfgUrl : "https://api.puxaplaca.app").replace(/\/+$/, "");
      const r = await fetch(`${base}/v2/consulta/${encodeURIComponent(placa)}`, { headers: { token: bearer, Accept: "application/json" } });
      if (!r.ok) return null; data = await r.json().catch(() => ({}));
    }
    const d = data?.basico?.dados || data?.dados || data?.response || data;
    const pick = (...ks: string[]) => { for (const k of ks) if (d?.[k] != null && String(d[k]).trim()) return String(d[k]).trim(); return null; };
    const toInt = (v: string | null) => { const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };
    return {
      marca: pick("marca", "fabricante"),
      modelo: pick("modelo", "submodelo", "marcamodelo"),
      ano: toInt(pick("anoModelo", "anomodelo", "ano")),
      ano_fab: toInt(pick("ano", "anoFabricacao", "anofabricacao")),
      combustivel: pick("combustivel", "tipoCombustivel"),
      cor: pick("cor"),
    };
  } catch { return null; }
}

// marca da placa → marca na FIPE (apelidos comuns)
const MARCA_ALIAS: Record<string, string[]> = {
  gm: ["chevrolet"], "general motors": ["chevrolet"], chevrolet: ["chevrolet"],
  vw: ["volkswagen"], volkswagen: ["volkswagen"],
  mmc: ["mitsubishi"], mercedes: ["mercedes"], "mercedes benz": ["mercedes"],
  gwm: ["gwm", "great wall"], byd: ["byd"], caoa: ["caoa", "chery"], "caoa chery": ["chery", "caoa"],
  citroen: ["citroen"], vitara: ["suzuki"],
};

// escolhe a melhor variante do modelo na FIPE por sobreposição de tokens (+ combustível)
function escolheModelo(modelos: any[], modeloPlaca: string, comb: string | null) {
  const toks = norm(modeloPlaca).split(" ").filter((t) => t.length >= 2);
  const combN = norm(comb || "");
  const isHib = /hibrid|phev|hev/.test(combN), isDies = /diesel/.test(combN), isEle = /eletric|ev\b/.test(combN);
  const scored = modelos.map((m: any) => {
    const nm = norm(m.nome);
    let sc = toks.reduce((a, t) => a + (nm.includes(t) ? 1 : 0), 0);
    if (isHib && /hibrid/.test(nm)) sc += 2; else if (isHib && !/hibrid/.test(nm)) sc -= 1;
    if (isDies && /diesel/.test(nm)) sc += 2;
    if (isEle && /eletric/.test(nm)) sc += 2;
    return { m, sc };
  }).sort((a, b) => b.sc - a.sc);
  return scored.filter((x) => x.sc > 0);
}

// ano da placa → código de ano na FIPE (ex.: 2027-6). fallback: mais novo real (ignora 32000=0km se houver ano)
function escolheAno(anos: any[], anoPlaca: number | null) {
  if (anoPlaca) { const exato = anos.find((a: any) => String(a.nome).trim().startsWith(String(anoPlaca))); if (exato) return exato; }
  const reais = anos.filter((a: any) => !String(a.codigo).startsWith("32000"));
  return reais[0] || anos[0] || null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const placa = (url.searchParams.get("placa") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (placa.length < 7) return json({ ok: false, error: "placa_invalida" }, 400);

  // cache por placa (não repaga a consulta; FIPE atualiza no mês, plate é estático)
  if (!url.searchParams.get("nocache")) {
    const c = await sbGet(`valor_cache?placa=eq.${placa}&select=resultado,fetched_at&limit=1`);
    if (c?.[0] && Date.now() - new Date(c[0].fetched_at).getTime() < 7 * 24 * 3600_000) {
      return json({ ...c[0].resultado, cached: true });
    }
  }

  const veh = await consultaPlaca(placa);
  if (!veh?.marca || !veh?.modelo) return json({ ok: false, error: "placa_nao_encontrada", placa }, 404);

  let out: any = { ok: true, placa, marca: veh.marca, modelo_placa: veh.modelo, ano: veh.ano || veh.ano_fab, combustivel: veh.combustivel, cor: veh.cor };
  try {
    // 1) marca — exato primeiro (GWM != GREAT WALL), depois apelidos, por fim contém
    const marcas = await fipeGet("/marcas");
    const vmarca = norm(veh.marca);
    const alias = MARCA_ALIAS[vmarca] || [vmarca];
    const marcaHit = marcas.find((m: any) => norm(m.nome) === vmarca)
      || marcas.find((m: any) => alias.some((a) => norm(m.nome) === a))
      || marcas.find((m: any) => alias.some((a) => norm(m.nome).includes(a)))
      || marcas.find((m: any) => norm(m.nome).includes(vmarca.split(" ")[0]));
    if (!marcaHit) { out.fipe_erro = "marca_nao_na_fipe"; }
    else {
      // 2) modelo
      const modResp = await fipeGet(`/marcas/${marcaHit.codigo}/modelos`);
      const modelos = Array.isArray(modResp?.modelos) ? modResp.modelos : modResp;
      const ranking = escolheModelo(modelos, veh.modelo, veh.combustivel);
      if (!ranking.length) { out.fipe_erro = "modelo_nao_casou"; out.candidatos = []; }
      else {
        const best = ranking[0].m;
        out.candidatos = ranking.slice(0, 4).map((x) => ({ codigo: x.m.codigo, nome: x.m.nome }));
        // 3) ano
        const anos = await fipeGet(`/marcas/${marcaHit.codigo}/modelos/${best.codigo}/anos`);
        const anoHit = escolheAno(anos, out.ano);
        if (anoHit) {
          const p = await fipeGet(`/marcas/${marcaHit.codigo}/modelos/${best.codigo}/anos/${anoHit.codigo}`);
          out.modelo = p?.Modelo || best.nome;
          out.ano = parseInt(String(p?.AnoModelo || out.ano), 10) || out.ano;
          out.valor = p?.Valor || null;
          out.valor_num = parseBRL(p?.Valor);
          out.codigo_fipe = p?.CodigoFipe || null;
          out.ref = p?.MesReferencia || null;
        }
      }
    }
  } catch (e) { out.fipe_erro = String(e).slice(0, 120); }

  if (out.valor_num > 0) await sbUpsert("valor_cache", { placa, resultado: out, fetched_at: new Date().toISOString() });
  return json(out);
});
