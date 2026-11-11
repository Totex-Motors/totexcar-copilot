// TotexCar — EXCLUSÃO DOS DADOS DO CLIENTE (LGPD, art. 18), pedida pelo próprio cliente em Configurações.
// POST { acao: "resumo" }                         → o que existe hoje na conta (pra mostrar antes de excluir)
// POST { acao: "excluir", confirmacao: "EXCLUIR" } → apaga a conta e os dados do app, de vez
//
// APAGA: carro(s), gastos, km, lembretes, calendário, financiamentos, multas, documentos do ArquivoZap
// (fichas + arquivos), CNH, relatórios e laudos, conversas e memória do Co-pilot, radar, consultas,
// pedidos de orçamento, viagens, avisos de valor, fidelidade, login.
// MANTÉM (sem ligação com a conta): registros da COMPRA na loja parceira (jornada de pós-venda, etiqueta,
// checklist de entrega, atendimentos e pedidos de recompra: são da loja, por garantia e transferência) e os
// PAGAMENTOS (obrigação legal/fiscal). Conta de loja (dealer) ou admin não se exclui por aqui.
// Auth: access token do usuário (deploy com --no-verify-jwt, como as outras).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info", "access-control-allow-methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });

// telefone nas grafias que o sistema usa (com/sem 55, com/sem o 9)
function variantesTel(s: unknown): string[] {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || d.length < 12) return d ? [d] : [];
  const ddd = d.slice(2, 4), resto = d.slice(4);
  const sem9 = resto.length === 9 && resto.startsWith("9") ? resto.slice(1) : resto;
  return [...new Set([`55${ddd}${sem9}`, `55${ddd}9${sem9}`, `${ddd}${sem9}`, `${ddd}9${sem9}`])];
}

// tabelas do app apagadas por coluna (a que não existir no banco é ignorada)
const POR_USUARIO: [string, string][] = [
  ["transactions", "user_id"], ["car_calendar", "user_id"], ["care_score_events", "user_id"], ["odometro_leituras", "user_id"],
  ["km_pedidos", "user_id"], ["maintenance_reminders", "user_id"], ["financiamentos", "user_id"], ["fiscal_reports", "user_id"],
  ["multas", "user_id"], ["user_memory", "user_id"], ["open_loops", "user_id"], ["notification_log", "user_id"], ["car_radar", "user_id"],
  ["vehicle_queries", "user_id"], ["viagem_planos", "user_id"], ["driver_provider_actions", "user_id"], ["provider_quote_requests", "user_id"],
  ["service_searches", "user_id"], ["access_links", "user_id"], ["roleta_giros", "user_id"], ["support_tickets", "user_id"],
  ["gpt_consultas", "user_id"], ["arquivozap_docs", "user_id"], ["whatsapp_events", "user_id"], ["pedagios", "user_id"],
];
const POR_TELEFONE: [string, string][] = [
  ["whatsapp_events", "from_phone"], ["arquivozap_docs", "phone"], ["valor_vivo_subs", "phone"], ["jj_state", "from_phone"], ["fidelidade_state", "from_phone"],
];
// registros da LOJA: ficam, mas desligados da conta
const DESLIGAR: [string, Record<string, null>, string][] = [
  ["postsale_journeys", { user_id: null }, "user_id"], ["posvenda_casos", { user_id: null }, "user_id"],
  ["car_tags", { user_id: null, account_id: null }, "user_id"], ["entrega_checklists", { user_id: null, account_id: null }, "user_id"],
  ["buyback_requests", { owner_id: null }, "owner_id"], ["referral_events", { owner_id: null }, "owner_id"],
  ["gpt_orders", { user_id: null }, "user_id"], // pagamento fica (fiscal), sem apontar pra conta
];
const naoExiste = (e: any) => /does not exist|schema cache|relation|column/i.test(String(e?.message || ""));

