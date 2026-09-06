// Cartão Fidelidade (produto por Totex) — Checkout PÚBLICO de assinatura no Asaas
// (PIX + cartão), pra página de vendas https://totexfidelidade.vercel.app.
//
// É público (sem login): a página de vendas não tem conta/usuário — quem clica é um
// LEAD (dono de comércio). O Asaas coleta CPF/CNPJ e dados na própria tela de checkout
// (não enviamos customerData). Reaproveita a MESMA chave do Asaas do Co-pilot
// (app_settings.asaas_api_key / asaas_sandbox).
//
// A cobrança é AVULSA (chargeTypes DETACHED): PIX no Asaas só aceita avulso; o cliente
// paga o 1º período e a renovação é conversada. O fulfillment é manual: o pagamento cai
// no Asaas com externalReference "fidelidade:<plano>:<ciclo>" e o time ativa o cartão da
// loja. O webhook do Co-pilot (asaas-webhook) IGNORA essa referência (não é UUID nem
// "vq:"), então nada do Co-pilot é afetado.
//
// POST JSON: { plan: "essencial"|"crescimento"|"ilimitado", cycle?: "monthly"|"annual", tenant?: "jj"|"brasa" }
//   → { ok:true, url } (link do checkout Asaas) | { ok:false, error }
// tenant define os PREÇOS e identifica a loja no externalReference (o fulfillment é manual).
// Sem tenant = "jj" (comportamento legado da J.J, inalterado).
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

// pixel 1x1 transparente (o Asaas exige imageBase64 nos itens)
const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const SITE = "https://totexfidelidade.vercel.app";

// preços da página POR LOJA (anual = 2 meses grátis = mensal × 10)
type Plan = { name: string; monthly: number; annual: number };
const TENANTS: Record<string, { label: string; plans: Record<string, Plan> }> = {
  // J.J Espetos — preços legados (inalterados)
  jj: {
    label: "",
    plans: {
      essencial:   { name: "Essencial",   monthly: 59,  annual: 590 },
      crescimento: { name: "Crescimento", monthly: 89,  annual: 890 },
      ilimitado:   { name: "Ilimitado",   monthly: 149, annual: 1490 },
    },
  },
  // Brasa Caipira — a partir de R$ 89 (50 clientes), R$ 129 (100 clientes), R$ 169 (ilimitado)
  brasa: {
    label: "Brasa",
    plans: {
      essencial:   { name: "Essencial",   monthly: 89,  annual: 890 },
      crescimento: { name: "Crescimento", monthly: 129, annual: 1290 },
      ilimitado:   { name: "Ilimitado",   monthly: 169, annual: 1690 },
    },
  },
};
const DEFAULT_TENANT = "jj";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "use_post" }, 405);

  let p: any = {};
  try { p = await req.json(); } catch { /* corpo vazio */ }

  const tenantKey = String(p.tenant || "").trim().toLowerCase() || DEFAULT_TENANT;
  const planKey = String(p.plan || "").trim().toLowerCase();
  const cycle: "monthly" | "annual" = p.cycle === "annual" ? "annual" : "monthly";

  // Loja: as legadas (jj/brasa) têm preços fixos aqui; qualquer cliente da FÁBRICA
  // tem os preços no próprio estado (fidelidade_state.data.fabrica.landing.plans).
  let tenantLabel = "";
  let plan: Plan | undefined = TENANTS[tenantKey]?.plans[planKey];
  if (TENANTS[tenantKey]) {
    tenantLabel = TENANTS[tenantKey].label;
  } else {
    const { data: srow } = await admin.from("fidelidade_state").select("data").eq("tenant", tenantKey).maybeSingle();
    const st = srow?.data;
    const plans = st?.fabrica?.landing?.plans;
    if (!Array.isArray(plans)) return json({ ok: false, error: "loja_invalida" }, 400);
    const pl = plans.find((x: any) => String(x.key || "").toLowerCase() === planKey);
    const monthly = pl ? Number(pl.price) : NaN;
    if (!pl || !isFinite(monthly) || monthly <= 0) return json({ ok: false, error: "plano_invalido" }, 400);
    plan = { name: String(pl.name || planKey), monthly, annual: Math.round(monthly * 10) };
    tenantLabel = st?.settings?.brand?.shortName || st?.settings?.brand?.name || "";
  }
  if (!plan) return json({ ok: false, error: "plano_invalido" }, 400);
  const value = cycle === "annual" ? plan.annual : plan.monthly;

  const { data: s } = await admin.from("app_settings")
    .select("asaas_api_key, asaas_sandbox").eq("id", 1).single();
  const apiKey = s?.asaas_api_key;
  if (!apiKey) return json({ ok: false, error: "asaas_nao_configurado" }, 400);

  // anti-abuso leve: no máx. 5 checkouts por IP a cada 10 min
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0";
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recent } = await admin.from("whatsapp_events").select("id")
    .eq("from_phone", ip).eq("kind", "fidelidade_checkout").gte("created_at", since).limit(5);
  if ((recent?.length || 0) >= 5) return json({ ok: false, error: "muitas_tentativas" }, 429);

  const base = s?.asaas_sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  const nome = `Fidelidade ${tenantLabel} ${plan.name}`.replace(/\s+/g, " ").trim().slice(0, 30);
  const nomeDesc = `Cartão Fidelidade ${tenantLabel} ${plan.name}`.replace(/\s+/g, " ").trim();
  // externalReference identifica a loja p/ o fulfillment manual; a J.J mantém o formato legado
  const extRef = tenantKey === DEFAULT_TENANT
    ? `fidelidade:${planKey}:${cycle}`
    : `fidelidade:${tenantKey}:${planKey}:${cycle}`;
  const body = {
    billingTypes: ["CREDIT_CARD", "PIX"],
    chargeTypes: ["DETACHED"],
    minutesToExpire: 60,
    callback: { successUrl: `${SITE}/?status=success`, cancelUrl: `${SITE}/?status=cancel` },
    items: [{
      name: nome,
      description: `Assinatura ${nomeDesc} (${cycle === "annual" ? "1 ano" : "1 mês"})`,
      quantity: 1, value, imageBase64: PIXEL,
    }],
    externalReference: extRef,
  };

  try {
    const res = await fetch(`${base}/checkouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: apiKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Fidelidade checkout Asaas erro:", res.status, JSON.stringify(data));
      return json({ ok: false, error: data?.errors?.[0]?.description || `asaas_${res.status}` }, 400);
    }
    const url = data.link || data.url || (data.id ? `${base.replace("/v3", "")}/checkoutSession/show/${data.id}` : null);
    if (!url) return json({ ok: false, error: "sem_link" }, 400);

    await admin.from("whatsapp_events").insert({
      from_phone: ip, kind: "fidelidade_checkout", status: "created", raw: {},
      parsed: { tenant: tenantKey, plan: planKey, cycle, value },
    });
    return json({ ok: true, url, value, plan: planKey, cycle, tenant: tenantKey });
  } catch (e) {
    console.error("Fidelidade checkout erro:", e);
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});
