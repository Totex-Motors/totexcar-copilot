// TotexCar Co-pilot — Dealer API (Painel do Lojista)
// O lojista loga normalmente (Supabase auth). Esta função valida o JWT, confirma que o
// chamador é role='dealer' (ou 'admin') e ESCOPA tudo pela loja (dealership) dele — ele
// nunca enxerga clientes de outra loja. Reaproveita a lógica da função `integration`.
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

function daysUntil(dateStr: any): number | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const t = new Date(y, (m || 1) - 1, d || 1); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}
function vencimentosOf(vehicle: any, owner: any) {
  return [
    { tipo: "Licenciamento", date: vehicle?.licenciamento_vencimento },
    { tipo: "IPVA", date: vehicle?.ipva_vencimento },
    { tipo: "Seguro", date: vehicle?.seguro_vencimento },
    { tipo: "CNH", date: owner?.cnh_vencimento },
  ].filter((x) => x.date).map((x) => ({ ...x, days: daysUntil(x.date) }))
    .sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));
}

const onlyDigits = (s: any) => String(s || "").replace(/\D/g, "");
const fmtBR = (d: any) => {
  if (!d) return "";
  const [y, m, day] = String(d).split("-");
  return day && m && y ? `${day}/${m}/${y}` : String(d);
};

// Substitui as variáveis do template pela info de cada cliente
function personalize(template: string, c: any): string {
  const veiculo = c.vehicle ? [c.vehicle.marca, c.vehicle.modelo].filter(Boolean).join(" ") : "seu veículo";
  const nd = c.next_due;
  return String(template || "")
    .replace(/\{nome\}/gi, (c.name || "").split(" ")[0] || "tudo bem")
    .replace(/\{nome_completo\}/gi, c.name || "")
    .replace(/\{veiculo\}/gi, veiculo)
    .replace(/\{placa\}/gi, c.vehicle?.placa || "")
    .replace(/\{vencimento\}/gi, nd ? `${nd.tipo} em ${fmtBR(nd.date)}` : "")
    .replace(/\{tipo_vencimento\}/gi, nd?.tipo || "")
    .replace(/\{dias\}/gi, nd?.days != null ? String(nd.days) : "")
    .replace(/\{loja\}/gi, c.dealership || "");
}

