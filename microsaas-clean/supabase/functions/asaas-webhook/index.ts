// TotexCar Co-pilot — Webhook do Asaas: ativa/desativa assinatura, conta cupom e notifica o Totexmotors OS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || "");

const ACTIVATE = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "CHECKOUT_PAID"]);
const DEACTIVATE = new Set([
  "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE",
  "SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED",
]);

// Notifica o Totexmotors OS (eventos do ecossistema) — assinado com a integration_api_key
async function notifyOS(osUrl: string, apiKey: string, eventType: string, data: Record<string, unknown>) {
  if (!osUrl) return;
  try {
    await fetch(osUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey || "" },
      body: JSON.stringify({ source: "totex_car_finance", event: eventType, data }),
    });
  } catch (e) {
    console.error("notifyOS falhou:", e);
  }
}

Deno.serve(async (req) => {
  const { data: s } = await admin.from("app_settings")
    .select("asaas_webhook_token, os_webhook_url, integration_api_key").eq("id", 1).single();
  const expected = s?.asaas_webhook_token || "";
  const url = new URL(req.url);
  const provided = req.headers.get("asaas-access-token") || url.searchParams.get("token") || "";
  if (expected && provided !== expected) return new Response("unauthorized", { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }

  const event = body?.event || "";
  const payment = body?.payment || {};
  const checkout = body?.checkout || {};
  const userId = payment.externalReference || checkout.externalReference || "";
  const value = payment.value ?? checkout.value;

  try {
    if (!isUuid(userId)) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { "Content-Type": "application/json" } });
    }

    if (ACTIVATE.has(event)) {
      // Cobrança AVULSA (sem auto-renovar): o acesso vale 1 período a partir de agora.
      // A renovação é puxada pelo paywall + lembretes (car-expiration-alerts).
      const { data: pre } = await admin.from("users").select("plan_cycle").eq("id", userId).single();
      const annual = pre?.plan_cycle === "annual";
      const exp = new Date();
      if (annual) exp.setFullYear(exp.getFullYear() + 1); else exp.setMonth(exp.getMonth() + 1);

      await admin.from("users").update({
        plan: "premium",
        subscription_status: "active",
        plan_expires_at: exp.toISOString(),
      }).eq("id", userId);

      const { data: u } = await admin.from("users")
        .select("name, email, phone, coupon_code, dealership").eq("id", userId).single();

      // conta a conversão do cupom apenas na 1ª cobrança (CHECKOUT_PAID)
      if (event === "CHECKOUT_PAID" && u?.coupon_code) {
        const { data: c } = await admin.from("coupons").select("id, used_count").ilike("code", u.coupon_code).limit(1);
        if (c?.[0]) await admin.from("coupons").update({ used_count: Number(c[0].used_count || 0) + 1 }).eq("id", c[0].id);
      }

      await notifyOS(s?.os_webhook_url || "", s?.integration_api_key || "", "subscription.activated", {
        user_id: userId, name: u?.name, email: u?.email, phone: u?.phone,
        plan: "premium", value, coupon_code: u?.coupon_code, dealership: u?.dealership,
      });
    } else if (DEACTIVATE.has(event)) {
      const status = event.startsWith("SUBSCRIPTION") ? "canceled" : "overdue";
      await admin.from("users").update({ plan: "free", subscription_status: status }).eq("id", userId);
      const { data: u } = await admin.from("users").select("name, email, dealership, coupon_code").eq("id", userId).single();
      await notifyOS(s?.os_webhook_url || "", s?.integration_api_key || "", "subscription.deactivated", {
        user_id: userId, name: u?.name, email: u?.email, status, dealership: u?.dealership, coupon_code: u?.coupon_code,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro asaas-webhook:", e);
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});
