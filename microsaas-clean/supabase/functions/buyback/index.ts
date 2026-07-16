// TotexCar Co-pilot — Recompra FIPE (Fase 4)
// O dono avalia o carro pela tabela FIPE (API pública parallelum) e pede a recompra à loja
// (até X% da FIPE). O pedido aparece no painel do lojista e dispara um aviso no WhatsApp da loja.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { loadWaSettings, waSendTemplate } from "../_shared/wa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const FIPE = "https://parallelum.com.br/fipe/api/v1/carros";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (s: any) => String(s || "").replace(/\D/g, "");
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

// "R$ 89.790,00" -> 89790
function parseBRL(s: any): number {
  const clean = String(s || "").replace(/[^\d,]/g, "").replace(",", ".");
  return Number(clean) || 0;
}

async function fipeGet(path: string) {
  const res = await fetch(`${FIPE}${path}`);
  if (!res.ok) throw new Error(`FIPE ${res.status}`);
  return res.json();
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  const { data: me } = await admin.from("users")
    .select("id, name, phone, role, dealership").eq("id", ud.user.id).single();
  if (!me) return json({ error: "no_profile" }, 403);
  const isDealerOrAdmin = me.role === "dealer" || me.role === "admin";

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = p.action as string;

  try {
    switch (action) {
      // ---- Proxy FIPE (parallelum) — qualquer usuário logado ----
      case "fipe_brands": {
        const data = await fipeGet("/marcas");
        return json({ ok: true, brands: data });
      }
      case "fipe_models": {
        if (!p.brand) return json({ error: "brand_required" }, 400);
        const data = await fipeGet(`/marcas/${encodeURIComponent(p.brand)}/modelos`);
        return json({ ok: true, models: data?.modelos || [] });
      }
      case "fipe_years": {
        if (!p.brand || !p.model) return json({ error: "brand_model_required" }, 400);
        const data = await fipeGet(`/marcas/${encodeURIComponent(p.brand)}/modelos/${encodeURIComponent(p.model)}/anos`);
        return json({ ok: true, years: data });
      }
      case "fipe_price": {
        if (!p.brand || !p.model || !p.year) return json({ error: "brand_model_year_required" }, 400);
        const d = await fipeGet(`/marcas/${encodeURIComponent(p.brand)}/modelos/${encodeURIComponent(p.model)}/anos/${encodeURIComponent(p.year)}`);
        const fipeValue = parseBRL(d?.Valor);
        const { data: s } = await admin.from("app_settings").select("buyback_fipe_pct").eq("id", 1).single();
        const pct = Number(s?.buyback_fipe_pct ?? 90);
        return json({
          ok: true,
          fipe: {
            value: fipeValue, code: d?.CodigoFipe || null,
            brand: d?.Marca, model: d?.Modelo, year: d?.AnoModelo, fuel: d?.Combustivel,
          },
          offer_pct: pct,
          offer_value: round2(fipeValue * pct / 100),
        });
      }

      // ---- Dono cria o pedido de recompra ----
      case "request": {
        const fipeValue = Number(p.fipe_value) || 0;
        if (!fipeValue) return json({ error: "fipe_value_required" }, 400);
        if (!me.dealership) return json({ error: "owner_without_dealership" }, 400);
        const { data: s } = await admin.from("app_settings")
          .select("buyback_fipe_pct").eq("id", 1).single();
        const pct = Number(p.offer_pct ?? s?.buyback_fipe_pct ?? 90);
        const offerValue = round2(fipeValue * pct / 100);

        const { data: inserted, error } = await admin.from("buyback_requests").insert({
          owner_id: me.id,
          dealership: me.dealership,
          owner_name: me.name,
          owner_phone: me.phone,
          brand: p.brand || null,
          model: p.model || null,
          year: p.year || null,
          fuel: p.fuel || null,
          fipe_code: p.fipe_code || null,
          fipe_value: fipeValue,
          offer_pct: pct,
          offer_value: offerValue,
          status: "new",
        }).select().single();
        if (error) throw error;

        // avisa o lojista da loja no WhatsApp (best-effort) — iniciado pelo negócio → TEMPLATE na API oficial
        const { data: dealer } = await admin.from("users")
          .select("phone").eq("role", "dealer").eq("dealership", me.dealership).limit(1);
        const dealerPhone = dealer?.[0]?.phone;
        if (dealerPhone) {
          const wa = await loadWaSettings(admin);
          await waSendTemplate(wa, dealerPhone, "pedido_recompra_loja", [
            me.dealership,
            me.name || "Cliente",
            [p.brand, p.model, p.year].filter(Boolean).join(" ") || "veículo",
            `${brl(offerValue)} (${pct}% da FIPE ${brl(fipeValue)})`,
            me.phone || "sem telefone",
          ]);
        }
        return json({ ok: true, request: inserted });
      }

      case "my_requests": {
        const { data } = await admin.from("buyback_requests")
          .select("*").eq("owner_id", me.id).order("created_at", { ascending: false });
        return json({ ok: true, requests: data || [] });
      }

      // ---- Lojista: lista e atualiza os pedidos da loja ----
      case "list_requests": {
        if (!isDealerOrAdmin) return json({ error: "forbidden" }, 403);
        let q = admin.from("buyback_requests").select("*").order("created_at", { ascending: false });
        const scope = me.role === "admin" ? (p.dealership || null) : me.dealership;
        if (scope) q = q.eq("dealership", scope);
        const { data } = await q.limit(500);
        return json({ ok: true, requests: data || [] });
      }

      case "update_request": {
        if (!isDealerOrAdmin) return json({ error: "forbidden" }, 403);
        if (!p.id) return json({ error: "id_required" }, 400);
        const status = ["new", "contacted", "closed", "declined"].includes(String(p.status)) ? String(p.status) : "new";
        let q = admin.from("buyback_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", p.id);
        if (me.role !== "admin") q = q.eq("dealership", me.dealership); // escopo da loja
        const { data, error } = await q.select().single();
        if (error) throw error;
        return json({ ok: true, request: data });
      }

      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 400);
  }
});
