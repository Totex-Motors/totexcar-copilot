// TotexCar — Integração GPT Motors (consulta on-demand a partir do app).
// Gate de custo: admin/dealer liberados; demais recebem needsPayment (pagamento via gpt-checkout).
// Produtos por placa (raiox/crlv/debitos) e por CPF (cnh). Cache + histórico em gpt_consultas.
// POST /functions/v1/gpt-motors { produto, placa?, cpf?, uf? } — usuário pelo Bearer do Supabase.
import { runGptMotors, PRICE_COL, CACHE_DAYS, IS_CPF, normPlaca, normCpf, type GptProduto } from "../_shared/gptmotors.ts";

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...CORS } });

async function sbGet(path: string): Promise<any> {
  try { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function sbInsert(table: string, row: unknown): Promise<void> {
  try { await fetch(`${SB}/rest/v1/${table}`, { method: "POST", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify(row) }); } catch { /* */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const body = await req.json().catch(() => ({}));
  const produto = String(body?.produto || "") as GptProduto;
  if (!["raiox", "crlv", "debitos", "cnh"].includes(produto)) return json({ ok: false, error: "produto_invalido" }, 400);

  const isCpf = IS_CPF[produto];
  const placa = normPlaca(body?.placa);
  const cpf = normCpf(body?.cpf);
  const ident = isCpf ? cpf : placa;                       // identificador passado ao provedor
  if (isCpf && cpf.length !== 11) return json({ ok: false, error: "cpf_invalido" }, 400);
  if (!isCpf && (!placa || placa.length < 7)) return json({ ok: false, error: "placa_invalida" }, 400);

  const authz = req.headers.get("Authorization") || "";
  const ur = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, authorization: authz } });
  const user = ur.ok ? await ur.json().catch(() => null) : null;
  const uid = user?.id as string | undefined;
  if (!uid) return json({ ok: false, error: "nao_autenticado" }, 401);

  const urows = (await sbGet(`users?id=eq.${uid}&select=role&limit=1`)) || [];
  const role = urows[0]?.role || "owner";
  const isPriv = role === "admin" || role === "dealer";
  const cfgs = (await sbGet(`app_settings?id=eq.1&select=gptmotors_auth_url,gptmotors_chave,gptmotors_token,${PRICE_COL[produto]}&limit=1`)) || [];
  const cfg = cfgs[0] || {};
  const preco = Number(cfg[PRICE_COL[produto]] ?? 0);

  let uf = String(body?.uf || "").toUpperCase().slice(0, 2);
  if (produto === "crlv" && !uf) {
    const accs = (await sbGet(`accounts?user_id=eq.${uid}&placa=eq.${placa}&select=uf&limit=1`)) || [];
    uf = String(accs[0]?.uf || "").toUpperCase().slice(0, 2);
  }
  if (produto === "crlv" && !uf) return json({ ok: false, error: "uf_obrigatoria" }, 400);

  // cache (não repaga) — por placa ou por cpf conforme o produto
  const cd = CACHE_DAYS[produto] ?? 0;
  if (cd > 0) {
    const since = new Date(Date.now() - cd * 86400000).toISOString();
    const key = isCpf ? `cpf=eq.${cpf}` : `placa=eq.${placa}`;
    const cached = await sbGet(`gpt_consultas?user_id=eq.${uid}&produto=eq.${produto}&${key}&status=eq.ok&created_at=gte.${since}&order=created_at.desc&limit=1`);
    if (cached?.[0]) { const c = cached[0]; return json({ ok: true, cached: true, produto, placa: c.placa, cpf: c.cpf, dados: c.dados, analiseIA: c.analise_ia, id: c.id, preco }); }
  }

  // gate de custo: admin/dealer liberados; demais pagam (gpt-checkout)
  if (!isPriv) return json({ ok: false, needsPayment: true, produto, preco });

  const t0 = Date.now();
  const out = await runGptMotors({ authUrl: String(cfg.gptmotors_auth_url || ""), chave: String(cfg.gptmotors_chave || ""), token: String(cfg.gptmotors_token || "") }, produto, ident, uf);
  const duration_ms = Date.now() - t0;
  if (!out.ok) console.warn(`gpt-motors ${produto} falhou em ${duration_ms}ms: ${out.erro}`);
  const id = crypto.randomUUID();
  await sbInsert("gpt_consultas", {
    id, user_id: uid, produto, placa: isCpf ? null : placa, cpf: isCpf ? cpf : null, uf: uf || null, status: out.ok ? "ok" : "erro",
    gpt_id: out.controle?.id || null, faturado: !!out.controle?.faturado, preco,
    dados: out.ok ? out.dados : null, analise_ia: out.analiseIA, erro: out.ok ? null : out.erro, duration_ms,
  });
  if (!out.ok) return json({ ok: false, error: out.erro || "falha", produto, preco }, 502);
  return json({ ok: true, produto, placa: isCpf ? null : placa, cpf: isCpf ? cpf : null, uf: uf || null, dados: out.dados, analiseIA: out.analiseIA, id, preco });
});
