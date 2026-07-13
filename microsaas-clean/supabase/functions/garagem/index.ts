// TotexCar Co-pilot — GARAGEM TOTEX (integração com o marketplace totexmotors.com)
// "Seu carro atual e o caminho para o próximo."
// Ações (JWT): search | brands | opportunities | interest | sell | radar_list | radar_save | radar_delete
// Leads usam a API pública do marketplace: /api/leads/vehicle-interest, /api/leads/sell-vehicle, /api/leads/contact
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// Mapa de lojas (id → { credereEnabled, cnpj }) p/ liberar o botão "Simular financiamento".
// O marketplace só mostra a simulação (Meu Credere) quando a loja tem credereEnabled + CNPJ;
// espelhamos essa mesma regra aqui. Cache de 10 min (a lista /api/vehicles NÃO traz esses campos).
let _dealers: Record<string, { credereEnabled: boolean; cnpj: string | null }> | null = null;
let _dealersAt = 0;
async function loadDealers() {
  const now = Date.now();
  if (_dealers && now - _dealersAt < 10 * 60 * 1000) return _dealers;
  try {
    const res = await fetch(`${MARKETPLACE}/api/dealerships`, { headers: { Accept: "application/json" } });
    const d = await res.json().catch(() => []);
    const arr = Array.isArray(d) ? d : (d?.data || []);
    const map: Record<string, { credereEnabled: boolean; cnpj: string | null }> = {};
    for (const x of arr) if (x?.id) map[x.id] = { credereEnabled: !!x.credereEnabled, cnpj: x.cnpj || null };
    _dealers = map; _dealersAt = now;
  } catch { if (!_dealers) _dealers = {}; }
  return _dealers!;
}

// normaliza um veículo do marketplace pro shape do app (foto principal + link com ?ref do Indique)
function normVehicle(v: any, refCode?: string | null) {
  const img = (v.images || []).find((i: any) => i.isPrimary) || (v.images || [])[0];
  const photo = img?.url ? (String(img.url).startsWith("http") ? img.url : `${MARKETPLACE}${img.url}`) : null;
  const dealerId = v.dealershipId || v.dealership?.id || null;
  const dealer = dealerId ? (_dealers || {})[dealerId] : null;
  return {
    id: v.id,
    title: [v.brand, v.model, v.version].filter(Boolean).join(" "),
    brand: v.brand, model: v.model, version: v.version || null,
    year: v.year, km: v.mileage, price: v.price, fipe_price: v.fipePrice ?? null,
    color: v.color || null, fuel: v.fuel || null, transmission: v.transmission || null,
    city: v.city || null, state: v.state || null,
    dealership: v.dealership?.name || null,
    financing_enabled: !!(dealer && dealer.credereEnabled && dealer.cnpj),
    photo,
    url: `${MARKETPLACE}/veiculo/${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`,
  };
}

async function fetchVehicles(params: Record<string, string | number | undefined>) {
  const u = new URL(`${MARKETPLACE}/api/vehicles`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`marketplace_${res.status}`);
  return { data: Array.isArray(d?.data) ? d.data : [], total: d?.total ?? 0, totalPages: d?.totalPages ?? 1 };
}

