// Fábrica do Cartão Fidelidade — backend ADMIN de provisionamento (só a Totex usa).
//
// O painel da fábrica (fidelidade/fabrica.html) chama esta função pra cadastrar um
// cliente novo do zero: cria a chave da loja (wa_key), grava o estado inicial na nuvem
// (marca, regras, plano, catálogo, sorteio, e os parâmetros da landing) e devolve tudo
// pronto pra o painel gerar o app e a landing.
//
// TUDO é protegido por uma CHAVE DE ADMIN (fidelidade_admin.admin_key) — sem ela, 403.
// A função usa a service role, então bypassa PIN/trava de plano de propósito (é o dono
// da fábrica configurando). A J.J e o resto do Co-pilot não são tocados.
//
// Ações (POST JSON, sempre com { key }):
//   login        → valida a chave
//   list         → lista os clientes (tenants) e um resumo de cada
//   get          → { tenant } → config completa daquele cliente
//   provision    → { tenant, config } → cria/atualiza o cliente e devolve { wa_key }
//   upload_photo → { tenant, dataUrl } → sobe foto (logo/produto) e devolve a URL pública
//   set_active   → { tenant, active } → liga/desliga o cliente
//   change_key   → { newKey } → troca a chave de admin da fábrica
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const FIDELIDADE_FN = `${SUPABASE_URL}/functions/v1/fidelidade`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const slugOk = (t: string) => /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/.test(t);
const newKey = () => crypto.randomUUID().replace(/-/g, "");

