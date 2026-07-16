// TotexCar Co-pilot — resolvedor de link curto de acesso
// A página /a/{code} do app chama aqui (POST) pra trocar o código de uso único pelo
// link mágico real (auth/v1/verify). Resolver por POST garante que o bot de preview
// do WhatsApp (GET na página) NÃO consome o token de login.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const code = String(p.code || "").trim();
  if (!/^[A-Za-z0-9]{6,24}$/.test(code)) return json({ error: "codigo_invalido" }, 400);

  const { data: row } = await admin.from("access_links").select("*").eq("code", code).maybeSingle();
  if (!row) return json({ error: "nao_encontrado" }, 404);
  if (row.used_at) return json({ error: "ja_usado" }, 410);
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "expirado" }, 410);

  // uso único: marca como usado ANTES de devolver
  await admin.from("access_links").update({ used_at: new Date().toISOString() }).eq("code", code);
  return json({ ok: true, link: row.action_link });
});
