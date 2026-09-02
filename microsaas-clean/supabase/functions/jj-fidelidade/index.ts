// J.J Espetos — Fidelidade: envio do cartão digital pelo WhatsApp
// Backend mínimo do app estático `jj-fidelidade/` (raiz do repo). Este app é de OUTRA
// operação (a churrasqueira J.J), então ele NÃO usa a instância oficial (Meta) do
// Co-pilot: usa uma instância PRÓPRIA de API não oficial (formato uazapi), cujas
// credenciais ficam em app_settings.jj_uazapi_url / jj_uazapi_token — o dono cola a
// URL e o token pelos Ajustes do app quando criar a instância (action "config").
// API não oficial não tem janela de 24h nem template: é texto livre direto.
//
// Ações (POST JSON, todas guardadas por app_settings.jj_wa_key):
//   { action:"send_card", k, phone, name, code, stamps, goal, url }
//       → manda o link do cartão no WhatsApp do cliente.
//   { action:"config", k, uazapi_url?, uazapi_token? }
//       → salva as credenciais da instância (só os campos enviados).
//   { action:"status", k }
//       → diz se a instância está configurada (sem expor o token).
//
// BANCO DE DADOS na nuvem (tabela jj_state, blob único — 1 balcão escreve):
//   { action:"state_pull", k, pin }   → estado completo; exige o PIN do admin
//                                       gravado no próprio blob (bootstrap: sem
//                                       blob ainda, devolve data:null).
//   { action:"state_push", k, pin, data } → grava o estado; valida o PIN contra
//                                       o blob EXISTENTE (troca de PIN: autentica
//                                       com o antigo, grava o novo).
//   { action:"card_pull", k, code }   → só o cartão de UM cliente (por código ou
//                                       telefone) + regras públicas — sem
//                                       telefone/histórico; é o que o celular do
//                                       cliente usa, sem PIN.
//
// Anti-abuso: chave obrigatória + 1 envio por telefone a cada 10 min
// (whatsapp_events kind=jj_card_send).
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

type Settings = { jj_wa_key?: string | null; jj_uazapi_url?: string | null; jj_uazapi_token?: string | null };
async function loadSettings(): Promise<Settings> {
  const { data } = await admin.from("app_settings")
    .select("jj_wa_key, jj_uazapi_url, jj_uazapi_token").eq("id", 1).single();
  return data || {};
}