async function checkAdmin(key: string): Promise<{ ok: boolean; name?: string }> {
  if (!key) return { ok: false };
  const { data } = await admin.from("fidelidade_admin").select("admin_key, name").eq("id", 1).maybeSingle();
  if (!data || String(data.admin_key) !== String(key)) return { ok: false };
  return { ok: true, name: data.name || "Totex" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "use_post" }, 405);

  let p: any = {};
  try { p = await req.json(); } catch { /* corpo vazio */ }

  const auth = await checkAdmin(String(p.key || ""));
  if (!auth.ok) return json({ ok: false, error: "nao_autorizado" }, 403);

  const action = String(p.action || "");

  // ---------- login ----------
  if (action === "login") return json({ ok: true, name: auth.name });

  // ---------- lista de clientes ----------
  if (action === "list") {
    const { data: tenants } = await admin.from("fidelidade_tenants").select("tenant, wa_key, active");
    const { data: states } = await admin.from("fidelidade_state").select("tenant, data, updated_at");
    const byTenant: Record<string, any> = {};
    (states || []).forEach((s: any) => { byTenant[s.tenant] = s; });
    const list = (tenants || []).map((t: any) => {
      const st = byTenant[t.tenant]?.data || {};
      const s = st.settings || {};
      const caps = s.capabilities || {};
      return {
        tenant: t.tenant,
        active: t.active !== false,
        name: s.brand?.name || t.tenant,
        plan: s.plan || "",
        customers: Array.isArray(st.customers) ? st.customers.length : 0,
        hasCatalog: !!(caps.catalog && caps.catalog.enabled),
        hasSorteio: !!(caps.sorteios && caps.sorteios.enabled),
        hasLanding: !!(st.fabrica && st.fabrica.landing && st.fabrica.landing.enabled),
        updatedAt: byTenant[t.tenant]?.updated_at || null,
      };
    });
    return json({ ok: true, tenants: list, fidelidadeFn: FIDELIDADE_FN });
  }

  // ---------- config completa de um cliente ----------
  if (action === "get") {
    const tenant = String(p.tenant || "").trim();
    const { data: trow } = await admin.from("fidelidade_tenants").select("wa_key, active").eq("tenant", tenant).maybeSingle();
    const { data: srow } = await admin.from("fidelidade_state").select("data").eq("tenant", tenant).maybeSingle();
    if (!trow && !srow) return json({ ok: false, error: "cliente_inexistente" }, 404);
    const st = srow?.data || {};
    return json({
      ok: true, tenant,
      wa_key: trow?.wa_key || "",
      active: trow ? trow.active !== false : true,
      settings: st.settings || {},
      fabrica: st.fabrica || {},
      customers: Array.isArray(st.customers) ? st.customers.length : 0,
      fidelidadeFn: FIDELIDADE_FN,
    });
  }

  // ---------- cria / atualiza um cliente ----------
  if (action === "provision") {
    const tenant = String(p.tenant || "").trim().toLowerCase();
    if (!slugOk(tenant)) return json({ ok: false, error: "slug_invalido" }, 400);
    const cfg = p.config || {};
    const settings = cfg.settings || {};
    if (!settings.brand || !settings.brand.name) return json({ ok: false, error: "marca_incompleta" }, 400);

    // 1) tenant + chave (mantém a chave se já existir)
    const { data: trow } = await admin.from("fidelidade_tenants").select("wa_key").eq("tenant", tenant).maybeSingle();
    const wa_key = trow?.wa_key || newKey();
    {
      const { error } = await admin.from("fidelidade_tenants")
        .upsert({ tenant, wa_key, active: true }, { onConflict: "tenant" });
      if (error) { console.error("provision tenants:", tenant, error); return json({ ok: false, error: "falha_tenant" }, 500); }
    }

    // 2) estado inicial (preserva clientes/seq se a loja já rodava)
    const { data: srow } = await admin.from("fidelidade_state").select("data").eq("tenant", tenant).maybeSingle();
    const prev = srow?.data || {};
    // força o endpoint/chave da nuvem certos (função multi-loja + a chave desta loja)
    settings.waEndpoint = FIDELIDADE_FN;
    settings.waKey = wa_key;
    const data = {
      settings,
      fabrica: { landing: cfg.landing || {}, updatedAt: new Date().toISOString() },
      customers: Array.isArray(prev.customers) ? prev.customers : [],
      seq: Number.isFinite(prev.seq) ? prev.seq : 1,
    };
    if (JSON.stringify(data).length > 3_000_000) return json({ ok: false, error: "dados_grandes" }, 400);
    {
      const { error } = await admin.from("fidelidade_state")
        .upsert({ tenant, data, updated_at: new Date().toISOString() }, { onConflict: "tenant" });
      if (error) { console.error("provision state:", tenant, error); return json({ ok: false, error: "falha_estado" }, 500); }
    }
    return json({ ok: true, tenant, wa_key, fidelidadeFn: FIDELIDADE_FN });
  }

  // ---------- upload de foto (logo / produto) ----------
  if (action === "upload_photo") {
    const tenant = String(p.tenant || "").trim().toLowerCase();
    if (!slugOk(tenant)) return json({ ok: false, error: "slug_invalido" }, 400);
    const dataUrl = String(p.dataUrl || "");
    const m = dataUrl.match(/^data:(image\/(png|jpe?g|webp|svg\+xml));base64,(.+)$/);
    if (!m) return json({ ok: false, error: "imagem_invalida" }, 400);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)); }
    catch { return json({ ok: false, error: "imagem_invalida" }, 400); }
    if (bytes.length > 2_000_000) return json({ ok: false, error: "imagem_grande" }, 400);
    const ext = m[2] === "png" ? "png" : m[2] === "webp" ? "webp" : m[2] === "svg+xml" ? "svg" : "jpg";
    const path = `${tenant}/fabrica/${crypto.randomUUID()}.${ext}`;
    const up = await admin.storage.from("fidelidade-fotos").upload(path, bytes, { contentType: m[1], upsert: false });
    if (up.error) { console.error("fabrica upload:", tenant, up.error); return json({ ok: false, error: "falha_upload" }, 500); }
    const { data } = admin.storage.from("fidelidade-fotos").getPublicUrl(path);
    return json({ ok: true, url: data.publicUrl });
  }

  // ---------- liga / desliga cliente ----------
  if (action === "set_active") {
    const tenant = String(p.tenant || "").trim().toLowerCase();
    const active = p.active !== false;
    const { error } = await admin.from("fidelidade_tenants").update({ active }).eq("tenant", tenant);
    if (error) return json({ ok: false, error: "falha_ativar" }, 500);
    return json({ ok: true, tenant, active });
  }

  // ---------- pagamentos (assinaturas): lê o Asaas e agrupa por loja ----------
  // Os checkouts caem no Asaas com externalReference "fidelidade:<loja>:<plano>:<ciclo>"
  // (ou "fidelidade:<plano>:<ciclo>" p/ a J.J legada). Aqui listamos os pagamentos
  // PAGOS recentes e agrupamos por loja, pra saber quem está em dia.
  if (action === "payments") {
    const { data: cfg } = await admin.from("app_settings").select("asaas_api_key, asaas_sandbox").eq("id", 1).single();
    const apiKey = cfg?.asaas_api_key;
    if (!apiKey) return json({ ok: false, error: "asaas_nao_configurado" }, 400);
    const base = cfg?.asaas_sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
    const days = Math.min(Math.max(Number(p.days) || 120, 30), 366);
    const ge = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const PAID = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"]);
    const payments: any[] = [];
    let offset = 0;
    for (let i = 0; i < 6; i++) {
      const url = `${base}/payments?limit=100&offset=${offset}&dateCreated%5Bge%5D=${ge}`;
      let j: any = null;
      try { const r = await fetch(url, { headers: { access_token: apiKey } }); if (!r.ok) break; j = await r.json(); }
      catch { break; }
      for (const pay of (j?.data || [])) {
        const ref = String(pay.externalReference || "");
        if (!ref.startsWith("fidelidade:")) continue;
        if (!PAID.has(String(pay.status))) continue;
        const parts = ref.split(":");
        let t = "", plano = "", ciclo = "";
        if (parts.length >= 4) { t = parts[1]; plano = parts[2]; ciclo = parts[3]; }
        else { t = "jj"; plano = parts[1] || ""; ciclo = parts[2] || ""; }
        payments.push({ tenant: t, plano, ciclo, value: Number(pay.value) || 0,
          date: pay.paymentDate || pay.clientPaymentDate || pay.confirmedDate || pay.dateCreated || "",
          status: pay.status, billingType: pay.billingType || "" });
      }
      if (!j?.hasMore) break;
      offset += 100;
    }
    const byTenant: Record<string, any> = {};
    for (const pay of payments) {
      const g = byTenant[pay.tenant] || (byTenant[pay.tenant] = { tenant: pay.tenant, count: 0, total: 0, last: "", lastValue: 0, plano: "", ciclo: "" });
      g.count++; g.total += pay.value;
      if (!g.last || String(pay.date) > String(g.last)) { g.last = pay.date; g.lastValue = pay.value; g.plano = pay.plano; g.ciclo = pay.ciclo; }
    }
    const { data: tenants } = await admin.from("fidelidade_tenants").select("tenant, active");
    const { data: states } = await admin.from("fidelidade_state").select("tenant, data");
    const names: Record<string, string> = {};
    (states || []).forEach((s: any) => { names[s.tenant] = s.data?.settings?.brand?.name || s.tenant; });
    return json({ ok: true, days, byTenant, payments: payments.slice(0, 300), tenants: tenants || [], names });
  }

  // ---------- troca a chave de admin da fábrica ----------
  if (action === "change_key") {
    const nk = String(p.newKey || "").trim();
    if (nk.length < 10) return json({ ok: false, error: "chave_curta" }, 400);
    const { error } = await admin.from("fidelidade_admin").update({ admin_key: nk, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return json({ ok: false, error: "falha_troca" }, 500);
    return json({ ok: true });
  }

  return json({ ok: false, error: "acao_desconhecida" }, 400);
});
