// TotexCar — Integração GPT Motors (consultas veiculares que viram produto no app).
// 3 produtos: raiox (Veicular PRO), crlv (CRLV-e), debitos (Estadual + RENAINF).
//
// Fluxo: autentica em POST {auth_url} com {ChaveAcesso,TokenAcesso} -> Bearer JWT (1h);
// chama a consulta SÍNCRONA (sem webhook) e devolve { dados, analiseIA, controle }.
// Gate de custo: admin/dealer liberados (teste/operação); demais precisam de crédito
// (public.gpt_credits) — sem crédito devolve needsPayment (pagamento fica pra fase 2).
// Cache por placa protege o bolso: raiox 7d, crlv 30d; débitos sempre fresco.
//
// POST /functions/v1/gpt-motors  { produto:"raiox"|"crlv"|"debitos", placa, uf? }
// Deploy com verify_jwt=false; o usuário é identificado pelo Bearer do Supabase no header.

const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const H = { apikey: KEY, authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", ...CORS } });
const normPlaca = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);

const CACHE_DAYS: Record<string, number> = { raiox: 7, crlv: 30, debitos: 0 };
const PRICE_COL: Record<string, string> = { raiox: "gpt_raiox_price", crlv: "gpt_crlv_price", debitos: "gpt_debitos_price" };

