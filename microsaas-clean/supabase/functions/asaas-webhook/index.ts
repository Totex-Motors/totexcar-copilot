// TotexCar Co-pilot — Webhook do Asaas: ativa/desativa assinatura, conta cupom e notifica o Totexmotors OS
// Também liquida a CONSULTA VEICULAR paga (externalReference "vq:{id}") — roda a consulta no
// fornecedor e manda o resumo no WhatsApp do cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { runVehicleQuery, resumoDebitos } from "../_shared/debitos.ts";
import { loadWaSettings, waSendText, waSendDocument } from "../_shared/wa.ts";
import { runGptMotors, resumoGpt, type GptProduto } from "../_shared/gptmotors.ts";

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
  let userId = payment.externalReference || checkout.externalReference || "";
  const value = payment.value ?? checkout.value;

  // ⚠️ O Asaas NÃO propaga o externalReference do checkout pro payment (vem null nos eventos
  // PAYMENT_*). Pra consulta veicular, o vínculo confiável é payment.checkoutSession →
  // vehicle_queries.asaas_checkout_id. Sem isso, o evento seria ignorado e a entrega travava.
  if (!userId && payment.checkoutSession) {
    const { data: vq } = await admin.from("vehicle_queries")
      .select("id").eq("asaas_checkout_id", String(payment.checkoutSession)).limit(1);
    if (vq?.[0]) userId = `vq:${vq[0].id}`;
  }
  // Consulta GPT Motors avulsa: idem — vínculo por checkoutSession -> gpt_orders.asaas_checkout_id
  if (!userId && payment.checkoutSession) {
    const { data: go } = await admin.from("gpt_orders")
      .select("id").eq("asaas_checkout_id", String(payment.checkoutSession)).limit(1);
    if (go?.[0]) userId = `gpt:${go[0].id}`;
  }

  try {
    // -------- Consulta veicular paga (avulsa): "vq:{queryId}" --------
    if (String(userId).startsWith("vq:")) {
      const queryId = String(userId).slice(3);
      if (ACTIVATE.has(event) && isUuid(queryId)) {
        // se o self-heal do app já concluiu, não roda nem notifica de novo
        const { data: pre } = await admin.from("vehicle_queries").select("status").eq("id", queryId).single();
        if (pre?.status === "done") {
          return new Response(JSON.stringify({ ok: true, vq: true, ja_concluida: true }), { headers: { "Content-Type": "application/json" } });
        }
        await admin.from("vehicle_queries").update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", queryId).eq("status", "pending");
        const r = await runVehicleQuery(admin, queryId);
        // avisa no WhatsApp (best-effort; se estiver fora da janela de 24h, o app mostra o resultado)
        try {
          const { data: qrow } = await admin.from("vehicle_queries").select("user_id, placa").eq("id", queryId).single();
          if (r.ok && qrow?.user_id) {
            const { data: u } = await admin.from("users").select("phone, name").eq("id", qrow.user_id).single();
            if (u?.phone) {
              const rs = resumoDebitos(r.result);
              const linhas = [
                `✅ Consulta do seu veículo (placa ${qrow.placa}) concluída!`,
                rs.multas_qtd > 0
                  ? `🚨 ${rs.multas_qtd} multa(s) — total R$ ${rs.multas_valor.toFixed(2).replace(".", ",")}${rs.pontos ? ` · ${rs.pontos} ponto(s)` : ""}`
                  : "🟢 Nenhuma multa encontrada",
                rs.roubo_furto === false ? "🟢 Sem registro de roubo/furto" : rs.roubo_furto === true ? "🚨 ATENÇÃO: registro de roubo/furto!" : null,
                rs.restricoes.length ? `⚠️ Restrições: ${rs.restricoes.join("; ")}` : "🟢 Sem restrições",
                `O relatório completo está no app, em Meu Veículo.`,
              ].filter(Boolean).join("\n");
              await waSendText(await loadWaSettings(admin), u.phone, linhas);
            }
          }
        } catch (e) { console.error("aviso consulta veicular:", e); }
      } else if (DEACTIVATE.has(event) && isUuid(queryId)) {
        await admin.from("vehicle_queries").update({ status: "error", error: `pagamento_${event}` })
          .eq("id", queryId).eq("status", "pending");
      }
      return new Response(JSON.stringify({ ok: true, vq: true }), { headers: { "Content-Type": "application/json" } });
    }

    // -------- Consulta GPT Motors paga (avulsa): "gpt:{orderId}" --------
    if (String(userId).startsWith("gpt:")) {
      const orderId = String(userId).slice(4);
      if (ACTIVATE.has(event) && isUuid(orderId)) {
        const { data: order } = await admin.from("gpt_orders").select("*").eq("id", orderId).single();
        if (order && order.status !== "done") {
          await admin.from("gpt_orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId).neq("status", "done");
          const { data: cfg } = await admin.from("app_settings")
            .select("gptmotors_auth_url, gptmotors_chave, gptmotors_token").eq("id", 1).single();
          const produto = order.produto as GptProduto;
          const out = await runGptMotors(
            { authUrl: (cfg as any)?.gptmotors_auth_url || "", chave: (cfg as any)?.gptmotors_chave || "", token: (cfg as any)?.gptmotors_token || "" },
            produto, order.placa, order.uf || undefined,
          );
          const consultaId = crypto.randomUUID();
          await admin.from("gpt_consultas").insert({
            id: consultaId, user_id: order.user_id, produto, placa: order.placa, uf: order.uf,
            status: out.ok ? "ok" : "erro", gpt_id: out.controle?.id || null, faturado: !!out.controle?.faturado,
            preco: order.preco, dados: out.ok ? out.dados : null, analise_ia: out.analiseIA, erro: out.ok ? null : out.erro,
          });
          await admin.from("gpt_orders").update({ status: out.ok ? "done" : "error", consulta_id: consultaId, erro: out.ok ? null : out.erro }).eq("id", orderId);
          // entrega no WhatsApp (best-effort)
          try {
            const phone = order.phone || (await admin.from("users").select("phone").eq("id", order.user_id).single()).data?.phone;
            if (out.ok && phone) {
              const wa = await loadWaSettings(admin);
              await waSendText(wa, phone, resumoGpt(produto, out));
              const arq = produto === "crlv" ? out.dados?.arquivo : null;
              const arqUrl = arq && (typeof arq === "string" ? (/^https?:\/\//.test(arq) ? arq : null) : arq.url);
              if (arqUrl) { try { await waSendDocument(wa, phone, String(arqUrl), `CRLV-${order.placa}.pdf`, "📄 Seu CRLV-e"); } catch { /* */ } }
            }
          } catch (e) { console.error("entrega gpt:", e); }
        }
      } else if (DEACTIVATE.has(event) && isUuid(orderId)) {
        await admin.from("gpt_orders").update({ status: "error", erro: `pagamento_${event}` }).eq("id", orderId).eq("status", "pending");
      }
      return new Response(JSON.stringify({ ok: true, gpt: true }), { headers: { "Content-Type": "application/json" } });
    }

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
