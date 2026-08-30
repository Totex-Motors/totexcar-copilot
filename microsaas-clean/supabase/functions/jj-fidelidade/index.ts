// J.J Espetos — Fidelidade: envio do cartão digital pelo WhatsApp
// Backend mínimo do app estático `jj-fidelidade/` (raiz do repo). Usa a MESMA instância
// de WhatsApp do Co-pilot (app_settings: provider meta/uazapi), mas é um serviço separado:
// nada aqui passa pelo roteador do whatsapp-webhook.
//
// AUTOCONTIDA de propósito: o deploy pode ser feito só com este arquivo (sem _shared/),
// então o transporte Meta/uazapi está duplicado aqui em versão enxuta. O template
// `jj_fidelidade_cartao` também está registrado em _shared/wa.ts (fonte da verdade).
//
// Ações (POST JSON, guardadas por app_settings.jj_wa_key):
//   { action:"send_card", k, phone, name, code, stamps, goal, url }
//       → manda o link do cartão pro cliente. Tenta texto livre (janela de 24h);
//         fora da janela cai no template UTILITY `jj_fidelidade_cartao`.
//   { action:"setup", k }
//       → cria o template no WABA se ainda não existir e informa o status de aprovação.
//
// Regra de ouro da API oficial: mensagem INICIADA PELO NEGÓCIO só sai por template
// aprovado; por isso o setup existe. Anti-abuso: chave obrigatória + 1 envio por
// telefone a cada 10 min (whatsapp_events kind=jj_card_send).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const GRAPH = "https://graph.facebook.com/v21.0";
const TEMPLATE = "jj_fidelidade_cartao";
const TEMPLATE_BODY =
  "Olá {{1}}! 🔥 Seu Cartão Fidelidade J.J Espetos está pronto. Você já tem {{2}} selos. " +
  "Acompanhe seus selos e seu prêmio aqui: {{3}} Obrigado pela preferência!";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (s: unknown) => String(s || "").replace(/\D/g, "");
// Meta rejeita parâmetro de template com quebra de linha / 4+ espaços (mesma regra do _shared/wa.ts)
const cleanParam = (s: unknown) => String(s ?? "").replace(/[\n\r\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 900);

type Settings = {
  wa_provider?: string | null; jj_wa_key?: string | null;
  meta_wa_token?: string | null; meta_wa_phone_id?: string | null; meta_waba_id?: string | null;
  uazapi_url?: string | null; uazapi_token?: string | null;
};
async function loadSettings(): Promise<Settings> {
  const { data } = await admin.from("app_settings")
    .select("wa_provider, jj_wa_key, meta_wa_token, meta_wa_phone_id, meta_waba_id, uazapi_url, uazapi_token")
    .eq("id", 1).single();
  return data || {};
}

async function metaPost(s: Settings, body: unknown): Promise<{ ok: boolean; err?: string }> {
  const token = s.meta_wa_token || "", phoneId = s.meta_wa_phone_id || "";
  if (!token || !phoneId) return { ok: false, err: "meta_nao_configurado" };
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("JJ meta send falhou:", res.status, t);
    return { ok: false, err: t.slice(0, 500) };
  }
  return { ok: true };
}

