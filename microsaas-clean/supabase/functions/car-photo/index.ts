// TotexCar Co-pilot — FOTO DO CARRO (card "Meu carro").
// POST { action: "status" }                         → foto atual (herda a foto de capa da venda, se houver)
// POST { action: "upload", image_base64, mime }     → foto do dono: recorta o fundo (Photoroom) e guarda
// POST { action: "remover" }                        → tira a foto (volta pro convite)
// Auth: JWT do usuário. A chave do Photoroom fica no servidor (app_settings.photoroom_api_key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { herdarFotoDaVenda, salvarFotoCarro } from "../_shared/car-photo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const MAX_BYTES = 8 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: ud } = token ? await admin.auth.getUser(token) : { data: null as any };
  const userId = ud?.user?.id;
  if (!userId) return json({ error: "nao_autenticado" }, 401);

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }
  const action = String(p.action || "status");

  const { data: acc } = await admin.from("accounts").select("id, user_id, foto_url, foto_fonte")
    .eq("user_id", userId).eq("is_active", true).limit(1).maybeSingle();
  if (!acc) return json({ ok: false, error: "sem_carro" }, 200);

  try {
    if (action === "status") {
      if (acc.foto_url) return json({ ok: true, foto_url: acc.foto_url, fonte: acc.foto_fonte });
      const { data: u } = await admin.from("users").select("phone").eq("id", userId).maybeSingle();
      const herdada = await herdarFotoDaVenda(admin, acc, u?.phone || null);
      return json({ ok: true, foto_url: herdada, fonte: herdada ? "estoque" : null });
    }

    if (action === "upload") {
      const b64 = String(p.image_base64 || "").replace(/^data:[^;]+;base64,/, "");
      const mime = String(p.mime || "image/jpeg");
      if (!b64 || !mime.startsWith("image/")) return json({ error: "imagem_invalida" }, 400);
      const bin = atob(b64);
      if (bin.length > MAX_BYTES) return json({ error: "imagem_grande" }, 400);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const salvo = await salvarFotoCarro(admin, `cliente/${acc.id}`, { bytes, mime });
      if (!salvo) return json({ error: "falha_ao_salvar" }, 500);
      await admin.from("accounts").update({ foto_url: salvo.url, foto_fonte: "cliente", foto_at: new Date().toISOString() }).eq("id", acc.id);
      return json({ ok: true, foto_url: salvo.url, fonte: "cliente", recortada: salvo.recortada });
    }

    if (action === "remover") {
      await admin.from("accounts").update({ foto_url: null, foto_fonte: null, foto_at: null }).eq("id", acc.id);
      return json({ ok: true });
    }

    return json({ error: "acao_desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as any)?.message || e).slice(0, 200) }, 500);
  }
});