async function postLead(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${MARKETPLACE}/api/leads/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, status: res.status, error: d?.message || d?.error || `lead_${res.status}`, detail: d };
  return { ok: true, ...d };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const userId = ud.user.id;

  let b: any = {};
  try { b = await req.json(); } catch { /* */ }
  const action = String(b.action || "search");

  const { data: me } = await admin.from("users")
    .select("name, email, phone, dealership, referral_code").eq("id", userId).single();
  const { data: acct } = await admin.from("accounts")
    .select("id, name, marca, modelo, ano_modelo, ano_fabricacao, valor_compra, hodometro, placa")
    .eq("user_id", userId).eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
  const refCode = me?.referral_code || null;
  await loadDealers(); // popula o mapa de lojas (financing_enabled) usado pelo normVehicle

  try {
    // ---------- BUSCAR / TROCAR (estoque com filtros) ----------
    if (action === "search") {
      const f = b.filters || {};
      const r = await fetchVehicles({
        search: f.search, brand: f.brand, model: f.model,
        minYear: f.min_year, maxYear: f.max_year,
        minPrice: f.min_price, maxPrice: f.max_price,
        maxMileage: f.max_km, fuel: f.fuel, transmission: f.transmission,
        page: f.page || 1, limit: f.limit || 12, sort: f.sort,
      });
      return json({ ok: true, total: r.total, total_pages: r.totalPages, cars: r.data.map((v: any) => normVehicle(v, refCode)) });
    }

    // ---------- marcas disponíveis (dropdown do filtro) ----------
    if (action === "brands") {
      const res = await fetch(`${MARKETPLACE}/api/vehicles/brands`);
      const d = await res.json().catch(() => []);
      return json({ ok: true, brands: Array.isArray(d) ? d : (d?.data || []) });
    }

    // ---------- OPORTUNIDADES (com base no carro atual) ----------
    if (action === "opportunities") {
      let cars: any[] = [];
      let base: any = null;
      if (acct?.valor_compra && Number(acct.valor_compra) > 0) {
        // janela de upgrade: entre 90% e 190% do valor pago, ano igual ou mais novo
        const v = Number(acct.valor_compra);
        base = { tipo: "valor_compra", valor: v, carro: `${acct.marca || ""} ${acct.modelo || ""}`.trim(), ano: acct.ano_modelo };
        const r = await fetchVehicles({
          minPrice: Math.round(v * 0.9), maxPrice: Math.round(v * 1.9),
          minYear: acct.ano_modelo || undefined, limit: 12, sort: "year_desc",
        });
        cars = r.data;
        if (!cars.length) { const r2 = await fetchVehicles({ minPrice: Math.round(v * 0.7), limit: 12 }); cars = r2.data; }
      } else {
        base = { tipo: "destaques" };
        const res = await fetch(`${MARKETPLACE}/api/vehicles/featured?limit=12`);
        const d = await res.json().catch(() => []);
        cars = Array.isArray(d) ? d : (d?.data || []);
      }
      // não sugerir o próprio modelo/ano do cliente
      const own = `${acct?.marca || ""} ${acct?.modelo || ""}`.trim().toLowerCase();
      if (own) cars = cars.filter((v: any) => `${v.brand} ${v.model}`.toLowerCase() !== own || v.year !== acct?.ano_modelo);
      return json({ ok: true, base, cars: cars.slice(0, 12).map((v: any) => normVehicle(v, refCode)) });
    }

    // ---------- TENHO INTERESSE (lead vehicle-interest) ----------
    if (action === "interest") {
      const vehicleId = String(b.vehicle_id || "");
      if (!vehicleId) return json({ error: "vehicle_id_obrigatorio" }, 400);
      const r = await postLead("vehicle-interest", {
        nome: me?.name || "Cliente TotexCar", email: me?.email || ud.user.email,
        telefone: me?.phone || "", vehicleId,
        mensagem: b.mensagem || `Tenho interesse neste veículo. (via TotexCar Co-pilot${acct ? ` — meu carro atual: ${acct.marca || ""} ${acct.modelo || ""} ${acct.ano_modelo || ""}` : ""})`,
      });
      return json(r, r.ok ? 200 : 400);
    }

    // ---------- VENDER / AVALIAR (lead sell-vehicle com vistoria) ----------
    if (action === "sell") {
      const modo = b.modo === "avaliar" ? "AVALIAÇÃO" : "VENDA";
      const r = await postLead("sell-vehicle", {
        nome: me?.name || "Cliente TotexCar", email: me?.email || ud.user.email, telefone: me?.phone || "",
        marca: b.marca || acct?.marca || "Não informado",
        modelo: b.modelo || acct?.modelo || "Não informado",
        versao: b.versao || `${modo} via TotexCar Co-pilot`,
        anoFabricacao: Number(b.ano || acct?.ano_fabricacao || acct?.ano_modelo || new Date().getFullYear()),
        quilometragem: Number(b.km || acct?.hodometro || 0),
        localVistoria: b.local || me?.dealership || "A combinar",
        dataVistoria: b.data || new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        horarioVistoria: b.horario || "10:00",
      });
      return json(r, r.ok ? 200 : 400);
    }

    // ---------- RADAR / OFERTAS PARA MIM ----------
    if (action === "radar_list") {
      const { data: radars } = await admin.from("car_radar").select("*")
        .eq("user_id", userId).eq("active", true).order("created_at", { ascending: false });
      // pra cada radar, tenta casar com o estoque AO VIVO
      const out = [];
      for (const r of radars || []) {
        let matches: any[] = [];
        try {
          const q = await fetchVehicles({
            brand: r.brand || undefined, search: r.model || undefined,
            maxPrice: r.max_price || undefined, minYear: r.min_year || undefined,
            maxMileage: r.max_km || undefined, limit: 6,
          });
          matches = q.data.map((v: any) => normVehicle(v, refCode));
        } catch { /* estoque indisponível: radar segue salvo */ }
        out.push({ ...r, matches });
      }
      return json({ ok: true, radars: out });
    }

    if (action === "radar_save") {
      const row = {
        user_id: userId,
        brand: b.brand || null, model: b.model || null, color: b.color || null,
        max_price: Number(b.max_price) > 0 ? Number(b.max_price) : null,
        min_year: Number(b.min_year) > 0 ? Number(b.min_year) : null,
        max_km: Number(b.max_km) > 0 ? Number(b.max_km) : null,
        notes: b.notes || null, active: true,
      };
      if (!row.brand && !row.model && !row.max_price) return json({ error: "informe_marca_modelo_ou_preco" }, 400);
      const { data: created, error } = await admin.from("car_radar").insert(row).select("id").single();
      if (error) return json({ error: error.message }, 400);

      // gera o lead de demanda no marketplace (a loja fica sabendo o que o cliente procura)
      const desejo = [row.brand, row.model, row.min_year ? `a partir de ${row.min_year}` : "", row.color,
        row.max_km ? `até ${row.max_km} km` : "", row.max_price ? `até R$ ${row.max_price}` : ""].filter(Boolean).join(", ");
      const lead = await postLead("contact", {
        nome: me?.name || "Cliente TotexCar", email: me?.email || ud.user.email, telefone: me?.phone || "",
        assunto: "RADAR TotexCar Co-pilot — carro procurado",
        mensagem: `Cliente deixou no radar: ${desejo}. ${row.notes ? `Obs: ${row.notes}. ` : ""}Carro atual: ${acct ? `${acct.marca || ""} ${acct.modelo || ""} ${acct.ano_modelo || ""}` : "não informado"}.${me?.dealership ? ` Loja de origem: ${me.dealership}.` : ""}`,
      });
      if (lead.ok) await admin.from("car_radar").update({ lead_sent: true }).eq("id", created.id);

      // devolve possíveis matches imediatos
      let matches: any[] = [];
      try {
        const q = await fetchVehicles({ brand: row.brand || undefined, search: row.model || undefined, maxPrice: row.max_price || undefined, minYear: row.min_year || undefined, maxMileage: row.max_km || undefined, limit: 6 });
        matches = q.data.map((v: any) => normVehicle(v, refCode));
      } catch { /* */ }
      return json({ ok: true, id: created.id, lead_enviado: lead.ok, matches });
    }

    if (action === "radar_delete") {
      const id = String(b.id || "");
      if (!id) return json({ error: "id_obrigatorio" }, 400);
      await admin.from("car_radar").update({ active: false }).eq("id", id).eq("user_id", userId);
      return json({ ok: true });
    }

    return json({ error: "acao_desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
