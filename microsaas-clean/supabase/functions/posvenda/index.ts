// TotexCar Co-pilot — PÓS-VENDA (atendimento com handoff). Cron a cada 5 min (pg_cron "posvenda-escada"):
//   ?job=tick  → sobe de degrau os casos sem dono há SLA minutos (vendedor → gerente de manutenção →
//                gerente geral), só dentro do horário de atendimento, avisando o grupo da equipe.
// Protegida por ?secret= (mesmo WEBHOOK_SECRET dos outros crons). Deploy com verify_jwt=false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { secretOk, unauthorized } from "../_shared/secret.ts";
import { escadaTick } from "../_shared/posvenda.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!secretOk(url)) return unauthorized();
  const job = url.searchParams.get("job") || "tick";
  try {
    if (job === "tick") return json({ ok: true, ...(await escadaTick(admin)) });
    return json({ error: "job_desconhecido" }, 400);
  } catch (e) {
    console.error("posvenda:", e);
    return json({ error: String((e as any)?.message || e).slice(0, 200) }, 500);
  }
});
