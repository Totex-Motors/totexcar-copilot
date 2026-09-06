// Fidelidade — backend MULTI-CLIENTE do cartão fidelidade (motor único da fábrica).
//
// Diferente de `jj-fidelidade` (que é single-tenant, guarda tudo em jj_state id=1 e
// valida uma única chave), esta função atende VÁRIOS clientes isolados por chave:
//   - fidelidade_tenants(tenant, wa_key, active) — registro de quem pode usar
//   - fidelidade_state(tenant, data jsonb)        — o estado (blob) de cada loja
// A chave `k` do app resolve o tenant; cada loja só enxerga o próprio cofre.
// A J.J NÃO usa esta função — continua intacta na jj-fidelidade.
//
// Ações (POST JSON):
//   { action:"state_pull", k, pin }        → estado completo; exige o PIN do admin
//   { action:"state_push", k, pin, data }  → grava o estado (valida PIN + trava de plano)
//   { action:"card_pull",  k, code }        → só o cartão de UM cliente (sem PIN)
//   { action:"send_card",  ... }            → reservado (clientes free usam wa.me no app)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (s: unknown) => String(s || "").replace(/\D/g, "");

// resolve o tenant pela chave da loja (wa_key). null = chave inválida/desligada.
async function resolveTenant(k: string): Promise<string | null> {
  if (!k) return null;
  const { data } = await admin.from("fidelidade_tenants")
    .select("tenant, active").eq("wa_key", k).maybeSingle();
  return data && data.active !== false ? data.tenant : null;
}

const pinRole = (st: any, pin: string): "super" | "operador" | null => {
  if (pin === String(st?.settings?.pin || "")) return "super";
  if (st?.settings?.operadorPin && pin === String(st.settings.operadorPin)) return "operador";
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "use_post" }, 405);

  let p: any = {};
  try { p = await req.json(); } catch { /* corpo vazio */ }

  const tenant = await resolveTenant(String(p.k || ""));
  if (!tenant) return json({ ok: false, error: "chave_invalida" }, 403);

  const loadState = async (): Promise<any | null> => {
    const { data } = await admin.from("fidelidade_state").select("data").eq("tenant", tenant).maybeSingle();
    return (data?.data && typeof data.data === "object" && Array.isArray(data.data.customers)) ? data.data : null;
  };

  // ---------- estado completo (admin) ----------
  if (p.action === "state_pull") {
    const st = await loadState();
    if (st && !pinRole(st, String(p.pin || ""))) return json({ ok: false, error: "pin_invalido" }, 403);
    return json({ ok: true, data: st });
  }

  if (p.action === "state_push") {
    const st = await loadState();
    // bootstrap (loja nova sem estado): quem grava é o dono; com estado, valida o PIN
    const role = st ? pinRole(st, String(p.pin || "")) : "super";
    if (st && !role) return json({ ok: false, error: "pin_invalido" }, 403);
    const data = p.data;
    if (!data || !Array.isArray(data.customers) || !data.settings) return json({ ok: false, error: "dados_invalidos" }, 400);
    if (JSON.stringify(data).length > 2_000_000) return json({ ok: false, error: "dados_grandes" }, 400);
    // operador (balcão) NUNCA altera plano nem PINs — preserva do estado existente
    if (role === "operador" && st) {
      data.settings.pin = st.settings?.pin;
      data.settings.operadorPin = st.settings?.operadorPin;
      data.settings.plan = st.settings?.plan;
    }
    // trava de plano: a base não pode CRESCER além do limite (Essencial 50 / Crescimento 150)
    const PLAN_MAX: Record<string, number> = { essencial: 50, crescimento: 150 };
    const max = PLAN_MAX[String(data.settings.plan || "")] ?? Infinity;
    const oldCount = st ? (st.customers || []).length : 0;
    if (data.customers.length > max && data.customers.length > oldCount) {
      return json({ ok: false, error: "limite_plano", max, plan: data.settings.plan }, 409);
    }
    const { error } = await admin.from("fidelidade_state")
      .upsert({ tenant, data, updated_at: new Date().toISOString() });
    if (error) { console.error("state_push falhou:", tenant, error); return json({ ok: false, error: "falha_ao_salvar" }, 500); }
    return json({ ok: true });
  }

  // ---------- cartão de UM cliente (público, sem PIN) ----------
  if (p.action === "card_pull") {
    const q = String(p.code || "").trim();
    const st = await loadState();
    if (!st || !q) return json({ ok: true, found: false });
    const prefix = String(st.settings?.brand?.prefix || "").toUpperCase();
    const canon = (v: unknown) => { let d = onlyDigits(v); if (d.length > 11 && d.startsWith("55")) d = d.slice(2); return d; };
    const matchPhone = (a: unknown, b: unknown) => {
      const ca = canon(a), cb = canon(b);
      if (ca.length < 8 || cb.length < 8) return false;
      if (ca === cb) return true;
      if (ca.slice(-8) !== cb.slice(-8)) return false;
      const da = ca.length >= 10 ? ca.slice(0, 2) : "", db2 = cb.length >= 10 ? cb.slice(0, 2) : "";
      return !da || !db2 || da === db2;
    };
    const qU = q.toUpperCase();
    const c = (st.customers || []).find((x: any) =>
      String(x.code || "").toUpperCase() === qU ||
      (prefix && String(x.code || "").toUpperCase() === (prefix + "-" + q).toUpperCase()) ||
      matchPhone(x.phone, q));
    if (!c) return json({ ok: true, found: false });
    const s2 = st.settings || {};
    return json({
      ok: true, found: true,
      customer: { code: c.code, name: c.name, stamps: c.stamps | 0, redeemed: c.redeemed | 0 },
      rules: { goal: s2.goal || 10, reward: s2.reward || "", rule: s2.rule || "" },
    });
  }

  // envio automático por API ainda não habilitado nesta função (clientes free usam wa.me no app)
  if (p.action === "send_card") return json({ ok: false, error: "envio_api_nao_configurado" });

  return json({ error: "acao_desconhecida" }, 400);
});
