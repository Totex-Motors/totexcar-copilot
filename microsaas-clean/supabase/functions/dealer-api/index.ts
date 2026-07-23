// TotexCar Co-pilot — Dealer API (Painel do Lojista)
// O lojista loga normalmente (Supabase auth). Esta função valida o JWT, confirma que o
// chamador é role='dealer' (ou 'admin') e ESCOPA tudo pela loja (dealership) dele — ele
// nunca enxerga clientes de outra loja. Reaproveita a lógica da função `integration`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendTemplate } from "../_shared/wa.ts";

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

// Consulta a placa no provedor configurado (mesma lógica do edge vehicle-lookup) para autopreencher o veículo.
// Best-effort: qualquer falha/ausência de config retorna null (o veículo é criado só com o que houver).
function flattenPlate(obj: any, out: Record<string, any> = {}): Record<string, any> {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flattenPlate(v, out);
    else { const key = k.toLowerCase().replace(/[^a-z0-9]/g, ""); if (out[key] == null && v != null && v !== "") out[key] = v; }
  }
  return out;
}
async function lookupPlate(placaRaw: string): Promise<Record<string, any> | null> {
  const placa = String(placaRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (placa.length < 7) return null;
  const { data: s } = await admin.from("app_settings").select("placa_api_url, placa_api_bearer, placa_api_device").eq("id", 1).single();
  const bearer = s?.placa_api_bearer || "";
  if (!bearer) return null;
  const cfgUrl = s?.placa_api_url || "";
  const isLegacy = /apibrasil|gateway/i.test(cfgUrl);
  try {
    let data: any = {};
    if (isLegacy) {
      const url = cfgUrl || "https://gateway.apibrasil.io/api/v2/vehicles/dados";
      const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` };
      if (s?.placa_api_device) headers["DeviceToken"] = s.placa_api_device;
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ placa }) });
      if (!res.ok) return null;
      data = await res.json().catch(() => ({}));
    } else {
      const base = (/puxaplaca/i.test(cfgUrl) ? cfgUrl : "https://api.puxaplaca.app").replace(/\/+$/, "");
      const res = await fetch(`${base}/v2/consulta/${encodeURIComponent(placa)}`, { headers: { token: bearer, Accept: "application/json" } });
      if (!res.ok) return null;
      data = await res.json().catch(() => ({}));
    }
    const flat = flattenPlate(data);
    const pick = (cands: string[]) => { for (const c of cands) { const key = c.toLowerCase().replace(/[^a-z0-9]/g, ""); if (flat[key] != null) return String(flat[key]); } return null; };
    const toInt = (v: string | null) => { const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };
    const tc = (v: string | null) => v ? v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : v;
    const veh = {
      marca: tc(pick(["marca", "fabricante", "marcamodelo"])),
      modelo: tc(pick(["modelo", "submodelo", "versao", "marcamodelo"])),
      ano_fabricacao: toInt(pick(["anofabricacao", "ano", "anofab"])),
      ano_modelo: toInt(pick(["anomodelo", "anomod", "ano"])),
      cor: tc(pick(["cor", "corveiculo"])),
      chassi: pick(["chassi", "chassis"]),
      renavam: pick(["renavam"]),
      combustivel: tc(pick(["combustivel", "tipocombustivel"])),
    };
    return Object.values(veh).some((v) => v != null) ? veh : null;
  } catch { return null; }
}

// Cria o veículo (accounts) do cliente provisionado — deixa a conta pronta pra usar (mais prático pra loja/admin).
// Idempotente: não duplica se o cliente já tiver um veículo ativo. Autopreenche pela placa quando informada.
async function provisionVehicle(userId: string, opts: { car: string | null; placa: string | null; valor: number | null; dataCompra: string | null }): Promise<boolean> {
  const { data: existing } = await admin.from("accounts").select("id").eq("user_id", userId).eq("is_active", true).limit(1);
  if (existing && existing.length) return false; // já tem carro: não mexe

  const placa = opts.placa ? String(opts.placa).toUpperCase().replace(/[^A-Z0-9]/g, "") : null;
  const enrich = placa ? await lookupPlate(placa) : null;
  const row: Record<string, unknown> = {
    user_id: userId,
    name: opts.car || (enrich ? [enrich.marca, enrich.modelo].filter(Boolean).join(" ") : "") || "Meu carro",
    type: "carro", is_active: true,
    placa: placa || null,
    valor_compra: opts.valor && opts.valor > 0 ? opts.valor : null,
    data_compra: opts.dataCompra || null,
    ...(enrich || {}),
  };
  const { error } = await admin.from("accounts").insert(row);
  if (error) { console.error("provisionVehicle:", error.message); return false; }
  return true;
}

// Provisiona (ou reaproveita) a conta do cliente como PREMIUM por 1 ano — cortesia patrocinada pela loja.
// Reaproveita o padrão do edge `integration` (provision_owner): email sintético telefone→@totexcarfinance.app.
// Idempotente por email: se a conta já existe, só a promove a premium/sponsored. Devolve o user_id.
async function provisionSponsoredOwner(phone: string, name: string | null, dealership: string, coupon: string | null): Promise<string> {
  const email = `${phone}@totexcarfinance.app`;
  const expires = new Date(); expires.setFullYear(expires.getFullYear() + 1);
  const premium = {
    name: name || "Proprietário", phone, email, role: "owner",
    dealership, coupon_code: coupon,
    plan: "premium", plan_cycle: "annual", subscription_status: "active",
    plan_expires_at: expires.toISOString(),
  };

  const { data: exist } = await admin.from("users").select("id").ilike("email", email).limit(1);
  if (exist && exist.length) {
    await admin.from("users").update(premium).eq("id", exist[0].id);
    return exist[0].id;
  }

  const password = crypto.randomUUID().slice(0, 12);
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name: name || "Proprietário", phone, email },
  });
  if (error) throw error;
  const id = created.user!.id;
  await admin.from("users").update(premium).eq("id", id);
  return id;
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
  // Para AÇÕES DE ESCRITA (criar/config/transferência) o admin sem loja escolhida cai na PRÓPRIA loja
  // (evita "sem_loja" quando o dono-admin opera o painel da própria loja sem ?dealership=). Leitura não muda.
  const writeStore = (scopeDealership && scopeDealership !== "__none__") ? scopeDealership : (isAdmin ? (me.dealership || null) : null);

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

        const wa = await loadWaSettings(admin);

        const list = await recipientsFor(admin, isAdmin ? (p.dealership || null) : me.dealership, audience, p.client_id);
        if (!list.length) return json({ ok: true, total: 0, sent: 0, failed: 0, results: [] });

        const results: any[] = [];
        let sent = 0, failed = 0;
        const lojaCamp = (isAdmin ? (p.dealership || me.dealership) : me.dealership) || "sua loja";
        for (const c of list) {
          // campanha = MARKETING iniciado pelo negócio → template campanha_loja na API oficial
          const txt = personalize(message, c);
          const primeiro = (c.name || "").split(" ")[0] || "tudo bem";
          const ok = await waSendTemplate(wa, c.phone, "campanha_loja", [primeiro, lojaCamp, txt]);
          if (ok) sent++; else failed++;
          results.push({ id: c.id, name: c.name, phone: c.phone, ok });
          await new Promise((r) => setTimeout(r, 350)); // pacing entre envios
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
        if (!writeStore) return json({ error: "sem_loja" }, 400);
        const { error } = await admin.from("dealership_settings").upsert({
          dealership: writeStore,
          google_review_url: p.google_review_url ? String(p.google_review_url).trim() : null,
          nps_delay_days: Number(p.nps_delay_days) > 0 ? Number(p.nps_delay_days) : 3,
          updated_at: new Date().toISOString(),
        }, { onConflict: "dealership" });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // ===================== SELO TOTEX (Fase 4) =====================
      // Programa por ADESÃO: sem aderir, nenhum cliente da loja vê o Selo (regra do dono).
      case "selo_status": {
        const { data: cfg } = await admin.from("dealership_settings")
          .select("selo_aderido, selo_aderido_em, selo_aderido_por").eq("dealership", scopeDealership).maybeSingle();
        const { data: s } = await admin.from("app_settings")
          .select("selo_bronze_fipe_min, selo_prata_fipe_min, selo_ouro_fipe_min, selo_ouro_fipe_max").eq("id", 1).single();
        return json({
          ok: true, aderido: !!cfg?.selo_aderido, aderido_em: cfg?.selo_aderido_em || null, aderido_por: cfg?.selo_aderido_por || null,
          faixas: {
            bronze: Math.round((Number(s?.selo_bronze_fipe_min) || 0.82) * 100),
            prata: Math.round((Number(s?.selo_prata_fipe_min) || 0.85) * 100),
            ouro_min: Math.round((Number(s?.selo_ouro_fipe_min) || 0.87) * 100),
            ouro_max: Math.round((Number(s?.selo_ouro_fipe_max) || 0.90) * 100),
          },
        });
      }

      case "selo_aderir": {
        if (!writeStore) return json({ error: "sem_loja" }, 400);
        const aderir = p.aderir !== false;
        const { error } = await admin.from("dealership_settings").upsert({
          dealership: writeStore,
          selo_aderido: aderir,
          selo_aderido_em: aderir ? new Date().toISOString() : null,
          selo_aderido_por: me.name || me.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "dealership" });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, aderido: aderir });
      }

      case "selo_carteira": {
        if (!scopeDealership) return json({ error: "sem_loja" }, 400);
        const { data: clientes } = await admin.from("users")
          .select("id, name, phone, care_score, care_tier, care_tier_at, driver_mode")
          .eq("dealership", scopeDealership).eq("role", "owner");
        const resumo = { ouro: 0, prata: 0, bronze: 0, sem_selo: 0 };
        for (const c of (clientes || [])) {
          const t = String(c.care_tier || "none");
          if (t === "ouro") resumo.ouro++; else if (t === "prata") resumo.prata++;
          else if (t === "bronze") resumo.bronze++; else resumo.sem_selo++;
        }
        // "Prontos para troca": Prata/Ouro (lead quente — cuidou do carro e tem garantia a usar)
        const quentes = (clientes || []).filter((c: any) => ["prata", "ouro"].includes(String(c.care_tier)));
        const ids = quentes.map((c: any) => c.id);
        let veiculos: Record<string, any> = {};
        if (ids.length) {
          const { data: accs } = await admin.from("accounts")
            .select("user_id, marca, modelo, ano_modelo, hodometro").in("user_id", ids).eq("is_active", true);
          (accs || []).forEach((a: any) => { veiculos[a.user_id] = a; });
        }
        return json({
          ok: true, total: (clientes || []).length, resumo,
          prontos: quentes.map((c: any) => ({
            id: c.id, name: c.name, phone: c.phone, selo: c.care_tier, score: c.care_score,
            selo_desde: c.care_tier_at ? String(c.care_tier_at).split("T")[0] : null,
            veiculo: veiculos[c.id] ? `${veiculos[c.id].marca || ""} ${veiculos[c.id].modelo || ""}`.trim() : null,
            km: veiculos[c.id]?.hodometro || null,
          })),
        });
      }

      case "postsale_create": {
        if (!writeStore) return json({ error: "sem_loja" }, 400);
        const loja = writeStore;
        const phone = String(p.customer_phone || "").replace(/\D/g, "");
        if (phone.length < 10) return json({ error: "telefone_invalido" }, 400);
        const name = String(p.customer_name || "").trim() || null;
        const car = String(p.car_desc || "").trim() || null;
        const purchase = /^\d{4}-\d{2}-\d{2}$/.test(String(p.purchase_date)) ? p.purchase_date : new Date().toISOString().split("T")[0];
        const cortesia = p.cortesia === true || p.cortesia === "true";
        const placa = String(p.placa || "").trim() || null;
        const valorCompra = Number(p.valor_compra) > 0 ? Number(p.valor_compra) : null;

        const { data: cps } = await admin.from("coupons").select("code").eq("dealership", loja).eq("active", true).limit(1);
        const coupon = cps?.[0]?.code || null;

        // Cortesia da loja (assinatura patrocinada): PROVISIONA a conta premium por 1 ano por conta da loja (pós-pago).
        let provisionedUserId: string | null = null;
        let vehicleCreated = false;
        if (cortesia) {
          try { provisionedUserId = await provisionSponsoredOwner(phone, name, loja, coupon); }
          catch (e) { return json({ error: "provisionamento_falhou", detail: String((e as any)?.message || e) }, 400); }
          // Já deixa o veículo cadastrado (autopreenche pela placa quando houver) — mais prático pra loja/admin.
          try { vehicleCreated = await provisionVehicle(provisionedUserId, { car, placa, valor: valorCompra, dataCompra: purchase }); }
          catch (e) { console.error("provisionVehicle falhou:", e); }
        }

        const { data: created, error } = await admin.from("postsale_journeys").insert({
          dealership: loja, customer_name: name, customer_phone: phone, car_desc: car,
          purchase_date: purchase, coupon_code: coupon, created_by: me.id,
          sponsored: cortesia, sponsored_value: cortesia ? 109.90 : 0,
          sponsored_at: cortesia ? new Date().toISOString() : null,
          user_id: provisionedUserId,
        }).select("id").single();
        if (error) return json({ error: error.message }, 400);

        // Boas-vindas + convite pra ativar o Co-pilot com o bônus da loja (semi-automático).
        // Iniciado pelo negócio → TEMPLATE na API oficial (cortesia = utilidade; convite bônus = marketing).
        const { data: st } = await admin.from("app_settings").select("app_url").eq("id", 1).single();
        const appUrl = (st?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
        const link = `${appUrl}/entrar?tab=register${coupon ? `&coupon=${encodeURIComponent(coupon)}` : ""}`;
        const primeiro = name ? name.split(" ")[0] : "tudo bem";
        const wa = await loadWaSettings(admin);
        let welcome = false;
        try {
          welcome = cortesia
            ? await waSendTemplate(wa, phone, "boas_vindas_cortesia", [primeiro, car || "carro", loja])
            : await waSendTemplate(wa, phone, "convite_copilot_loja", [primeiro, car ? `seu ${car}` : "seu carro", loja, link]);
        } catch { /* WhatsApp off: cria a jornada mesmo assim */ }
        if (welcome) await admin.from("postsale_journeys").update({ welcome_sent: true }).eq("id", created.id);
        return json({ ok: true, id: created.id, welcome_sent: welcome, sponsored: cortesia, user_id: provisionedUserId, vehicle_created: vehicleCreated });
      }

      case "postsale_transfer_save": {
        if (!writeStore) return json({ error: "sem_loja" }, 400);
        const loja = writeStore;
        const id = String(p.id || "");
        if (!id) return json({ error: "id_obrigatorio" }, 400);
        const { data: j } = await admin.from("postsale_journeys").select("*").eq("id", id).eq("dealership", loja).maybeSingle();
        if (!j) return json({ error: "jornada_nao_encontrada" }, 404);

        const upd: Record<string, unknown> = {};
        if (p.transfer && typeof p.transfer === "object") upd.transfer = p.transfer;
        if (p.transfer_status) upd.transfer_status = String(p.transfer_status);
        if ("warranty_until" in p) upd.warranty_until = /^\d{4}-\d{2}-\d{2}$/.test(String(p.warranty_until)) ? p.warranty_until : null;
        if ("revisao_proxima" in p) upd.revisao_proxima = /^\d{4}-\d{2}-\d{2}$/.test(String(p.revisao_proxima)) ? p.revisao_proxima : null;

        // ao CONCLUIR a transferência, avisa o cliente (uma vez)
        const concluindo = upd.transfer_status === "concluida" && j.transfer_status !== "concluida" && !j.transfer_done_notified;
        const { error } = await admin.from("postsale_journeys").update(upd).eq("id", id);
        if (error) return json({ error: error.message }, 400);

        if (concluindo) {
          try {
            const wa = await loadWaSettings(admin);
            const nome = j.customer_name ? String(j.customer_name).split(" ")[0] : "tudo bem";
            const ok = await waSendTemplate(wa, String(j.customer_phone).replace(/\D/g, ""), "transferencia_concluida", [nome, j.car_desc || "carro", loja]);
            if (ok) await admin.from("postsale_journeys").update({ transfer_done_notified: true }).eq("id", id);
          } catch { /* WhatsApp off */ }
        }
        return json({ ok: true, notificado: concluindo });
      }

      case "postsale_list": {
        let q = admin.from("postsale_journeys").select("*").order("created_at", { ascending: false });
        if (scopeDealership && scopeDealership !== "__none__") q = q.eq("dealership", scopeDealership);
        const { data } = await q.limit(Number(p.limit) || 300);
        return json({ ok: true, journeys: data || [] });
      }

      case "postsale_stats": {
        let q = admin.from("postsale_journeys").select("nps_score, sponsored, sponsored_value, sponsor_settled");
        if (scopeDealership && scopeDealership !== "__none__") q = q.eq("dealership", scopeDealership);
        const { data } = await q;
        const rows = data || [];
        const scored = rows.filter((r: any) => r.nps_score != null);
        const prom = scored.filter((r: any) => r.nps_score >= 9).length;
        const det = scored.filter((r: any) => r.nps_score <= 6).length;
        const pas = scored.length - prom - det;
        const nps = scored.length ? Math.round(((prom - det) / scored.length) * 100) : null;
        // Cortesias patrocinadas pela loja ainda não quitadas (saldo devedor da loja)
        const cortesias = rows.filter((r: any) => r.sponsored && !r.sponsor_settled);
        const cortesias_valor = cortesias.reduce((s: number, r: any) => s + Number(r.sponsored_value || 0), 0);
        return json({
          ok: true, total: rows.length, respondidos: scored.length, promotores: prom, passivos: pas, detratores: det, nps,
          cortesias_ativas: cortesias.length, cortesias_valor: Number(cortesias_valor.toFixed(2)),
        });
      }

      // Saldo devedor de cortesias por loja (admin) — patrocínios ainda não quitados
      case "postsale_sponsor_balance": {
        if (!isAdmin) return json({ error: "forbidden" }, 403);
        const { data } = await admin.from("postsale_journeys")
          .select("dealership, sponsored_value, sponsored_at, customer_name, customer_phone")
          .eq("sponsored", true).eq("sponsor_settled", false);
        const byLoja: Record<string, { dealership: string; count: number; total: number }> = {};
        (data || []).forEach((r: any) => {
          const k = r.dealership || "—";
          const cur = byLoja[k] || (byLoja[k] = { dealership: k, count: 0, total: 0 });
          cur.count++; cur.total += Number(r.sponsored_value || 0);
        });
        const lojas = Object.values(byLoja)
          .map((l) => ({ ...l, total: Number(l.total.toFixed(2)) }))
          .sort((a, b) => b.total - a.total);
        const total = lojas.reduce((s, l) => s + l.total, 0);
        return json({ ok: true, lojas, total: Number(total.toFixed(2)) });
      }

      // Marca as cortesias de uma loja como quitadas (admin) — a loja acertou o pós-pago
      case "postsale_sponsor_settle": {
        if (!isAdmin) return json({ error: "forbidden" }, 403);
        const loja = String(p.dealership || "").trim();
        if (!loja) return json({ error: "dealership_obrigatorio" }, 400);
        const { data, error } = await admin.from("postsale_journeys")
          .update({ sponsor_settled: true, sponsor_settled_at: new Date().toISOString() })
          .eq("dealership", loja).eq("sponsored", true).eq("sponsor_settled", false)
          .select("id");
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, quitadas: (data || []).length });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
