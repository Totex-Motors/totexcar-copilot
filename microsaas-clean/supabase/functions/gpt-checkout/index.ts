// TotexCar — Checkout de UMA consulta GPT Motors (Pix/cartão avulso, Asaas).
// Cria gpt_orders (pending) + checkout Asaas (externalReference "gpt:{orderId}").
// O asaas-webhook, ao confirmar o pagamento, roda a consulta e entrega (app + WhatsApp).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { createGptCheckout } from "../_shared/gptorder.ts";
import type { GptProduto } from "../_shared/gptmotors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  let payload: any = {};
  try { payload = await req.json(); } catch { /* */ }
  const produto = String(payload.produto || "") as GptProduto;

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !ud?.user) return json({ error: "invalid_token" }, 401);
  const user = ud.user;

  const { data: prof } = await admin.from("users").select("phone").eq("id", user.id).single();
  const r = await createGptCheckout(admin, { userId: user.id, produto, placa: String(payload.placa || ""), uf: String(payload.uf || ""), phone: prof?.phone || null, origem: "app" });
  if (!r.ok) return json({ error: r.error }, 400);
  return json({ ok: true, url: r.url, order_id: r.orderId, preco: r.preco });
});
