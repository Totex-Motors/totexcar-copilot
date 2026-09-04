// TotexCar Co-pilot — Dealer API (Painel do Lojista)
// O lojista loga normalmente (Supabase auth). Esta função valida o JWT, confirma que o
// chamador é role='dealer' (ou 'admin') e ESCOPA tudo pela loja (dealership) dele — ele
// nunca enxerga clientes de outra loja. Reaproveita a lógica da função `integration`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendTemplate } from "../_shared/wa.ts";
import { kitUrlFor, KIT_FILENAME } from "../_shared/kit.ts";

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
// Variantes do telefone (com/sem DDI 55) — whatsapp_events grava from_phone como vem da Meta
function phoneVariants(phone: any): string[] {
  const d = onlyDigits(phone);
  if (d.length < 10) return [];
  const set = new Set<string>([d]);
  if (d.startsWith("55")) set.add(d.slice(2)); else set.add("55" + d);
  return [...set];
}
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

// Chama o provedor de IA configurado com um par sistema/usuário qualquer (texto puro)
async function aiText(settings: any, sys: string, user: string, maxTokens = 400): Promise<string> {
  const provider = settings?.ai_provider || "anthropic";
  const model = settings?.ai_model || "claude-opus-4-8";
  const key = provider === "openai" ? settings?.openai_api_key
    : provider === "gemini" ? settings?.gemini_api_key : settings?.anthropic_api_key;
  if (!key) throw new Error("ai_key_not_configured");

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
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
    body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return ((j.content || []).find((b: any) => b.type === "text")?.text || "").trim();
}

// Gera um rascunho de mensagem de WhatsApp pros clientes da loja (usa aiText)
async function aiDraft(settings: any, brief: string, storeName: string): Promise<string> {
  const sys = `Você escreve mensagens curtas de WhatsApp para uma loja de carros chamada "${storeName || "a loja"}" `
    + `enviar aos clientes dela (donos de carro). Tom cordial, brasileiro, direto, no máximo 4 linhas, 1 emoji no máximo. `
    + `Use EXATAMENTE estas variáveis quando fizer sentido (serão trocadas depois): {nome}, {veiculo}, {placa}, {vencimento}, {dias}, {loja}. `
    + `Não invente dados nem coloque colchetes além dessas variáveis. Responda SOMENTE com o texto da mensagem.`;
  return aiText(settings, sys, `Objetivo da mensagem: ${brief}`);
}

// "Toyota Corolla Corolla Cross XRX" → "Toyota Corolla Cross XRX" (a versão muitas vezes repete o modelo)
function carNome(v: any): string {
  const brand = String(v?.brand || "").trim(), model = String(v?.model || "").trim(), ver = String(v?.version || "").trim();
  const dup = model && ver.toLowerCase().startsWith(model.toLowerCase());
  return [brand, dup ? "" : model, ver].filter(Boolean).join(" ").trim();
}

const codeAlfabeto = "abcdefghijklmnopqrstuvwxyz0123456789";
const novoCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => codeAlfabeto[b % 36]).join("");

// garante um code curto (/o/<code>) por carro — reusa o existente, cria os que faltarem
async function ofertaCodes(carIds: string[]): Promise<Record<string, string>> {
  const byCar: Record<string, string> = {};
  if (!carIds.length) return byCar;
  try {
    const { data: ex } = await admin.from("oferta_links").select("code, car_id").in("car_id", carIds);
    (ex || []).forEach((r: any) => { if (!byCar[r.car_id]) byCar[r.car_id] = r.code; });
    const faltam = carIds.filter((id) => !byCar[id]).map((id) => ({ code: novoCode(), car_id: id }));
    if (faltam.length) {
      const { error } = await admin.from("oferta_links").insert(faltam);
      if (!error) faltam.forEach((f) => { byCar[f.car_id] = f.code; });
    }
  } catch { /* sem code → quem chamar cai no link longo */ }
  return byCar;
}

