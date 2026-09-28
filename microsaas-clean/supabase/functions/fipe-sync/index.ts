// TotexCar — FIPE-SYNC: baixa a tabela FIPE (dataset CC0 fipex-labs, via Hugging Face) e popula
// public.fipe_tabela (só carros). Roda no servidor — não trafega 30 mil linhas pelo cliente.
// Vira o refresh MENSAL (cron). Protegido por ?secret=. Deploy verify_jwt=false.
//
// GET /functions/v1/fipe-sync?secret=...&part=N&parts=M   → processa 1 fatia (evita estourar memória).
//   part=0 limpa a tabela antes de inserir; chame part=0..M-1 pra popular tudo (ex.: parts=8).

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";
const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const HF_BASE = "https://huggingface.co/datasets/alanwgt/fipex-veiculos-brasil/resolve/main";

// acha o CSV do MÊS mais recente (o "-latest" é o histórico inteiro, ~1GB — não serve)
async function urlMesAtual(): Promise<string | null> {
  try {
    const r = await fetch("https://huggingface.co/api/datasets/alanwgt/fipex-veiculos-brasil");
    if (!r.ok) return null;
    const j = await r.json();
    const meses = (j.siblings || [])
      .map((s: any) => String(s.rfilename))
      .filter((f: string) => /^\d{4}\/\d{2}\/fipex-prices\.csv$/.test(f))
      .sort();
    const ultimo = meses[meses.length - 1];
    return ultimo ? `${HF_BASE}/${ultimo}` : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });

  // 1) baixa o CSV (TSV) do mês mais recente (~5MB)
  let txt = "";
  try {
    const csvUrl = url.searchParams.get("url") || (await urlMesAtual());
    if (!csvUrl) return new Response(JSON.stringify({ ok: false, error: "sem_arquivo_mes" }), { status: 502, headers: { "content-type": "application/json" } });
    const r = await fetch(csvUrl);
    if (!r.ok) return new Response(JSON.stringify({ ok: false, error: `download ${r.status}` }), { status: 502, headers: { "content-type": "application/json" } });
    txt = await r.text();
  } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 502, headers: { "content-type": "application/json" } }); }

  // 2) parseia (tab-separated) só os CARROS
  const lines = txt.split("\n");
  const head = lines[0].split("\t");
  const idx = (n: string) => head.indexOf(n);
  const iTipo = idx("tipo_veiculo"), iCod = idx("codigo_fipe"), iMod = idx("nome_modelo"), iMar = idx("nome_marca"),
    iComb = idx("nome_combustivel"), iSig = idx("sigla_combustivel"), iAno = idx("ano_modelo"), iZero = idx("zero_km"),
    iVal = idx("valor_centavos"), iMes = idx("mes_referencia"), iAnoRef = idx("ano_referencia");
  const part = Math.max(0, parseInt(url.searchParams.get("part") || "0", 10) || 0);
  const parts = Math.max(1, parseInt(url.searchParams.get("parts") || "8", 10) || 8);

  // só as linhas de CARRO desta fatia (counter de carros % parts === part) → baixa memória
  const rows: any[] = [];
  let carCount = 0;
  for (let k = 1; k < lines.length; k++) {
    const c = lines[k].split("\t");
    if (c[iTipo] !== "carro") continue;
    const idxCar = carCount++;
    if (idxCar % parts !== part) continue;
    const ano = parseInt(c[iAno], 10);
    rows.push({
      codigo_fipe: c[iCod], ano_modelo: Number.isFinite(ano) ? ano : 0,
      nome_modelo: c[iMod], nome_marca: c[iMar],
      nome_combustivel: c[iComb] || null, sigla_combustivel: c[iSig] || null,
      zero_km: c[iZero] === "true",
      valor_centavos: parseInt(c[iVal], 10) || 0,
      ref_mes: parseInt(c[iMes], 10) || null, ref_ano: parseInt(c[iAnoRef], 10) || null,
      marca_norm: norm(c[iMar]), modelo_norm: norm(c[iMod]),
    });
  }

  // part=0 limpa a tabela antes de começar
  if (part === 0) await fetch(`${SB}/rest/v1/fipe_tabela?codigo_fipe=neq.__none__`, { method: "DELETE", headers: H });

  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await fetch(`${SB}/rest/v1/fipe_tabela`, { method: "POST", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify(slice) });
    if (res.ok) inserted += slice.length;
    else console.error("fipe-sync insert:", res.status, (await res.text()).slice(0, 200));
  }
  const ref = rows[0] ? `${rows[0].ref_mes}/${rows[0].ref_ano}` : "?";
  console.log(`fipe-sync part ${part}/${parts}: ${inserted} carros (total carros no arquivo: ${carCount}, ref ${ref})`);
  return new Response(JSON.stringify({ ok: true, part, parts, inseridos: inserted, total_carros_arquivo: carCount, referencia: ref }), { headers: { "content-type": "application/json" } });
});
