// TotexCar Co-pilot — Ingestão de telemetria do CARRO (app rodando na tela do veículo)
// Sem JWT: o app do carro autentica por TOKEN (gerado no pareamento). Fonte-agnóstico.
// POST { token, type: "hello"|"telemetry"|"event", ...campos }
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

const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let b: any = {};
  try { b = await req.json(); } catch { /* */ }
  const token = String(b.token || "").trim();
  if (!token) return json({ error: "missing_token" }, 401);

  const { data: link } = await admin.from("car_links")
    .select("id, account_id, status").eq("token", token).maybeSingle();
  if (!link) return json({ error: "invalid_token" }, 401);

  const now = new Date().toISOString();
  const type = String(b.type || "telemetry");

  try {
    if (type === "hello") {
      await admin.from("car_links").update({
        status: "connected", device_label: b.device_label || null, paired_at: now, last_seen: now,
      }).eq("id", link.id);
      return json({ ok: true, connected: true });
    }

    if (type === "event") {
      await admin.from("car_events").insert({
        account_id: link.account_id, type: String(b.event_type || "info"),
        label: b.label || null, raw: b.raw || null,
      });
      await admin.from("car_links").update({ last_seen: now, status: "connected" }).eq("id", link.id);
      return json({ ok: true });
    }

    // telemetry (padrão)
    const lat = num(b.lat), lng = num(b.lng), speed = num(b.speed);
    const battery = num(b.battery_pct), odometer = num(b.odometer), power = num(b.power_kw);
    const moving = typeof b.moving === "boolean" ? b.moving : (speed != null ? speed > 0 : null);

    const state = {
      lat, lng, speed, battery_pct: battery, odometer, power_kw: power, moving,
      ignition: b.ignition ?? null, soh: num(b.soh), range_km: num(b.range_km),
      updated_at: now,
    };
    await admin.from("car_links").update({ last_seen: now, status: "connected", last_state: state }).eq("id", link.id);

    // histórico (o app controla a frequência do envio)
    await admin.from("car_telemetry").insert({
      account_id: link.account_id, lat, lng, speed, battery_pct: battery,
      odometer, power_kw: power, moving, raw: b.raw || null,
    });

    // sincroniza hodômetro (só-sobe) → alimenta manutenção/consumo
    if (odometer != null && odometer > 0) {
      const { data: acct } = await admin.from("accounts").select("hodometro").eq("id", link.account_id).maybeSingle();
      if (acct && odometer > Number(acct.hodometro || 0)) {
        await admin.from("accounts").update({ hodometro: odometer }).eq("id", link.account_id);
      }
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
