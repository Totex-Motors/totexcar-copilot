// TotexCar — "QUANTO VALE MEU CARRO": placa → valor FIPE, com o modelo identificado.
//
// Motor da versão grátis ("aponta, digita a placa, sabe quanto vale"):
//   1) consulta de placa (puxaplaca) → marca / modelo / ano / combustível
//   2) casa com a tabela FIPE LOCAL (public.fipe_tabela, dataset CC0 fipex-labs, atualizada 1x/mês
//      pela função fipe-sync) → uma query só, sem API externa, sem rate limit.
// Devolve SEMPRE o modelo identificado junto do valor (pra pessoa ver se acertou; nunca número solto).
// Cache por placa em valor_cache (não repaga a consulta de placa).
//
// GET /functions/v1/quanto-vale?placa=ABC1D23
// Deploy com verify_jwt=false (a página grátis é pública). Custo protegido pelo cache por placa.

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const brl = (cent: number) => `R$ ${(cent / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function sbGet(path: string): Promise<any> {
  try { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function sbUpsert(table: string, row: unknown): Promise<void> {
  try { await fetch(`${SB}/rest/v1/${table}`, { method: "POST", headers: { ...H, prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row) }); } catch { /* best-effort */ }
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
      const u = cfgUrl || "https://gateway.apibrasil.io/api/v2/vehicles/dados";
      const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${bearer}` };
      if (s[0].placa_api_device) headers["DeviceToken"] = s[0].placa_api_device;
      const r = await fetch(u, { method: "POST", headers, body: JSON.stringify({ placa }) });
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

// marca da placa → termos que aparecem na marca da FIPE (apelidos comuns)
const MARCA_ALIAS: Record<string, string[]> = {
  gm: ["chevrolet"], "general motors": ["chevrolet"], chevrolet: ["chevrolet"],
  vw: ["volkswagen"], volkswagen: ["volkswagen"],
  mmc: ["mitsubishi"], mercedes: ["mercedes"], "mercedes benz": ["mercedes"],
  gwm: ["gwm"], byd: ["byd"], caoa: ["caoa", "chery"], "caoa chery": ["caoa", "chery"], chery: ["chery"],
};

// escolhe a melhor variante por sobreposição de tokens do modelo (+ dica de combustível)
function ranquear(rows: any[], modeloPlaca: string, comb: string | null, anoAlvo: number | null) {
  const toks = norm(modeloPlaca).split(" ").filter((t) => t.length >= 2);
  const combN = norm(comb || "");
  const isHib = /hibrid|phev|hev/.test(combN), isDies = /diesel/.test(combN), isEle = /eletric|ev\b/.test(combN);
  return rows.map((r: any) => {
    const nm = r.modelo_norm || norm(r.nome_modelo);
    let sc = toks.reduce((a, t) => a + (nm.includes(t) ? 1 : 0), 0);
    if (isHib) sc += /hibrid/.test(nm) ? 2 : -1;
    if (isDies && /diesel/.test(nm)) sc += 2;
    if (isEle && /eletric/.test(nm)) sc += 2;
    if (anoAlvo && r.ano_modelo === anoAlvo) sc += 0.5; // desempate: ano exato
    return { r, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version", "access-control-allow-methods": "GET, POST, OPTIONS" } });
  const url = new URL(req.url);
  let placaIn = url.searchParams.get("placa") || "";
  let nocache = url.searchParams.get("nocache");
  if (!placaIn && req.method === "POST") { try { const b = await req.json(); placaIn = String(b?.placa || ""); nocache = nocache || (b?.nocache ? "1" : null); } catch { /* ignore */ } }
  const placa = placaIn.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (placa.length < 7) return json({ ok: false, error: "placa_invalida" }, 400);

  if (!nocache) {
    const c = await sbGet(`valor_cache?placa=eq.${placa}&select=resultado,fetched_at&limit=1`);
    if (c?.[0] && Date.now() - new Date(c[0].fetched_at).getTime() < 20 * 24 * 3600_000) return json({ ...c[0].resultado, cached: true });
  }

  const veh = await consultaPlaca(placa);
  if (!veh?.marca || !veh?.modelo) return json({ ok: false, error: "placa_nao_encontrada", placa }, 404);

  const anoAlvo = veh.ano || veh.ano_fab;
  const out: any = { ok: true, placa, marca: veh.marca, modelo_placa: veh.modelo, ano: anoAlvo, combustivel: veh.combustivel, cor: veh.cor };

  // FIPE local: pega os carros da marca nos anos próximos e ranqueia o modelo
  const alias = MARCA_ALIAS[norm(veh.marca)] || [norm(veh.marca)];
  const anos = [...new Set([anoAlvo, anoAlvo ? anoAlvo - 1 : null, anoAlvo ? anoAlvo + 1 : null].filter(Boolean))] as number[];
  const sel = "select=codigo_fipe,nome_modelo,modelo_norm,nome_combustivel,valor_centavos,ano_modelo,ref_mes,ref_ano";
  let rows: any[] = [];
  for (const a of alias) {
    const anoF = anos.length ? `&ano_modelo=in.(${anos.join(",")})` : "";
    rows = (await sbGet(`fipe_tabela?marca_norm=ilike.*${encodeURIComponent(a)}*${anoF}&${sel}&limit=800`)) || [];
    if (rows.length) break;
  }
  const ranking = ranquear(rows, veh.modelo, veh.combustivel, anoAlvo);
  if (!ranking.length) { out.fipe_erro = "modelo_nao_casou"; out.candidatos = []; }
  else {
    const best = ranking[0].r;
    out.candidatos = ranking.slice(0, 4).map((x) => ({ nome: x.r.nome_modelo, ano: x.r.ano_modelo, valor: brl(x.r.valor_centavos) }));
    out.modelo = best.nome_modelo;
    out.ano = best.ano_modelo;
    out.valor = brl(best.valor_centavos);
    out.valor_num = Math.round(best.valor_centavos / 100);
    out.codigo_fipe = best.codigo_fipe;
    out.ref = best.ref_mes && best.ref_ano ? `${String(best.ref_mes).padStart(2, "0")}/${best.ref_ano}` : null;
  }

  if (out.valor_num > 0) await sbUpsert("valor_cache", { placa, resultado: out, fetched_at: new Date().toISOString() });
  return json(out);
});