async function contar(tabela: string, col: string, valores: string[]): Promise<number> {
  if (!valores.length) return 0;
  const { count, error } = await admin.from(tabela).select("*", { count: "exact", head: true }).in(col, valores);
  return error ? 0 : count || 0;
}
// arquivos de uma "pasta" do Storage (um nível, até 1000)
async function listarPasta(bucket: string, prefixo: string): Promise<string[]> {
  const { data } = await admin.storage.from(bucket).list(prefixo, { limit: 1000 });
  return (data || []).filter((o: any) => o.id).map((o: any) => `${prefixo}/${o.name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: au } = await admin.auth.getUser(token);
  const uid = au?.user?.id;
  if (!uid) return json({ ok: false, error: "nao_autenticado" }, 401);
  const { data: u } = await admin.from("users").select("id, name, phone, role, plan, plan_expires_at").eq("id", uid).maybeSingle();
  if (u?.role === "dealer" || u?.role === "admin") return json({ ok: false, error: "conta_de_loja" }, 403);
  const tels = variantesTel(u?.phone);
  const { data: contas } = await admin.from("accounts").select("id, placa, foto_url, foto_fonte").eq("user_id", uid);
  const accIds = (contas || []).map((c: any) => c.id);
  const body = await req.json().catch(() => ({}));

  if (body?.acao === "resumo") {
    const [gastos, docs, conversas, km, lembretes] = await Promise.all([
      contar("transactions", "user_id", [uid]),
      contar("arquivozap_docs", "phone", tels).then(async (n) => n || contar("arquivozap_docs", "user_id", [uid])),
      contar("whatsapp_events", "from_phone", tels),
      contar("odometro_leituras", "user_id", [uid]),
      contar("maintenance_reminders", "user_id", [uid]),
    ]);
    const premium = u?.plan === "premium" && u?.plan_expires_at && new Date(u.plan_expires_at) > new Date();
    return json({ ok: true, carros: accIds.length, gastos, documentos: docs, conversas, leituras_km: km, lembretes, premium_ate: premium ? u!.plan_expires_at : null });
  }

  if (body?.acao !== "excluir") return json({ ok: false, error: "acao_invalida" }, 400);
  if (String(body?.confirmacao || "").trim().toUpperCase() !== "EXCLUIR") return json({ ok: false, error: "confirmacao" }, 400);

  const rel: Record<string, number | string> = {};
  const falhas: string[] = [];
  // 1) arquivos: documentos/CNH (fichas guardam o caminho), pastas do cliente, relatórios, laudos, foto do carro enviada por ele
  try {
    const fichas: string[] = [];
    for (const [col, vals] of [["user_id", [uid]], ["phone", tels]] as [string, string[]][]) {
      if (!vals.length) continue;
      const { data } = await admin.from("arquivozap_docs").select("storage_path").in(col, vals);
      for (const d of data || []) if (d.storage_path) fichas.push(d.storage_path);
    }
    const pastasZap = (await Promise.all([...tels, uid].map((p) => listarPasta("arquivozap", p)))).flat();
    const zap = [...new Set([...fichas, ...pastasZap])].filter((p) => !p.startsWith("entrega/")); // foto da entrega é registro da loja
    if (zap.length) await admin.storage.from("arquivozap").remove(zap);
    const rep = [...await listarPasta("reports", uid), ...await listarPasta("reports", `laudos/${uid}`)];
    if (rep.length) await admin.storage.from("reports").remove(rep);
    const fotos = (contas || []).filter((c: any) => c.foto_url && c.foto_fonte !== "estoque") // a do estoque é a mesma da loja
      .map((c: any) => String(c.foto_url).split("/storage/v1/object/public/car-photos/")[1]).filter(Boolean);
    if (fotos.length) await admin.storage.from("car-photos").remove(fotos);
    rel.arquivos = zap.length + rep.length + fotos.length;
  } catch (e) { falhas.push(`arquivos: ${String((e as any)?.message || e)}`); }

  // 2) registros da loja e pagamentos: ficam, desligados da conta (se não der, só avisa no log; o que
  //    realmente travar a exclusão aparece no passo 4)
  const avisos: string[] = [];
  for (const [t, upd, col] of DESLIGAR) {
    const { error } = await admin.from(t).update(upd).eq(col, uid);
    if (error && !naoExiste(error)) avisos.push(`${t}: ${error.message}`);
  }
  if (accIds.length) for (const t of ["car_tags", "entrega_checklists", "postsale_journeys", "posvenda_casos", "buyback_requests"]) {
    const { error } = await admin.from(t).update({ account_id: null }).in("account_id", accIds);
    if (error && !naoExiste(error)) avisos.push(`${t}.account_id: ${error.message}`);
  }

  // 3) dados do app
  const apagar = async (t: string, col: string, vals: string[]) => {
    if (!vals.length) return;
    const { error, count } = await admin.from(t).delete({ count: "exact" }).in(col, vals);
    if (error) { if (!naoExiste(error)) falhas.push(`${t}: ${error.message}`); return; }
    rel[t] = Number(rel[t] || 0) + (count || 0);
  };
  for (const [t, col] of POR_USUARIO) await apagar(t, col, [uid]);
  for (const [t, col] of POR_TELEFONE) await apagar(t, col, tels);
  if (accIds.length) for (const t of ["transactions", "car_calendar", "odometro_leituras", "km_pedidos", "maintenance_reminders", "care_score_events"]) await apagar(t, "account_id", accIds);
  const placas = (contas || []).map((c: any) => String(c.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "")).filter((p: string) => p.length >= 7);
  await apagar("valor_cache", "placa", placas);
  await apagar("accounts", "user_id", [uid]);

  // 4) a conta e o login
  const { error: eu } = await admin.from("users").delete().eq("id", uid);
  if (eu) falhas.push(`users: ${eu.message}`);
  else {
    const { error: ea } = await admin.auth.admin.deleteUser(uid);
    if (ea) falhas.push(`login: ${ea.message}`);
  }
  console.log("minha-conta excluir", uid, JSON.stringify(rel), avisos.length ? `avisos: ${avisos.join(" | ")}` : "", falhas.length ? `falhas: ${falhas.join(" | ")}` : "ok");
  if (falhas.length) return json({ ok: false, error: "exclusao_parcial", apagados: rel, falhas }, 500);
  return json({ ok: true, apagados: rel });
});