async function uazapiSend(settings: any, phone: string, text: string): Promise<boolean> {
  const url = String(settings?.uazapi_url || "").replace(/\/+$/, "");
  const token = settings?.uazapi_token || "";
  if (!url || !token) throw new Error("uazapi_not_configured");
  try {
    const res = await fetch(`${url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number: onlyDigits(phone), text }),
    });
    return res.ok;
  } catch { return false; }
}

// Gera um rascunho de mensagem com o provedor de IA configurado (texto puro)
async function aiDraft(settings: any, brief: string, storeName: string): Promise<string> {
  const provider = settings?.ai_provider || "anthropic";
  const model = settings?.ai_model || "claude-opus-4-8";
  const key = provider === "openai" ? settings?.openai_api_key
    : provider === "gemini" ? settings?.gemini_api_key : settings?.anthropic_api_key;
  if (!key) throw new Error("ai_key_not_configured");

  const sys = `Você escreve mensagens curtas de WhatsApp para uma loja de carros chamada "${storeName || "a loja"}" `
    + `enviar aos clientes dela (donos de carro). Tom cordial, brasileiro, direto, no máximo 4 linhas, 1 emoji no máximo. `
    + `Use EXATAMENTE estas variáveis quando fizer sentido (serão trocadas depois): {nome}, {veiculo}, {placa}, {vencimento}, {dias}, {loja}. `
    + `Não invente dados nem coloque colchetes além dessas variáveis. Responda SOMENTE com o texto da mensagem.`;
  const user = `Objetivo da mensagem: ${brief}`;

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 400, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return (j.choices?.[0]?.message?.content || "").trim();
  }
  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }] }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return (j.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join("") || "").trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 400, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return ((j.content || []).find((b: any) => b.type === "text")?.text || "").trim();
}

// Monta a lista de destinatários (enriquecida) de uma loja, conforme o público escolhido
async function recipientsFor(adminClient: any, dealership: string | null, audience: string, clientId?: string) {
  let q = adminClient.from("users")
    .select("id, name, phone, dealership, cnh_vencimento, plan, subscription_status")
    .eq("role", "owner");
  if (dealership) q = q.eq("dealership", dealership);
  if (audience === "single" && clientId) q = q.eq("id", clientId);
  const { data: owners } = await q.limit(1000);
  const ids = (owners || []).map((o: any) => o.id);
  if (!ids.length) return [];
  const { data: vehicles } = await adminClient.from("accounts")
    .select("user_id, name, marca, modelo, placa, licenciamento_vencimento, ipva_vencimento, seguro_vencimento")
    .in("user_id", ids);
  const vByUser: Record<string, any> = {};
  (vehicles || []).forEach((v: any) => { if (!vByUser[v.user_id]) vByUser[v.user_id] = v; });

  let list = (owners || []).map((o: any) => {
    const v = vByUser[o.id] || null;
    const ven = vencimentosOf(v, o);
    return {
      id: o.id, name: o.name, phone: o.phone, dealership: o.dealership,
      vehicle: v ? { marca: v.marca, modelo: v.modelo, placa: v.placa } : null,
      next_due: ven[0] || null,
    };
  }).filter((c: any) => onlyDigits(c.phone).length >= 10); // só quem tem telefone válido

  if (audience === "due_soon") {
    list = list.filter((c: any) => c.next_due && c.next_due.days != null && c.next_due.days <= 30);
  }
  return list;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // identifica o chamador pelo JWT
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  const { data: me } = await admin.from("users")
    .select("id, name, email, role, dealership").eq("id", ud.user.id).single();
  if (!me) return json({ error: "no_profile" }, 403);

  const isAdmin = me.role === "admin";
  const isDealer = me.role === "dealer";
  if (!isAdmin && !isDealer) return json({ error: "forbidden" }, 403);

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = p.action as string;

  // Loja efetiva: o lojista é SEMPRE preso à própria loja; o admin pode escolher (ou ver tudo).
  const scopeDealership = isAdmin ? (p.dealership ? String(p.dealership) : null) : (me.dealership || "__none__");

  try {
    switch (action) {
      case "me":
        return json({ ok: true, dealer: { id: me.id, name: me.name, email: me.email, role: me.role, dealership: me.dealership } });

      case "list_clients": {
        let q = admin.from("users")
          .select("id, name, email, phone, plan, subscription_status, coupon_code, dealership, cnh_vencimento, created_at, plan_cycle, plan_value")
          .eq("role", "owner")
          .order("created_at", { ascending: false });
        if (scopeDealership) q = q.eq("dealership", scopeDealership);
        const { data: owners } = await q.limit(Number(p.limit) || 500);
        const ids = (owners || []).map((o: any) => o.id);
        if (!ids.length) return json({ ok: true, dealership: scopeDealership, clients: [] });

        const { data: vehicles } = await admin.from("accounts")
          .select("user_id, name, marca, modelo, placa, hodometro, licenciamento_vencimento, ipva_vencimento, seguro_vencimento")
          .in("user_id", ids);
        const { data: txs } = await admin.from("transactions")
          .select("user_id, amount, type, transaction_date").in("user_id", ids);

        const vByUser: Record<string, any> = {};
        (vehicles || []).forEach((v: any) => { if (!vByUser[v.user_id]) vByUser[v.user_id] = v; });
        const agg: Record<string, any> = {};
        (txs || []).forEach((t: any) => {
          const a = agg[t.user_id] || (agg[t.user_id] = { total: 0, count: 0, last: null });
          if (t.type === "expense") { a.total += Math.abs(t.amount); a.count++; }
          if (!a.last || t.transaction_date > a.last) a.last = t.transaction_date;
        });

        const clients = (owners || []).map((o: any) => {
          const v = vByUser[o.id] || null;
          const ven = vencimentosOf(v, o);
          const a = agg[o.id] || { total: 0, count: 0, last: null };
          return {
            id: o.id, name: o.name, email: o.email, phone: o.phone,
            plan: o.plan, subscription_status: o.subscription_status,
            coupon_code: o.coupon_code, dealership: o.dealership, created_at: o.created_at,
            vehicle: v ? { apelido: v.name, marca: v.marca, modelo: v.modelo, placa: v.placa, hodometro: v.hodometro } : null,
            next_due: ven[0] || null,
            total_expenses: Number(a.total.toFixed(2)), expense_count: a.count, last_expense_date: a.last,
          };
        });
        return json({ ok: true, dealership: scopeDealership, clients });
      }

      case "client_journey": {
        const { user_id } = p;
        if (!user_id) return json({ error: "user_id_required" }, 400);
        const { data: ow } = await admin.from("users").select("*").eq("id", user_id).limit(1);
        const owner = ow?.[0];
        if (!owner) return json({ ok: true, owner: null });
        // ESCOPO: lojista só acessa cliente da própria loja
        if (!isAdmin && owner.dealership !== me.dealership) return json({ error: "forbidden" }, 403);

        const { data: vs } = await admin.from("accounts").select("*").eq("user_id", owner.id).limit(1);
        const vehicle = vs?.[0] || null;
        const { data: tx } = await admin.from("transactions")
          .select("description, amount, type, transaction_date, odometer, categories(name)")
          .eq("user_id", owner.id).order("transaction_date", { ascending: false }).limit(30);

        let total = 0, count = 0; const byCat: Record<string, number> = {};
        (tx || []).forEach((t: any) => {
          if (t.type === "expense") { total += Math.abs(t.amount); count++; const n = t.categories?.name || "Outros"; byCat[n] = (byCat[n] || 0) + Math.abs(t.amount); }
        });

        return json({
          ok: true,
          owner: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, plan: owner.plan, subscription_status: owner.subscription_status, dealership: owner.dealership, coupon_code: owner.coupon_code, created_at: owner.created_at },
          vehicle,
          vencimentos: vencimentosOf(vehicle, owner),
          expenses: { total: Number(total.toFixed(2)), count, by_category: byCat },
          recent_expenses: (tx || []).map((t: any) => ({ description: t.description, amount: t.amount, type: t.type, date: t.transaction_date, odometer: t.odometer, category: t.categories?.name })),
        });
      }

      // Painel do Lojista — Campanhas (WhatsApp)
      case "campaign_recipients": {
        const audience = String(p.audience || "all");
        const list = await recipientsFor(admin, isAdmin ? (p.dealership || null) : me.dealership, audience, p.client_id);
        return json({ ok: true, count: list.length, recipients: list });
      }

      case "draft_message": {
        const brief = String(p.brief || "").trim();
        if (!brief) return json({ error: "brief_required" }, 400);
        const { data: settings } = await admin.from("app_settings")
          .select("ai_provider, ai_model, anthropic_api_key, openai_api_key, gemini_api_key").eq("id", 1).single();
        const message = await aiDraft(settings, brief, me.dealership || "");
        return json({ ok: true, message });
      }

      case "send_campaign": {
        const audience = String(p.audience || "all");
        const message = String(p.message || "").trim();
        if (!message) return json({ error: "message_required" }, 400);

        const { data: settings } = await admin.from("app_settings")
          .select("uazapi_url, uazapi_token").eq("id", 1).single();
        if (!settings?.uazapi_url || !settings?.uazapi_token) return json({ error: "uazapi_not_configured" }, 400);

        const list = await recipientsFor(admin, isAdmin ? (p.dealership || null) : me.dealership, audience, p.client_id);
        if (!list.length) return json({ ok: true, total: 0, sent: 0, failed: 0, results: [] });

        const results: any[] = [];
        let sent = 0, failed = 0;
        for (const c of list) {
          const txt = personalize(message, c);
          const ok = await uazapiSend(settings, c.phone, txt);
          if (ok) sent++; else failed++;
          results.push({ id: c.id, name: c.name, phone: c.phone, ok });
          await new Promise((r) => setTimeout(r, 350)); // evita flood no Uazapi
        }
        return json({ ok: true, total: list.length, sent, failed, results });
      }

      // ===================== SUCESSO DO CLIENTE / PÓS-VENDA (Fase 1) =====================
      case "postsale_config": {
        const { data: cfg } = await admin.from("dealership_settings").select("*").eq("dealership", scopeDealership).maybeSingle();
        const { data: cps } = await admin.from("coupons").select("code").eq("dealership", scopeDealership).eq("active", true).limit(1);
        return json({ ok: true, config: cfg || { dealership: scopeDealership, google_review_url: null, nps_delay_days: 3 }, coupon: cps?.[0]?.code || null });
      }

      case "postsale_config_save": {
        if (!scopeDealership || scopeDealership === "__none__") return json({ error: "sem_loja" }, 400);
        const { error } = await admin.from("dealership_settings").upsert({
          dealership: scopeDealership,
          google_review_url: p.google_review_url ? String(p.google_review_url).trim() : null,
          nps_delay_days: Number(p.nps_delay_days) > 0 ? Number(p.nps_delay_days) : 3,
          updated_at: new Date().toISOString(),
        }, { onConflict: "dealership" });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "postsale_create": {
        if (!scopeDealership || scopeDealership === "__none__") return json({ error: "sem_loja" }, 400);
        const phone = String(p.customer_phone || "").replace(/\D/g, "");
        if (phone.length < 10) return json({ error: "telefone_invalido" }, 400);
        const name = String(p.customer_name || "").trim() || null;
        const car = String(p.car_desc || "").trim() || null;
        const purchase = /^\d{4}-\d{2}-\d{2}$/.test(String(p.purchase_date)) ? p.purchase_date : new Date().toISOString().split("T")[0];

        const { data: cps } = await admin.from("coupons").select("code").eq("dealership", scopeDealership).eq("active", true).limit(1);
        const coupon = cps?.[0]?.code || null;

        const { data: created, error } = await admin.from("postsale_journeys").insert({
          dealership: scopeDealership, customer_name: name, customer_phone: phone, car_desc: car,
          purchase_date: purchase, coupon_code: coupon, created_by: me.id,
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);

        // Boas-vindas + convite pra ativar o Co-pilot com o bônus da loja (semi-automático)
        const { data: st } = await admin.from("app_settings").select("uazapi_url, uazapi_token, app_url").eq("id", 1).single();
        const appUrl = (st?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
        const link = `${appUrl}/entrar?tab=register${coupon ? `&coupon=${encodeURIComponent(coupon)}` : ""}`;
        const msg = `Olá${name ? " " + name.split(" ")[0] : ""}! 🎉 Muito obrigado por comprar${car ? ` seu ${car}` : ""} na ${scopeDealership}!\n\nComo nosso cliente, você ganhou acesso ao *TotexCar Co-pilot* — seu assistente do carro no WhatsApp (gastos, consumo, revisões, multas e mais), com um bônus especial:\n${link}\n\nQualquer dúvida é só chamar por aqui. Boa estrada! 🚗`;
        let welcome = false;
        try { if (st?.uazapi_url && st?.uazapi_token) welcome = await uazapiSend(st, phone, msg); } catch { /* Uazapi off: cria a jornada mesmo assim */ }
        if (welcome) await admin.from("postsale_journeys").update({ welcome_sent: true }).eq("id", created.id);
        return json({ ok: true, id: created.id, welcome_sent: welcome });
      }

      case "postsale_list": {
        let q = admin.from("postsale_journeys").select("*").order("created_at", { ascending: false });
        if (scopeDealership && scopeDealership !== "__none__") q = q.eq("dealership", scopeDealership);
        const { data } = await q.limit(Number(p.limit) || 300);
        return json({ ok: true, journeys: data || [] });
      }

      case "postsale_stats": {
        let q = admin.from("postsale_journeys").select("nps_score");
        if (scopeDealership && scopeDealership !== "__none__") q = q.eq("dealership", scopeDealership);
        const { data } = await q;
        const rows = data || [];
        const scored = rows.filter((r: any) => r.nps_score != null);
        const prom = scored.filter((r: any) => r.nps_score >= 9).length;
        const det = scored.filter((r: any) => r.nps_score <= 6).length;
        const pas = scored.length - prom - det;
        const nps = scored.length ? Math.round(((prom - det) / scored.length) * 100) : null;
        return json({ ok: true, total: rows.length, respondidos: scored.length, promotores: prom, passivos: pas, detratores: det, nps });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
