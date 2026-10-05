// TotexCar Co-pilot — ETIQUETA QR DO PARA-BRISA (resolvedor público do scan).
// A página /q/<token> do app chama aqui (POST {action:"scan", token}) e recebe o link do WhatsApp
// do Co-pilot com a mensagem pré-preenchida "#etiqueta <token>". O webhook faz o resto (reconhece o
// dono pelo telefone, confirma o início de uso, ou oferece transferir pro dono novo).
// Nunca devolve dados do cliente: só conta o scan e monta o link. Deploy com verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const WA = Deno.env.get("COPILOT_WA_NUMBER") || "5511963786699";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { /* */ }
  const token = String(b.token || "").trim().toLowerCase();
  if (!/^[a-z0-9]{6,16}$/.test(token)) return json({ ok: false, error: "token_invalido" }, 400);

  const { data: tag } = await admin.from("car_tags").select("id, label, status, scans, dealership").eq("token", token).maybeSingle();
  if (!tag) return json({ ok: false, error: "nao_encontrada" }, 404);

  // conta o scan (best-effort; nunca bloqueia o redirect)
  try {
    await admin.from("car_tags").update({ scans: (Number(tag.scans) || 0) + 1, last_scan_at: new Date().toISOString() }).eq("id", tag.id);
  } catch { /* */ }

  const msg = `Oi! Escaneei a etiqueta do meu carro 🚗\n#etiqueta ${token}`;
  return json({
    ok: true, label: tag.label, status: tag.status, loja: tag.dealership || null,
    wa_link: `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`,
  });
});