// transporte uazapi: POST {url}/send/text, header `token`, body {number, text}
async function uazapiText(s: Settings, to: string, text: string): Promise<{ ok: boolean; err?: string }> {
  const url = String(s.jj_uazapi_url || "").replace(/\/+$/, ""), token = s.jj_uazapi_token || "";
  if (!url || !token) return { ok: false, err: "instancia_nao_configurada" };
  try {
    const res = await fetch(`${url}/send/text`, {
      method: "POST", headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number: to, text }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("JJ uazapi send falhou:", res.status, t);
      return { ok: false, err: `instancia_respondeu_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("JJ uazapi send erro:", e);
    return { ok: false, err: "instancia_inacessivel" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "use_post" }, 405);

  let p: any = {};
  try { p = await req.json(); } catch { /* corpo vazio */ }
  const s = await loadSettings();

  // guarda: chave obrigatória (app_settings.jj_wa_key; sem ela o serviço fica desligado)
  if (!s.jj_wa_key) return json({ ok: false, error: "servico_desligado_sem_jj_wa_key" }, 403);
  if (String(p.k || "") !== s.jj_wa_key) return json({ ok: false, error: "chave_invalida" }, 403);

  // ---------- config: dono cola a URL/token da instância pelos Ajustes do app ----------
  if (p.action === "config") {
    const upd: Record<string, string> = {};
    if (p.uazapi_url !== undefined) {
      const u = String(p.uazapi_url || "").trim().replace(/\/+$/, "");
      if (u && !/^https?:\/\//.test(u)) return json({ ok: false, error: "url_invalida" }, 400);
      upd.jj_uazapi_url = u;
    }
    if (p.uazapi_token !== undefined) upd.jj_uazapi_token = String(p.uazapi_token || "").trim();
    if (!Object.keys(upd).length) return json({ ok: false, error: "nada_para_salvar" }, 400);
    const { error } = await admin.from("app_settings").update(upd).eq("id", 1);
    if (error) { console.error("JJ config falhou:", error); return json({ ok: false, error: "falha_ao_salvar" }, 500); }
    const done = await loadSettings();
    return json({ ok: true, configured: !!(done.jj_uazapi_url && done.jj_uazapi_token) });
  }

  // ---------- status: instância pronta? (não expõe o token) ----------
  if (p.action === "status") {
    return json({
      ok: true,
      configured: !!(s.jj_uazapi_url && s.jj_uazapi_token),
      url_set: !!s.jj_uazapi_url, token_set: !!s.jj_uazapi_token,
    });
  }

  // ---------- banco de dados na nuvem (jj_state) ----------
  const loadState = async (): Promise<any | null> => {
    const { data } = await admin.from("jj_state").select("data").eq("id", 1).maybeSingle();
    return (data?.data && typeof data.data === "object" && Array.isArray(data.data.customers)) ? data.data : null;
  };

  // Dois acessos ao Admin: o "dono do sistema" (settings.pin) e o "operador" do
  // balcão (settings.operadorPin, ex.: o Junior). Ambos leem/gravam o estado; só
  // o dono muda plano e PINs. A trava de plano vive no state_push.
  const pinRole = (st: any, pin: string): "super" | "operador" | null => {
    if (pin === String(st?.settings?.pin || "")) return "super";
    if (st?.settings?.operadorPin && pin === String(st.settings.operadorPin)) return "operador";
    return null;
  };

  if (p.action === "state_pull") {
    const st = await loadState();
    if (st && !pinRole(st, String(p.pin || ""))) return json({ ok: false, error: "pin_invalido" }, 403);
    return json({ ok: true, data: st });
  }

  if (p.action === "state_push") {
    const st = await loadState();
    // sem estado ainda (bootstrap): quem grava é o dono; com estado, valida o PIN
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
    // guarda de servidor: nunca aceita o cliente-demo "Junior" (JJ-0001) — protege
    // a base mesmo se um aparelho com versão antiga tentar re-subir o demo
    const isDemo = (c: any) => c && c.code === "JJ-0001" && String(c.name || "").trim().toLowerCase() === "junior"
      && !c.phone && !c.referredBy && !c.redeemed
      && (Array.isArray(c.history) ? c.history.every((h: any) => h.t === "stamp") : true);
    data.customers = data.customers.filter((c: any) => !isDemo(c));
    // trava de plano: a base não pode CRESCER além do limite do plano
    // (Essencial 50, Crescimento 150, Ilimitado sem teto). Selos/edições passam;
    // só barra crescer o nº de clientes acima do teto.
    const PLAN_MAX: Record<string, number> = { essencial: 50, crescimento: 150 };
    const max = PLAN_MAX[String(data.settings.plan || "")] ?? Infinity;
    const oldCount = st ? (st.customers || []).filter((c: any) => !isDemo(c)).length : 0;
    if (data.customers.length > max && data.customers.length > oldCount) {
      return json({ ok: false, error: "limite_plano", max, plan: data.settings.plan }, 409);
    }
    const { error } = await admin.from("jj_state").upsert({ id: 1, data, updated_at: new Date().toISOString() });
    if (error) { console.error("JJ state_push falhou:", error); return json({ ok: false, error: "falha_ao_salvar" }, 500); }
    return json({ ok: true });
  }

  if (p.action === "card_pull") {
    const q = String(p.code || "").trim();
    const st = await loadState();
    if (!st || !q) return json({ ok: true, found: false });
    // telefone tolerante: com/sem +55, com/sem o nono dígito, com/sem DDD
    const canon = (v: unknown) => { let d = onlyDigits(v); if (d.length > 11 && d.startsWith("55")) d = d.slice(2); return d; };
    const matchPhone = (a: unknown, b: unknown) => {
      const ca = canon(a), cb = canon(b);
      if (ca.length < 8 || cb.length < 8) return false;
      if (ca === cb) return true;
      if (ca.slice(-8) !== cb.slice(-8)) return false;
      const da = ca.length >= 10 ? ca.slice(0, 2) : "", db2 = cb.length >= 10 ? cb.slice(0, 2) : "";
      return !da || !db2 || da === db2;
    };
    const c = (st.customers || []).find((x: any) =>
      String(x.code || "").toUpperCase() === q.toUpperCase() ||
      String(x.code || "").toUpperCase() === ("JJ-" + q).toUpperCase() ||
      matchPhone(x.phone, q));
    if (!c) return json({ ok: true, found: false });
    const s2 = st.settings || {};
    // só o necessário pro cartão: sem telefone, sem histórico, sem outros clientes
    return json({
      ok: true, found: true,
      customer: { code: c.code, name: c.name, stamps: c.stamps | 0, redeemed: c.redeemed | 0 },
      rules: { goal: s2.goal || 10, reward: s2.reward || "", rule: s2.rule || "" },
    });
  }

  // ---------- send_card: manda o cartão pro cliente ----------
  if (p.action === "send_card") {
    const to = onlyDigits(p.phone);
    if (to.length < 10) return json({ ok: false, error: "telefone_invalido" }, 400);
    const to55 = to.length <= 11 ? "55" + to : to; // sem DDI → assume Brasil
    const name = String(p.name || "cliente").slice(0, 80);
    const stamps = parseInt(p.stamps, 10) || 0, goal = parseInt(p.goal, 10) || 10;
    const url = String(p.url || "").slice(0, 300);
    if (!/^https?:\/\//.test(url)) return json({ ok: false, error: "url_invalida" }, 400);

    // anti-abuso: no máx. 1 envio por telefone a cada 10 min
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recent } = await admin.from("whatsapp_events").select("id")
      .eq("from_phone", to55).eq("kind", "jj_card_send").gte("created_at", since).limit(1);
    if (recent?.length) return json({ ok: false, error: "aguarde_10min" }, 429);

    // só emojis do plano básico Unicode (⭐ ➡): os "altos" (🔥 etc.) chegam
    // como "�" em alguns Androids — mesma formatação do modo grátis do app
    const text =
      `Olá, *${name}*! ⭐\n\n` +
      `Seu *Cartão Fidelidade J.J Espetos* está pronto.\n\n` +
      `*Cartão:* ${String(p.code || "")}\n` +
      `*Selos:* ${stamps} de ${goal}\n\n` +
      `➡ Acompanhe seus selos e seu prêmio:\n${url}\n\n` +
      `Compre 10 costelas no bafo ou 10 frangos e ganhe um almoço completo grátis!\n\n` +
      `_J.J Restaurante e Espetaria_\n` +
      `Av. Tenente Marquês, 06 — Polvilho, Cajamar`;

    const sent = await uazapiText(s, to55, text);
    if (!sent.ok) return json({ ok: false, error: sent.err });

    await admin.from("whatsapp_events").insert({
      from_phone: to55, kind: "jj_card_send", status: "sent", raw: {},
      parsed: { code: String(p.code || ""), via: "uazapi" },
    });
    return json({ ok: true, via: "uazapi" });
  }

  return json({ error: "acao_desconhecida" }, 400);
});