async function uazapiText(s: Settings, to: string, text: string): Promise<boolean> {
  const url = String(s.uazapi_url || "").replace(/\/+$/, ""), token = s.uazapi_token || "";
  if (!url || !token) return false;
  const res = await fetch(`${url}/send/text`, {
    method: "POST", headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number: to, text }),
  });
  if (!res.ok) console.error("JJ uazapi send falhou:", res.status, await res.text());
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "use_post" }, 405);

  let p: any = {};
  try { p = await req.json(); } catch { /* corpo vazio */ }
  const s = await loadSettings();

  // guarda: chave obrigatória (setar app_settings.jj_wa_key; sem ela o serviço fica desligado)
  if (!s.jj_wa_key) return json({ ok: false, error: "servico_desligado_sem_jj_wa_key" }, 403);
  if (String(p.k || "") !== s.jj_wa_key) return json({ ok: false, error: "chave_invalida" }, 403);

  // ---------- setup: garante o template no WABA ----------
  if (p.action === "setup") {
    const token = s.meta_wa_token || "", waba = s.meta_waba_id || "";
    if (!token || !waba) return json({ ok: false, error: "meta_nao_configurado" });
    const q = await fetch(`${GRAPH}/${waba}/message_templates?name=${TEMPLATE}&fields=name,status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const qj = await q.json().catch(() => ({}));
    const existing = (qj?.data || []).find((t: any) => t.name === TEMPLATE);
    if (existing) return json({ ok: true, template: TEMPLATE, status: existing.status });
    const c = await fetch(`${GRAPH}/${waba}/message_templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: TEMPLATE, language: "pt_BR", category: "UTILITY",
        components: [{
          type: "BODY", text: TEMPLATE_BODY,
          example: { body_text: [["Junior", "2 de 10", "https://exemplo.app/?c=JJ-0001"]] },
        }],
      }),
    });
    const cj = await c.json().catch(() => ({}));
    if (!c.ok) { console.error("JJ setup template falhou:", c.status, JSON.stringify(cj)); return json({ ok: false, error: cj?.error?.message || "falha_criar_template" }); }
    return json({ ok: true, template: TEMPLATE, status: cj?.status || "PENDING", created: true });
  }

  // ---------- send_card: manda o cartão pro cliente ----------
  if (p.action === "send_card") {
    const to = onlyDigits(p.phone);
    if (to.length < 10) return json({ ok: false, error: "telefone_invalido" }, 400);
    const to55 = to.length <= 11 ? "55" + to : to; // sem DDI → assume Brasil
    const name = cleanParam(p.name || "cliente");
    const stampsTxt = cleanParam(`${parseInt(p.stamps, 10) || 0} de ${parseInt(p.goal, 10) || 10}`);
    const url = String(p.url || "").slice(0, 300);
    if (!/^https?:\/\//.test(url)) return json({ ok: false, error: "url_invalida" }, 400);

    // anti-abuso: no máx. 1 envio por telefone a cada 10 min
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await admin.from("whatsapp_events").select("id")
      .eq("from_phone", to55).eq("kind", "jj_card_send").gte("created_at", since).limit(1);
    if (recent?.length) return json({ ok: false, error: "aguarde_10min" }, 429);

    const text =
      `🔥 Olá ${name}! Seu *Cartão Fidelidade J.J Espetos* está pronto.\n\n` +
      `Você já tem *${stampsTxt}* selos. Acompanhe seus selos e seu prêmio aqui:\n${url}\n\n` +
      `Compre 10 costelas no bafo ou 10 frangos e ganhe um almoço completo grátis. ` +
      `Obrigado pela preferência! — Av. Tenente Marques, 06 · Polvilho, Cajamar`;

    let via = "";
    if (String(s.wa_provider || "").toLowerCase() === "meta") {
      // 1º texto livre (entrega se o cliente falou com o número nas últimas 24h)…
      const free = await metaPost(s, {
        messaging_product: "whatsapp", to: to55, type: "text",
        text: { body: text, preview_url: true },
      });
      if (free.ok) via = "texto";
      else {
        // …fora da janela: template UTILITY (precisa estar APPROVED — action:"setup")
        const tpl = await metaPost(s, {
          messaging_product: "whatsapp", to: to55, type: "template",
          template: {
            name: TEMPLATE, language: { code: "pt_BR" },
            components: [{ type: "body", parameters: [name, stampsTxt, url].map((t) => ({ type: "text", text: cleanParam(t) })) }],
          },
        });
        if (tpl.ok) via = "template";
        else return json({ ok: false, error: "envio_falhou", detail: tpl.err });
      }
    } else {
      if (!(await uazapiText(s, to55, text))) return json({ ok: false, error: "envio_falhou" });
      via = "uazapi";
    }

    await admin.from("whatsapp_events").insert({
      from_phone: to55, kind: "jj_card_send", status: "sent", raw: {},
      parsed: { code: String(p.code || ""), via },
    });
    return json({ ok: true, via });
  }

  return json({ error: "acao_desconhecida" }, 400);
});