async function sbGet(path: string): Promise<any> {
  try { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function sbInsert(table: string, row: unknown): Promise<void> {
  try { await fetch(`${SB}/rest/v1/${table}`, { method: "POST", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify(row) }); } catch { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);

  const body = await req.json().catch(() => ({}));
  const produto = String(body?.produto || "");
  const placa = normPlaca(body?.placa);
  if (!["raiox", "crlv", "debitos"].includes(produto)) return json({ ok: false, error: "produto_invalido" }, 400);
  if (!placa || placa.length < 7) return json({ ok: false, error: "placa_invalida" }, 400);

  // 1) Identifica o usuário pelo Bearer do Supabase
  const authz = req.headers.get("Authorization") || "";
  const ur = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, authorization: authz } });
  const user = ur.ok ? await ur.json().catch(() => null) : null;
  const uid = user?.id as string | undefined;
  if (!uid) return json({ ok: false, error: "nao_autenticado" }, 401);

  // 2) Papel do usuário + config
  const [urow] = (await sbGet(`users?id=eq.${uid}&select=role,dealership&limit=1`)) || [];
  const role = urow?.role || "owner";
  const isPriv = role === "admin" || role === "dealer";
  const [cfg] = (await sbGet(`app_settings?id=eq.1&select=gptmotors_auth_url,gptmotors_chave,gptmotors_token,${PRICE_COL[produto]}&limit=1`)) || [];
  const preco = Number(cfg?.[PRICE_COL[produto]] ?? 0);
  const authUrl = String(cfg?.gptmotors_auth_url || "");
  const chave = String(cfg?.gptmotors_chave || "");
  const token = String(cfg?.gptmotors_token || "");
  if (!authUrl || !chave || !token) return json({ ok: false, error: "integracao_nao_configurada" }, 500);

  // 3) UF (só para CRLV) — do body ou do cadastro do veículo
  let uf = String(body?.uf || "").toUpperCase().slice(0, 2);
  if (produto === "crlv" && !uf) {
    const [acc] = (await sbGet(`accounts?user_id=eq.${uid}&placa=eq.${placa}&select=uf&limit=1`)) || [];
    uf = String(acc?.uf || "").toUpperCase().slice(0, 2);
  }
  if (produto === "crlv" && !uf) return json({ ok: false, error: "uf_obrigatoria" }, 400);

  // 4) Cache por placa (não repaga)
  const cd = CACHE_DAYS[produto] ?? 0;
  if (cd > 0) {
    const since = new Date(Date.now() - cd * 86400000).toISOString();
    const cached = await sbGet(`gpt_consultas?user_id=eq.${uid}&produto=eq.${produto}&placa=eq.${placa}&status=eq.ok&created_at=gte.${since}&order=created_at.desc&limit=1`);
    if (cached?.[0]) {
      const c = cached[0];
      return json({ ok: true, cached: true, produto, placa, dados: c.dados, analiseIA: c.analise_ia, id: c.id, preco });
    }
  }

  // 5) Gate de custo (admin/dealer liberados; demais consomem crédito)
  if (!isPriv) {
    const [cred] = (await sbGet(`gpt_credits?user_id=eq.${uid}&produto=eq.${produto}&select=saldo&limit=1`)) || [];
    const saldo = Number(cred?.saldo || 0);
    if (saldo <= 0) return json({ ok: false, needsPayment: true, produto, preco });
    // debita 1 crédito (best-effort; a consulta só segue se debitou)
    await fetch(`${SB}/rest/v1/gpt_credits?user_id=eq.${uid}&produto=eq.${produto}`, {
      method: "PATCH", headers: { ...H, prefer: "return=minimal" }, body: JSON.stringify({ saldo: saldo - 1, updated_at: new Date().toISOString() }),
    });
  }

  // 6) Autentica na GPT Motors
  const origin = (() => { try { return new URL(authUrl).origin; } catch { return "https://app.gptmotors.com.br"; } })();
  let bearer = "";
  try {
    const ar = await fetch(authUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ChaveAcesso: chave, TokenAcesso: token }) });
    const aj = await ar.json().catch(() => ({}));
    bearer = aj?.accessToken || "";
  } catch { /* */ }
  if (!bearer) return json({ ok: false, error: "auth_provedor_falhou" }, 502);

  const call = async (path: string): Promise<any> => {
    const r = await fetch(`${origin}${path}`, { headers: { authorization: `Bearer ${bearer}`, accept: "application/json" } });
    const j = await r.json().catch(() => ({}));
    return { httpOk: r.ok, status: r.status, j };
  };

  // 7) Executa a consulta do produto
  let dados: any = null, analiseIA: string | null = null, controle: any = null, ok = false, erro: string | null = null;
  try {
    if (produto === "raiox") {
      const { httpOk, j } = await call(`/api/v1/analise/veicular/pro?placa=${placa}`);
      dados = j?.dados ?? null; analiseIA = j?.analiseIA ?? null; controle = j?.controle ?? null;
      ok = httpOk && (controle?.sucesso ?? true) && !!dados;
      if (!ok) erro = controle?.mensagem || "consulta_sem_retorno";
    } else if (produto === "crlv") {
      const { httpOk, j } = await call(`/api/v1/documentacao/crlv?uf=${uf}&placa=${placa}`);
      dados = j?.dados ?? null; analiseIA = j?.analiseIA ?? null; controle = j?.controle ?? null;
      ok = httpOk && (controle?.sucesso ?? true) && !!dados;
      if (!ok) erro = controle?.mensagem || "crlv_indisponivel";
    } else { // debitos = estadual + renainf
      const est = await call(`/api/v1/identificacao/estadual?placa=${placa}`);
      const ren = await call(`/api/v1/analise/risco/renainf?placa=${placa}`);
      dados = { estadual: est.j?.dados ?? null, renainf: ren.j?.dados ?? null };
      analiseIA = est.j?.analiseIA || ren.j?.analiseIA || null;
      controle = est.j?.controle ?? ren.j?.controle ?? null;
      ok = (est.httpOk || ren.httpOk) && (dados.estadual || dados.renainf);
      if (!ok) erro = est.j?.controle?.mensagem || ren.j?.controle?.mensagem || "debitos_indisponivel";
    }
  } catch (e) {
    erro = String((e as any)?.message || e);
  }

  // 8) Grava histórico
  const id = crypto.randomUUID();
  await sbInsert("gpt_consultas", {
    id, user_id: uid, produto, placa, uf: uf || null,
    status: ok ? "ok" : "erro", gpt_id: controle?.id || null, faturado: !!controle?.faturado,
    preco, dados: ok ? dados : null, analise_ia: analiseIA, erro: ok ? null : erro,
  });

  if (!ok) return json({ ok: false, error: erro || "falha", produto, preco }, 502);
  return json({ ok: true, produto, placa, uf: uf || null, dados, analiseIA, id, preco });
});
