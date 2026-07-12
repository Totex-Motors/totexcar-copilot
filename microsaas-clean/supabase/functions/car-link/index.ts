// TotexCar Co-pilot — Pareamento do Carro Conectado (lado do APP, JWT)
// Ações: get (estado do vínculo) | create (gera código+token p/ o carro) | unlink
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

const INGEST_URL = `${SUPABASE_URL}/functions/v1/car-ingest`;
const code6 = () => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem chars ambíguos
  let s = ""; const r = crypto.getRandomValues(new Uint8Array(6));
  for (let i = 0; i < 6; i++) s += abc[r[i] % abc.length];
  return s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(jwt);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const userId = ud.user.id;

  let b: any = {};
  try { b = await req.json(); } catch { /* */ }
  const action = String(b.action || "get");

  const { data: acct } = await admin.from("accounts")
    .select("id, name, marca, modelo").eq("user_id", userId).eq("is_active", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!acct) return json({ error: "sem_veiculo" }, 400);

  try {
    if (action === "get") {
      const { data: link } = await admin.from("car_links")
        .select("status, device_label, last_seen, last_state, source, pair_code")
        .eq("account_id", acct.id).maybeSingle();
      return json({ ok: true, linked: !!link, link: link || null });
    }

    if (action === "create") {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const pair_code = code6();
      // 1 vínculo por veículo (regenera token = "reconectar")
      const { data: exists } = await admin.from("car_links").select("id").eq("account_id", acct.id).maybeSingle();
      const payload = {
        user_id: userId, account_id: acct.id, source: b.source || "byd_dilink",
        pair_code, token, status: "pending", last_state: null, paired_at: null,
      };
      if (exists) await admin.from("car_links").update(payload).eq("id", exists.id);
      else await admin.from("car_links").insert(payload);
      // payload que vai no QR Code pro app do carro ler
      return json({ ok: true, pair_code, token, ingest_url: INGEST_URL, qr: JSON.stringify({ url: INGEST_URL, token }) });
    }

    if (action === "unlink") {
      await admin.from("car_links").delete().eq("account_id", acct.id);
      return json({ ok: true });
    }

    return json({ error: "acao_desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
