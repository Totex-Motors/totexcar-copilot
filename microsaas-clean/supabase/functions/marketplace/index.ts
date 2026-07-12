// TotexCar Co-pilot — Marketplace feed (Indique e Ganhe)
// Lê o estoque AO VIVO do marketplace (totexmotors.com), filtrado pela loja do dono logado.
// Roda no servidor para evitar CORS. O dono nunca vê estoque de outra loja.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// normaliza nome de loja p/ casar TCF (texto livre) com o marketplace (name/slug)
const norm = (s: string) =>
  (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function resolveDealership(dealershipName: string) {
  const res = await fetch(`${MARKETPLACE}/api/dealerships`);
  if (!res.ok) return null;
  const list = await res.json();
  const arr = Array.isArray(list) ? list : (list?.data || []);
  const target = norm(dealershipName);
  return arr.find((d: any) => norm(d.name) === target || norm(d.slug) === target)
    || arr.find((d: any) => norm(d.name).includes(target) || target.includes(norm(d.name)))
    || null;
}

function normalizeCar(v: any) {
  const img = (v.images || []).find((i: any) => i.isPrimary) || (v.images || [])[0];
  const photo = img?.url ? (String(img.url).startsWith("http") ? img.url : `${MARKETPLACE}${img.url}`) : null;
  return {
    id: v.id,
    title: [v.brand, v.model, v.year].filter(Boolean).join(" "),
    brand: v.brand, model: v.model, version: v.version,
    year: v.year, km: v.mileage, price: v.price, color: v.color, fuel: v.fuel,
    photo_url: photo,
    url: `${MARKETPLACE}/veiculo/${v.id}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  const { data: me } = await admin.from("users")
    .select("id, name, dealership, referral_code").eq("id", ud.user.id).single();
  if (!me) return json({ error: "no_profile" }, 403);

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = p.action as string;

  try {
    // Lista de lojas do marketplace (para o seletor no /admin) — qualquer usuário logado
    if (action === "dealerships") {
      const res = await fetch(`${MARKETPLACE}/api/dealerships`);
      const list = res.ok ? await res.json() : [];
      const arr = Array.isArray(list) ? list : (list?.data || []);
      const dealerships = arr
        .map((d: any) => ({ name: d.name, slug: d.slug, city: d.city || null, vehicles: d?._count?.vehicles ?? null }))
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
      return json({ ok: true, dealerships });
    }

    if (action === "feed") {
      if (!me.dealership) return json({ ok: true, dealership: null, cars: [], reason: "owner_without_dealership" });
      const d = await resolveDealership(me.dealership);
      if (!d) return json({ ok: true, dealership: { name: me.dealership, slug: null }, cars: [], reason: "dealership_not_found" });

      const res = await fetch(`${MARKETPLACE}/api/dealerships/${encodeURIComponent(d.slug)}/vehicles?status=ACTIVE&limit=60`);
      let cars: any[] = [];
      if (res.ok) {
        const body = await res.json();
        const raw = Array.isArray(body) ? body : (body?.data || body?.vehicles || []);
        cars = raw.filter((v: any) => (v.status || "ACTIVE") === "ACTIVE").map(normalizeCar);
      }
      const { data: cfg } = await admin.from("app_settings").select("referral_buyer_offer").eq("id", 1).single();
      return json({
        ok: true,
        dealership: { name: d.name, slug: d.slug, phone: d.phone || null, url: `${MARKETPLACE}/loja/${d.slug}` },
        referral_code: me.referral_code,
        buyer_offer: cfg?.referral_buyer_offer || "Transferência grátis",
        cars,
      });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
