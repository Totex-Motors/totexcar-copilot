// TotexCar Co-pilot — Sync do estoque do marketplace → CATÁLOGO do WhatsApp (Meta)
// Espelha os carros do marketplace totexmotors.com no catálogo da Meta, pra mandar VITRINE
// com FOTO no WhatsApp (Multi-Product Message). Roda no cron (a cada X horas) e sob demanda.
//
// Estratégia idempotente por items_batch: monta o estoque atual, faz UPSERT de todos e
// DELETE dos que sumiram (retailer_id = id do veículo no marketplace). Tudo em lotes de 100.
//
// Config: app_settings.meta_wa_token (precisa de catalog_management) + meta_catalog_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const GRAPH = "https://graph.facebook.com/v21.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchAllVehicles(): Promise<any[]> {
  const out: any[] = [];
  for (let page = 1; page <= 30; page++) {
    const u = new URL(`${MARKETPLACE}/api/vehicles`);
    u.searchParams.set("limit", "50");
    u.searchParams.set("page", String(page));
    const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
    if ((res.status === 429 || res.status === 503)) { await sleep(500); page--; continue; }
    if (!res.ok) break;
    const d = await res.json().catch(() => ({}));
    const data = Array.isArray(d?.data) ? d.data : [];
    out.push(...data);
    if (!data.length || page >= (d?.totalPages || 1)) break;
    await sleep(150);
  }
  return out;
}

// veículo do marketplace → item do catálogo Meta (preço em CENTAVOS, string; sem símbolo)
function toItem(v: any) {
  const title = [v.brand, v.model, v.version].filter(Boolean).join(" ").slice(0, 200) || "Veículo";
  const img = (Array.isArray(v.images) ? (v.images.find((i: any) => i.isPrimary) || v.images[0]) : null)?.url || "";
  const km = Number(v.mileage) > 0 ? `${Number(v.mileage).toLocaleString("pt-BR")} km` : "";
  const desc = [v.year, km, v.color, v.fuel, v.transmission, v.city && v.state ? `${v.city}/${v.state}` : ""]
    .filter(Boolean).join(" · ").slice(0, 9999) || title;
  return {
    id: String(v.id),                                   // retailer_id
    title: `${title} ${v.year || ""}`.trim().slice(0, 200),
    description: desc,
    availability: "in stock",
    condition: "used",
    price: String(Math.round(Number(v.price || 0) * 100)), // centavos
    currency: "BRL",
    image_url: img,
    url: `${MARKETPLACE}/veiculo/${v.id}`,
    brand: String(v.brand || "Totex").slice(0, 100),
  };
}

async function batch(catalogId: string, token: string, method: "UPDATE" | "DELETE", items: any[]) {
  let ok = 0, fail = 0;
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100);
    const requests = chunk.map((it: any) =>
      method === "DELETE" ? { method: "DELETE", data: { id: it } } : { method: "UPDATE", data: it });
    const res = await fetch(`${GRAPH}/${catalogId}/items_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_type: "PRODUCT_ITEM", requests }),
    });
    if (res.ok) ok += chunk.length;
    else { fail += chunk.length; console.error(`items_batch ${method} falhou:`, res.status, (await res.text()).slice(0, 300)); }
    await sleep(250);
  }
  return { ok, fail };
}

// ids que HOJE estão no catálogo (p/ apagar os que saíram do estoque)
async function currentCatalogIds(catalogId: string, token: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let url = `${GRAPH}/${catalogId}/products?fields=retailer_id&limit=200`;
  for (let i = 0; i < 30 && url; i++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) break;
    const d = await res.json();
    for (const p of d.data || []) if (p.retailer_id) ids.add(String(p.retailer_id));
    url = d.paging?.next || "";
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const { data: s } = await admin.from("app_settings")
    .select("meta_wa_token, meta_catalog_id").eq("id", 1).single();
  const token = s?.meta_wa_token || "";
  const catalogId = s?.meta_catalog_id || "";
  if (!token || !catalogId) return json({ error: "catalogo_nao_configurado", need: ["meta_wa_token(catalog_management)", "meta_catalog_id"] }, 400);

  try {
    const vehicles = await fetchAllVehicles();
    const items = vehicles.filter((v: any) => Number(v.price) > 0).map(toItem).filter((i: any) => i.image_url);
    const wanted = new Set(items.map((i: any) => i.id));

    const existing = await currentCatalogIds(catalogId, token);
    const toDelete = [...existing].filter((id) => !wanted.has(id));

    const up = await batch(catalogId, token, "UPDATE", items);
    const del = toDelete.length ? await batch(catalogId, token, "DELETE", toDelete) : { ok: 0, fail: 0 };

    const result = { ok: true, estoque: vehicles.length, sincronizados: up.ok, falhas_up: up.fail, removidos: del.ok, ts: new Date().toISOString() };
    await admin.from("app_settings").update({ catalog_last_sync: result.ts }).eq("id", 1).then(() => {}, () => {});
    return json(result);
  } catch (e) {
    console.error("catalog-sync erro:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
