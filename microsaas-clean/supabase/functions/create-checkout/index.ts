// TotexCar Co-pilot — Checkout de assinatura no Asaas (PIX + cartão) com cupom (Bônus Totex)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let payload: any = {};
  try { payload = await req.json(); } catch { /* */ }
  const plan: "monthly" | "annual" = payload.plan === "annual" ? "annual" : "monthly";
  const couponCode = String(payload.coupon || "").trim();
  const preview = payload.preview === true;

  const proRequested = payload.pro === true; // TotexCar Co-pilot PRO (motorista de app, sem loja)

  const { data: s } = await admin.from("app_settings").select("*").eq("id", 1).single();

  // valida o cupom (Bônus Totex)
  let discountPct = 0;
  let coupon: any = null;
  let couponError: string | null = null;
  if (couponCode) {
    const { data: c } = await admin.from("coupons").select("*").ilike("code", couponCode).limit(1);
    const cp = c?.[0];
    if (!cp) couponError = "cupom_invalido";
    else if (!cp.active) couponError = "cupom_inativo";
    else if (cp.max_uses != null && Number(cp.used_count) >= Number(cp.max_uses)) couponError = "cupom_esgotado";
    else { discountPct = Number(cp.discount_pct) || 0; coupon = cp; }
  }

  // Cupom de loja SEMPRE vence: membro do ecossistema já leva o Modo PRO incluso no preço de membro.
  const isPro = proRequested && !coupon;
  const fullValue = isPro
    ? (plan === "annual" ? Number(s?.pro_annual_price ?? 299) : Number(s?.pro_monthly_price ?? 29.9))
    : (plan === "annual" ? Number(s?.plan_annual_price ?? 1099) : Number(s?.plan_monthly_price ?? 109.9));
  const planName = isPro ? "TotexCar Co-pilot PRO" : (s?.plan_name || "Totex Care");

  const value = round2(fullValue * (1 - discountPct / 100));

  if (preview) {
    return json({ ok: true, plan, pro: isPro, full: fullValue, value, discount_pct: discountPct, coupon_valid: !!coupon, coupon_error: couponError, dealership: coupon?.dealership || null, plan_name: planName });
  }

  // checkout real exige autenticação (o preview acima é público, só calcula preço)
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const user = ud.user;

  if (couponCode && couponError) return json({ error: couponError }, 400);

  const apiKey = s?.asaas_api_key;
  if (!apiKey) return json({ error: "asaas_nao_configurado" }, 400);
  const base = s?.asaas_sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  const appUrl = (s?.app_url || "").replace(/\/+$/, "") || `${SUPABASE_URL}`;
  const cycle = plan === "annual" ? "YEARLY" : "MONTHLY";
  const name = `${planName} ${plan === "annual" ? "Anual" : "Mensal"}`.slice(0, 30);

  const { data: profile } = await admin.from("users").select("name, email, phone").eq("id", user.id).single();
  const today = new Date().toISOString().split("T")[0];

  const body = {
    billingTypes: ["CREDIT_CARD", "PIX"],
    chargeTypes: ["RECURRENT"],
    minutesToExpire: 60,
    callback: { successUrl: `${appUrl}/plans?status=success`, cancelUrl: `${appUrl}/plans?status=cancel` },
    items: [{ name, description: `Assinatura ${planName}`, quantity: 1, value, imageBase64: PIXEL }],
    subscription: { cycle, nextDueDate: today },
    customerData: { name: profile?.name || user.email, email: profile?.email || user.email, phone: profile?.phone || undefined },
    externalReference: user.id,
  };

  try {
    // registra ciclo/valor da assinatura (MRR) e a origem (loja/cupom) no perfil
    const profileUpdate: Record<string, unknown> = { plan_cycle: plan, plan_value: value };
    if (coupon) { profileUpdate.coupon_code = coupon.code; profileUpdate.dealership = coupon.dealership; }
    if (proRequested) profileUpdate.driver_mode = true; // motorista de app (PRO direto ou membro c/ PRO incluso)
    await admin.from("users").update(profileUpdate).eq("id", user.id);
    const res = await fetch(`${base}/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Asaas checkout erro:", res.status, JSON.stringify(data));
      return json({ error: data?.errors?.[0]?.description || `Asaas ${res.status}`, detail: data }, 400);
    }
    const url = data.link || data.url || (data.id ? `${base.replace("/v3", "")}/checkoutSession/show/${data.id}` : null);
    return json({ ok: true, url, id: data.id, value });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
