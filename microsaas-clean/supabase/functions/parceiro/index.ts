// TotexCar Co-pilot — CADASTRO SELF-SERVICE DE PARCEIRO (Clube de Parceiros do Radar).
// A página pública /parceiro faz POST aqui. O parceiro entra como PENDENTE (active=false) e o
// admin aprova em /admin → aí ele aparece PRIMEIRO no Radar, com selo e botão "Resgatar".
// service_partners tem RLS sem política (só service role lê/escreve) → por isso passa por aqui.
// Deploy com verify_jwt=false (público). Grátis pra listar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const txt = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const CATS = ["oficina","freios","autoeletrica","bateria","pneus","borracharia","chaveiro","vidros","ar_condicionado","funilaria","estetica","vistoria","guincho","socorro","eletrico_hibrido","posto","alinhamento","escapamento","cambio","oleo","insulfilm","som","martelinho","despachante","gnv"];
const mkCode = () => crypto.randomUUID().replace(/-/g, "").slice(0, 6).toLowerCase();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { /* corpo vazio */ }

  const name = txt(b.name, 120);
  const category = CATS.includes(String(b.category || "")) ? String(b.category) : "oficina";
  const city = txt(b.city, 80);
  const address = txt(b.address, 200) || null;
  const whatsapp = digits(b.whatsapp).replace(/^55(?=\d{10,11}$)/, "");
  const phone = digits(b.phone).replace(/^55(?=\d{10,11}$)/, "") || null;
  const email = txt(b.email, 120).toLowerCase() || null;
  const contact = txt(b.contact_name, 80) || null;
  const benefit = txt(b.benefit, 160);
  const website = txt(b.website, 200) || null;
  const source = txt(b.source, 60) || "self_service";

  if (name.length < 3) return json({ ok: false, error: "nome_invalido" }, 400);
  if (!city) return json({ ok: false, error: "cidade_obrigatoria" }, 400);
  if (whatsapp.length < 10 || whatsapp.length > 11) return json({ ok: false, error: "whatsapp_invalido" }, 400);
  if (benefit.length < 5) return json({ ok: false, error: "beneficio_obrigatorio" }, 400);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "email_invalido" }, 400);

  // mesmo WhatsApp já cadastrado → não duplica, devolve o status atual
  const { data: ex } = await admin.from("service_partners").select("id, status, code").eq("whatsapp", whatsapp).limit(1).maybeSingle();
  if (ex?.id) return json({ ok: true, already: true, id: ex.id, status: ex.status, code: ex.code });

  let code = mkCode();
  for (let i = 0; i < 3; i++) {
    const { data: c } = await admin.from("service_partners").select("id").eq("code", code).maybeSingle();
    if (!c) break;
    code = mkCode();
  }

  const { data, error } = await admin.from("service_partners").insert({
    name, category, city, address, whatsapp, phone, email, contact_name: contact,
    benefit, website, source, code, status: "pending", active: false, priority: 0,
    notes: `Cadastro self-service (${source})`,
  }).select("id, code").single();
  if (error) { console.error("parceiro insert:", error); return json({ ok: false, error: "falha_ao_salvar" }, 500); }

  // veio de um link de prospecção (?p=<discovered_providers.id>): marca o prospect como "cadastrou"
  const providerId = /^[0-9a-f-]{36}$/i.test(String(b.provider_id || "")) ? String(b.provider_id) : null;
  if (providerId) {
    try {
      await admin.from("partner_prospects").upsert({
        provider_id: providerId, status: "cadastrou", partner_id: data.id, ref: source,
        last_touch_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "provider_id" });
    } catch { /* nunca bloqueia o cadastro */ }
  }

  // sinaliza no funil (métricas do admin); nunca bloqueia o cadastro
  try {
    await admin.from("whatsapp_events").insert({
      from_phone: whatsapp, kind: "partner_signup", status: "pending", raw: {},
      parsed: { partner_id: data.id, name, category, city, source },
    });
  } catch { /* */ }

  return json({ ok: true, id: data.id, code: data.code, status: "pending" });
});
