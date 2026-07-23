// TotexCar Co-pilot — Selo Totex / Score de Cuidado (Fase 4)
// Endpoint JWT do APP: devolve o extrato do usuário logado (careStatement).
// A elegibilidade (cliente de loja parceira ADERIDA) vem calculada — a página decide o que exibir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { careStatement } from "../_shared/care-score.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "missing_token" }, 401);
    const { data: ud, error } = await admin.auth.getUser(token);
    if (error || !ud?.user) return json({ error: "invalid_token" }, 401);

    const { data: me } = await admin.from("users")
      .select("id, name, dealership, care_score, care_tier, care_tier_at, driver_mode")
      .eq("id", ud.user.id).single();
    if (!me) return json({ error: "no_profile" }, 403);

    const st = await careStatement(admin, me);
    return json({ ok: true, ...st });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message || e) }, 500);
  }
});