// Monta a lista de destinatários (enriquecida) de uma loja, conforme o público escolhido
async function recipientsFor(adminClient: any, dealership: string | null, audience: string, clientId?: string, clientIds?: string[]) {
  let q = adminClient.from("users")
    .select("id, name, phone, dealership, cnh_vencimento, plan, subscription_status")
    .eq("role", "owner");
  if (dealership) q = q.eq("dealership", dealership);
  if (audience === "single" && clientId) q = q.eq("id", clientId);
  if (audience === "selected") {
    // seleção manual do lojista — o filtro de dealership acima continua valendo (não vaza outra loja)
    const ids = (clientIds || []).map(String).filter(Boolean).slice(0, 500);
    if (!ids.length) return [];
    q = q.in("id", ids);
  }
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

      // FUNIL DO STAND da loja do lojista (por promotor). O stand usa SLUG; a loja é por NOME →
      // resolve nome→slug no marketplace. Admin sem escopo vê tudo; com ?dealership= filtra por nome.
      case "stand_report": {
        const alvoNome = scopeDealership && scopeDealership !== "__none__" ? scopeDealership : (isAdmin ? null : me.dealership);
        let slug: string | null = null;
        if (alvoNome) {
          try {
            const res = await fetch(`${Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com"}/api/dealerships`, { headers: { Accept: "application/json" } });
            const d = await res.json();
            const list = Array.isArray(d) ? d : (d?.data || []);
            const norm = (s: any) => String(s || "").trim().toLowerCase();
            const hit = list.find((x: any) => norm(x.name) === norm(alvoNome) || norm(x.slug) === norm(alvoNome));
            slug = hit?.slug ? String(hit.slug).toLowerCase() : null;
            if (!slug) return json({ ok: true, dealership: alvoNome, matched: false, rows: [] });
          } catch { return json({ ok: true, dealership: alvoNome, rows: [] }); }
        }
        const { data, error } = await admin.rpc("stand_report", { p_loja: slug });
        if (error) throw error;
        return json({ ok: true, dealership: alvoNome, slug, rows: data || [] });
      }

      // LISTA de leads individuais da loja do lojista (nome + contato) pra exportar/campanha
      case "stand_leads": {
        const alvoNome = scopeDealership && scopeDealership !== "__none__" ? scopeDealership : (isAdmin ? null : me.dealership);
        let slug: string | null = null;
        if (alvoNome) {
          try {
            const res = await fetch(`${Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com"}/api/dealerships`, { headers: { Accept: "application/json" } });
            const d = await res.json();
            const list = Array.isArray(d) ? d : (d?.data || []);
            const norm = (s: any) => String(s || "").trim().toLowerCase();
            const hit = list.find((x: any) => norm(x.name) === norm(alvoNome) || norm(x.slug) === norm(alvoNome));
            slug = hit?.slug ? String(hit.slug).toLowerCase() : null;
            if (!slug) return json({ ok: true, dealership: alvoNome, leads: [] });
          } catch { return json({ ok: true, dealership: alvoNome, leads: [] }); }
        }
        const { data, error } = await admin.rpc("stand_leads", { p_loja: slug });
        if (error) throw error;
        return json({ ok: true, dealership: alvoNome, slug, leads: data || [] });
      }

      // KIT DE QR POR CARRO: resolve slug+id da loja e devolve o estoque dela pra montar 1 QR/veículo
      case "stand_qr_kit": {
        const alvoNome = scopeDealership && scopeDealership !== "__none__" ? scopeDealership : (isAdmin ? (p.dealership ? String(p.dealership) : me.dealership) : me.dealership);
        if (!alvoNome) return json({ error: "sem_loja" }, 400);
        const MKT = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
        let slug: string | null = null, dealerId: string | null = null, lojaNome = alvoNome;
        try {
          const res = await fetch(`${MKT}/api/dealerships`, { headers: { Accept: "application/json" } });
          const d = await res.json();
          const list = Array.isArray(d) ? d : (d?.data || []);
          const norm = (s: any) => String(s || "").trim().toLowerCase();
          const hit = list.find((x: any) => norm(x.name) === norm(alvoNome) || norm(x.slug) === norm(alvoNome));
          if (!hit) return json({ ok: true, matched: false, cars: [] });
          slug = String(hit.slug).toLowerCase(); dealerId = hit.id; lojaNome = hit.name || alvoNome;
        } catch { return json({ error: "marketplace_indisponivel" }, 502); }
        // estoque da loja (até 200)
        let cars: any[] = [];
        try {
          const u = new URL(`${MKT}/api/vehicles`);
          u.searchParams.set("dealershipId", dealerId!); u.searchParams.set("limit", "200");
          const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
          const d = await res.json();
          const arr = Array.isArray(d?.data) ? d.data : [];
          cars = arr.map((v: any) => {
            const imgs = Array.isArray(v.images) ? v.images : [];
            const img = (imgs.find((i: any) => i?.isPrimary) || imgs[0])?.url || "";
            return { id: v.id, brand: v.brand, model: v.model, version: v.version, year: v.year, price: v.price, photo: img };
          });
        } catch { /* devolve vazio */ }
        // code curto por carro → o painel monta o link bonito /o/<code> (sem "supabase" na cara)
        const codes = await ofertaCodes(cars.map((c: any) => c.id));
        cars = cars.map((c: any) => ({ ...c, code: codes[c.id] || null }));
        return json({ ok: true, slug, loja_nome: lojaNome, wa_number: "5511963786699", cars });
      }

      // POST PRONTO PRO CANAL: legenda animada (estilo "Lu do Magalu") pra colar junto da foto.
      // Anti-preço-inventado por DESENHO: a IA escreve só a parte criativa a partir de fatos reais
      // do anúncio e NUNCA recebe o preço; preço e link entram por código, copiados do marketplace.
      case "canal_post": {
        const carId = String(p.car || "").trim();
        if (!carId) return json({ error: "car_required" }, 400);
        const MKT = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
        let v: any = null;
        try {
          const res = await fetch(`${MKT}/api/vehicles/${encodeURIComponent(carId)}`, { headers: { Accept: "application/json" } });
          if (res.ok) v = await res.json();
        } catch { /* v fica nulo */ }
        if (!v?.id) return json({ error: "carro_nao_encontrado" }, 404);

        const nome = carNome(v) || "esse carro";
        const nomeAno = `${nome}${v.year ? ` ${v.year}` : ""}`;
        const precoNum = Number(v.price);
        const preco = precoNum > 0 ? `R$ ${precoNum.toLocaleString("pt-BR")}` : "";
        const loja = v?.dealership?.name || me.dealership || "";
        // link CURTO no domínio do app (/o/<code>) — nada de "supabase" nem código gigante na cara do cliente
        const { data: stApp } = await admin.from("app_settings").select("app_url").eq("id", 1).single();
        const appUrl = (stApp?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
        const codeMap = await ofertaCodes([carId]);
        const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
        const link = codeMap[carId] ? `${appUrl}/o/${codeMap[carId]}` : `${base}/functions/v1/oferta?c=${encodeURIComponent(carId)}`;

        // fatos verificados do anúncio (SEM preço) — é só com isso que a IA pode trabalhar
        const fatos: string[] = [`Carro: ${nomeAno}`];
        if (Number(v.mileage) > 0) fatos.push(`Quilometragem: ${Number(v.mileage).toLocaleString("pt-BR")} km`);
        if (v.transmission) fatos.push(`Câmbio: ${v.transmission}`);
        if (v.fuel || v.fuelType) fatos.push(`Combustível: ${v.fuel || v.fuelType}`);
        if (v.color) fatos.push(`Cor: ${v.color}`);
        const fipeNum = Number(v.fipePrice);
        const abaixoFipe = fipeNum > 0 && precoNum > 0 && precoNum < fipeNum;
        if (abaixoFipe) fatos.push("Está anunciado ABAIXO da tabela FIPE");

        const sys = `Você é a alma da TotexMotors! Seu estilo é inspirado na Lu do Magalu: sempre útil, muito animada, `
          + `usa emojis de forma inteligente e trata o cliente como um amigo próximo. Você não vende só carros; vende a `
          + `realização de um sonho e a segurança de uma grande marca.\n\n`
          + `Escreva SÓ o corpo criativo de um post de Canal do WhatsApp sobre o carro dos FATOS, exatamente nesta estrutura `
          + `(sem preço, sem link, sem hashtags — o sistema completa depois):\n`
          + `- 1 linha de abertura magnética (ex.: "Gente, para tudo e olha essa nave! 🚀")\n`
          + `- 1 a 2 linhas apresentando o carro com entusiasmo (modelo e ano)\n`
          + `- a linha "Confira por que ele vai ser seu:" seguida de 3 itens começando com ✅, cada um transformando um fato `
          + `em benefício real (ex.: câmbio automático → conforto total no trânsito)\n`
          + `- 1 linha final: toda a confiança da TotexMotors com a tradição da ${loja || "loja parceira"} 💎\n\n`
          + `REGRAS DURAS: use SOMENTE os fatos fornecidos — NUNCA invente motor, equipamento, consumo ou qualquer número. `
          + `Se faltar fato técnico, os ✅ podem falar de procedência verificada, atendimento premium e de ver tudo pelo WhatsApp. `
          + `NUNCA mencione preço nem valores em R$. Responda SOMENTE com o texto do post.`;

        let corpo = "";
        try {
          const { data: settings } = await admin.from("app_settings")
            .select("ai_provider, ai_model, anthropic_api_key, openai_api_key, gemini_api_key").eq("id", 1).single();
          corpo = await aiText(settings, sys, `FATOS DO ANÚNCIO:\n${fatos.join("\n")}`, 600);
        } catch (e) { console.error("canal_post ai:", e); }
        // cinto e suspensório: se mesmo assim vier linha com valor em R$, ela cai fora
        corpo = corpo.split("\n").filter((l) => !/R\$\s*\d/.test(l)).join("\n").trim();

        if (!corpo) {
          // sem IA configurada (ou falhou): modelo fixo com os mesmos fatos reais
          const bullets: string[] = [];
          if (abaixoFipe) bullets.push("✅ Anunciado ABAIXO da tabela FIPE — oportunidade de verdade");
          if (Number(v.mileage) > 0) bullets.push(`✅ ${Number(v.mileage).toLocaleString("pt-BR")} km — ainda tem muita estrada boa pela frente`);
          if (v.transmission && /auto/i.test(String(v.transmission))) bullets.push("✅ Câmbio automático: conforto total no trânsito de todo dia");
          bullets.push("✅ Procedência verificada e atendimento premium", "✅ Você vê tudo pelo WhatsApp, sem sair de casa");
          corpo = `Gente, para tudo e olha essa nave! 🚀\n`
            + `Chegou ${nomeAno} no nosso estoque — daqueles que não ficam parados na vitrine!\n\n`
            + `Confira por que ele vai ser seu:\n${bullets.slice(0, 3).join("\n")}\n\n`
            + `Toda a confiança da TotexMotors com a tradição da ${loja || "nossa loja parceira"}! 💎`;
        }

        const marcaTag = v.brand ? ` #${String(v.brand).replace(/[^\p{L}\p{N}]/gu, "")}` : "";
        const post = corpo
          + (preco ? `\n\n💰 Por apenas: ${preco}` : "")
          + `\n\nNão perde tempo, gente! Toca no link e é só apertar *enviar* na mensagem que já vem prontinha — te mostro tudo desse carro no WhatsApp 😉\n👉 ${link}`
          + `\n\n#TotexMotors #CarroDosSonhos #OfertaDaSemana${marcaTag}`;
        const foto = (Array.isArray(v.images) ? (v.images.find((i: any) => i?.isPrimary) || v.images[0])?.url : "") || null;
        return json({ ok: true, post, preco: preco || null, link, foto });
      }

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

      // ===================== CONVERSAS (visibilidade do WhatsApp, somente leitura) =====================
      // A loja vê o ENGAJAMENTO do cliente com o Co-pilot (mandou msg? recebeu? falhou?), mas NUNCA o
      // conteúdo do que o cliente escreveu — a conversa dele é com o assistente (privacidade/LGPD).
      case "conversas_list": {
        let q = admin.from("users")
          .select("id, name, phone, plan, subscription_status, dealership, created_at")
          .eq("role", "owner").order("created_at", { ascending: false });
        if (scopeDealership) q = q.eq("dealership", scopeDealership);
        const { data: owners } = await q.limit(500);
        const ids = (owners || []).map((o: any) => o.id);
        if (!ids.length) return json({ ok: true, clients: [] });

        const desde90 = new Date(Date.now() - 90 * 86400000).toISOString();
        const desde30 = new Date(Date.now() - 30 * 86400000).toISOString();
        const ownerByPhone: Record<string, string> = {};
        const variants: string[] = [];
        for (const o of owners || []) {
          for (const v of phoneVariants(o.phone)) { variants.push(v); ownerByPhone[v] = o.id; }
        }

        // eventos com user_id + eventos só com telefone (ex.: status_fail não tem user_id)
        const [r1, r2] = await Promise.all([
          admin.from("whatsapp_events").select("user_id, from_phone, kind, status, created_at")
            .in("user_id", ids).gte("created_at", desde90).limit(5000),
          variants.length
            ? admin.from("whatsapp_events").select("user_id, from_phone, kind, status, created_at")
              .in("from_phone", variants).is("user_id", null).gte("created_at", desde90).limit(5000)
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const INBOUND = ["text", "audio", "image", "pdf", "other"];
        const DESCARTA = ["blocked", "superseded", "aggregated"];
        const agg: Record<string, any> = {};
        const bump = (uid: string, e: any) => {
          const a = agg[uid] || (agg[uid] = { last_in: null, in30: 0, last_out: null, fails30: 0 });
          if (e.kind === "status_fail") { if (e.created_at >= desde30) a.fails30++; return; }
          if (DESCARTA.includes(String(e.status))) return;
          if (INBOUND.includes(String(e.kind))) {
            if (!a.last_in || e.created_at > a.last_in) a.last_in = e.created_at;
            if (e.created_at >= desde30) a.in30++;
          } else if (["proativo", "campanha", "boas_vindas"].includes(String(e.kind))) {
            if (!a.last_out || e.created_at > a.last_out) a.last_out = e.created_at;
          }
        };
        (r1.data || []).forEach((e: any) => bump(e.user_id, e));
        (r2.data || []).forEach((e: any) => {
          const uid = ownerByPhone[onlyDigits(e.from_phone)];
          if (uid) bump(uid, e);
        });

        // boas-vindas/NPS do pós-venda (welcome_sent mora em postsale_journeys)
        let jq = admin.from("postsale_journeys")
          .select("user_id, customer_phone, welcome_sent, sponsored, nps_score");
        if (scopeDealership && scopeDealership !== "__none__") jq = jq.eq("dealership", scopeDealership);
        const { data: js } = await jq.limit(1000);
        const jByKey: Record<string, any> = {};
        (js || []).forEach((j: any) => {
          if (j.user_id) jByKey[j.user_id] = j;
          for (const v of phoneVariants(j.customer_phone)) {
            const uid = ownerByPhone[v];
            if (uid && !jByKey[uid]) jByKey[uid] = j;
          }
        });

        const clients = (owners || []).map((o: any) => {
          const a = agg[o.id] || { last_in: null, in30: 0, last_out: null, fails30: 0 };
          const j = jByKey[o.id] || null;
          return {
            id: o.id, name: o.name, phone: o.phone,
            plan: o.plan, subscription_status: o.subscription_status, created_at: o.created_at,
            last_client_msg_at: a.last_in, msgs_30d: a.in30,
            last_sent_at: a.last_out, fails_30d: a.fails30,
            welcome_sent: !!j?.welcome_sent, sponsored: !!j?.sponsored,
            nps_score: j?.nps_score ?? null,
          };
        });
        return json({ ok: true, dealership: scopeDealership, clients });
      }

      case "conversa_timeline": {
        const { user_id } = p;
        if (!user_id) return json({ error: "user_id_required" }, 400);
        const { data: ow } = await admin.from("users")
          .select("id, name, phone, dealership, created_at").eq("id", user_id).limit(1);
        const owner = ow?.[0];
        if (!owner) return json({ ok: true, owner: null, items: [] });
        // ESCOPO: lojista só acessa cliente da própria loja
        if (!isAdmin && owner.dealership !== me.dealership) return json({ error: "forbidden" }, 403);

        const variants = phoneVariants(owner.phone);
        const orExpr = [
          `user_id.eq.${owner.id}`,
          ...(variants.length ? [`from_phone.in.(${variants.join(",")})`] : []),
        ].join(",");
        const { data: evs } = await admin.from("whatsapp_events")
          .select("id, kind, status, parsed, created_at")
          .or(orExpr)
          .order("created_at", { ascending: false }).limit(300);

        const DESCARTA = ["blocked", "superseded", "aggregated"];
        const items: any[] = [];
        for (const e of (evs || [])) {
          const st = String(e.status || "");
          if (e.kind === "status_evt" || DESCARTA.includes(st)) continue;
          if (e.kind === "status_fail") { items.push({ at: e.created_at, type: "falha" }); continue; }
          if (e.kind === "proativo") { items.push({ at: e.created_at, type: "proativa", assunto: e.parsed?.assunto || null, texto: e.parsed?.texto || null }); continue; }
          if (e.kind === "campanha") { items.push({ at: e.created_at, type: "campanha", texto: e.parsed?.texto || null, ok: st === "sent" }); continue; }
          if (e.kind === "boas_vindas") { items.push({ at: e.created_at, type: "boas_vindas", ok: st === "sent", cortesia: !!e.parsed?.cortesia }); continue; }
          // entrada do cliente: só TIPO e AÇÃO — nunca o conteúdo
          items.push({ at: e.created_at, type: "cliente", kind: e.kind, acao: e.parsed?.action || null });
        }

        // marcos do pós-venda (registro na loja, NPS)
        if (owner.dealership) {
          const jOr = [
            `user_id.eq.${owner.id}`,
            ...(variants.length ? [`customer_phone.in.(${variants.join(",")})`] : []),
          ].join(",");
          const { data: js } = await admin.from("postsale_journeys")
            .select("created_at, sponsored, welcome_sent, car_desc, nps_score, nps_at, nps_comment")
            .eq("dealership", owner.dealership).or(jOr).limit(5);
          for (const j of (js || [])) {
            items.push({ at: j.created_at, type: "registro", cortesia: !!j.sponsored, welcome: !!j.welcome_sent, car: j.car_desc || null });
            if (j.nps_at) items.push({ at: j.nps_at, type: "nps", nota: j.nps_score, comentario: j.nps_comment || null });
          }
        }

        items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
        return json({
          ok: true,
          owner: { id: owner.id, name: owner.name, phone: owner.phone, created_at: owner.created_at },
          items,
        });
      }

      // Painel do Lojista — Campanhas (WhatsApp)
      case "campaign_recipients": {
        const audience = String(p.audience || "all");
        const list = await recipientsFor(admin, isAdmin ? (p.dealership || null) : me.dealership, audience, p.client_id, p.client_ids);
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

        const list = await recipientsFor(admin, isAdmin ? (p.dealership || null) : me.dealership, audience, p.client_id, p.client_ids);
        if (!list.length) return json({ ok: true, total: 0, sent: 0, failed: 0, results: [] });

        const results: any[] = [];
        const evRows: any[] = [];
        let sent = 0, failed = 0;
        const lojaCamp = (isAdmin ? (p.dealership || me.dealership) : me.dealership) || "sua loja";
        for (const c of list) {
          // campanha = MARKETING iniciado pelo negócio → template campanha_loja na API oficial
          const txt = personalize(message, c);
          const primeiro = (c.name || "").split(" ")[0] || "tudo bem";
          const ok = await waSendTemplate(wa, c.phone, "campanha_loja", [primeiro, lojaCamp, txt]);
          if (ok) sent++; else failed++;
          results.push({ id: c.id, name: c.name, phone: c.phone, ok });
          evRows.push({
            from_phone: onlyDigits(c.phone), user_id: c.id, kind: "campanha",
            status: ok ? "sent" : "error",
            raw: { campanha: true, loja: lojaCamp, por: me.id, audience },
            parsed: { texto: txt, assunto: "campanha_loja" },
          });
          await new Promise((r) => setTimeout(r, 350)); // pacing entre envios
        }
        if (evRows.length) await admin.from("whatsapp_events").insert(evRows); // alimenta a aba Conversas
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
        let kitEnviado = false;
        try {
          if (cortesia) {
            // 1º tenta a boas-vindas com o KIT em PDF anexado (header DOCUMENT); se o template
            // ainda não estiver aprovado (ou falhar), cai na versão texto — nada quebra.
            const kitUrl = await kitUrlFor(appUrl, loja); // personalizado da loja, ou o genérico
            welcome = await waSendTemplate(wa, phone, "boas_vindas_cortesia_pdf", [primeiro, car || "carro", loja],
              { documentUrl: kitUrl, documentFilename: KIT_FILENAME });
            kitEnviado = welcome;
            if (!welcome) welcome = await waSendTemplate(wa, phone, "boas_vindas_cortesia", [primeiro, car || "carro", loja]);
          } else {
            welcome = await waSendTemplate(wa, phone, "convite_copilot_loja", [primeiro, car ? `seu ${car}` : "seu carro", loja, link]);
          }
        } catch { /* WhatsApp off: cria a jornada mesmo assim */ }
        if (welcome) await admin.from("postsale_journeys").update({ welcome_sent: true }).eq("id", created.id);
        await admin.from("whatsapp_events").insert({ // alimenta a aba Conversas
          from_phone: phone, user_id: provisionedUserId, kind: "boas_vindas",
          status: welcome ? "sent" : "error",
          raw: { postsale_journey: created.id, loja },
          parsed: { cortesia, template: cortesia ? (kitEnviado ? "boas_vindas_cortesia_pdf" : "boas_vindas_cortesia") : "convite_copilot_loja", carro: car },
        });
        // se o kit PDF já foi junto, registra pro webhook não reenviar na 1ª resposta
        if (kitEnviado) {
          await admin.from("whatsapp_events").insert({
            from_phone: phone, user_id: provisionedUserId, kind: "kit_pdf", status: "sent",
            raw: { via: "postsale_create" }, parsed: { template: "boas_vindas_cortesia_pdf" },
          });
        }
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

      // ===================== VENDA SEU CARRO — margens da LOJA =====================
      // Cada loja edita a própria margem (Express + Vitrine); sem override, usa o padrão da rede.
      case "sell_config": {
        const alvo = (scopeDealership && scopeDealership !== "__none__") ? scopeDealership : me.dealership;
        const { data: g } = await admin.from("app_settings").select("buyback_prazos, buyback_express").eq("id", 1).single();
        const padrao = {
          prazos: Array.isArray(g?.buyback_prazos) && g.buyback_prazos.length ? g.buyback_prazos : [{ dias: 20, pct: 14, piso: 3500 }, { dias: 45, pct: 10, piso: 2800 }, { dias: 90, pct: 7, piso: 2000 }],
          express: (g?.buyback_express && typeof g.buyback_express === "object") ? g.buyback_express : { pct: 20, piso: 10000 },
        };
        let own: any = null;
        if (alvo) {
          const { data: d } = await admin.from("dealer_sell_config").select("buyback_prazos, buyback_express, updated_at").eq("dealership", alvo).maybeSingle();
          if (d && (d.buyback_prazos || d.buyback_express)) own = { prazos: d.buyback_prazos || null, express: d.buyback_express || null, updated_at: d.updated_at };
        }
        return json({ ok: true, dealership: alvo, padrao, own, usando_padrao: !own });
      }

      case "sell_config_save": {
        if (!writeStore) return json({ error: "sem_loja" }, 400);
        if (p.reset === true) {
          await admin.from("dealer_sell_config").delete().eq("dealership", writeStore);
          return json({ ok: true, reset: true });
        }
        const prazos = Array.isArray(p.buyback_prazos)
          ? p.buyback_prazos.map((x: any) => ({ dias: Number(x.dias) || 0, pct: Number(x.pct) || 0, piso: Number(x.piso) || 0 })).filter((x: any) => x.dias > 0)
          : null;
        const express = p.buyback_express ? { pct: Number(p.buyback_express.pct) || 0, piso: Number(p.buyback_express.piso) || 0 } : null;
        const { error } = await admin.from("dealer_sell_config").upsert({
          dealership: writeStore, buyback_prazos: prazos, buyback_express: express, updated_at: new Date().toISOString(),
        }, { onConflict: "dealership" });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
