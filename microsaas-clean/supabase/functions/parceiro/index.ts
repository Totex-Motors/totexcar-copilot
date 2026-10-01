// TotexCar Co-pilot — CADASTRO SELF-SERVICE DE PARCEIRO (Clube de Parceiros do Radar).
// A página pública /parceiro faz POST aqui. O parceiro entra como PENDENTE (active=false) e o
// admin aprova em /admin → aí ele aparece PRIMEIRO no Radar, com selo e botão "Resgatar".
// service_partners tem RLS sem política (só service role lê/escreve) → por isso passa por aqui.
// Deploy com verify_jwt=false (público). Grátis pra listar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { benefitEffective, sortByTopRule, honorRate, TOP_SLOTS } from "../_shared/radar-search.ts";

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

const money = (v: unknown) => Math.min(5000, Math.max(0, Math.round(Number(String(v ?? "").replace(",", ".")) || 0)));

// REGRA DO TOPO — posição do parceiro na categoria/cidade dele (só aprovados contam no ranking).
// Devolve a posição que ele ocupa (ou ocuparia, se ainda pendente), quantos estão no topo e o valor do 1º.
async function rankContext(category: string, city: string, me: { id?: string | null; benefit_value: number }) {
  const cityTok = String(city || "").split(/[,\-]/)[0].trim();
  let q = admin.from("service_partners").select("id, name, benefit_value, honored_count, not_honored_count, redeem_count, priority")
    .eq("active", true).eq("status", "approved").eq("category", category);
  if (cityTok) q = q.or(`city.is.null,city.ilike.%${cityTok}%`);
  const { data } = await q.limit(100);
  const others = (data || []).filter((r: any) => String(r.id) !== String(me.id || ""));
  const ranked = sortByTopRule([...others, { id: me.id || "me", benefit_value: me.benefit_value, honored_count: 0, not_honored_count: 0, redeem_count: 0, priority: 0 } as any]);
  const pos = ranked.findIndex((r: any) => String(r.id) === String(me.id || "me")) + 1;
  const first = ranked[0] as any;
  const terceiro = ranked[TOP_SLOTS - 1] as any;
  return {
    position: pos, no_topo: pos > 0 && pos <= TOP_SLOTS && me.benefit_value > 0,
    concorrentes: others.length, top_slots: TOP_SLOTS,
    valor_primeiro: first && String(first.id) !== String(me.id || "me") ? Math.round(benefitEffective(first)) : null,
    valor_para_topo: others.length >= TOP_SLOTS && terceiro ? Math.round(benefitEffective(terceiro)) + 1 : 1,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  let b: any = {};
  try { b = await req.json(); } catch { /* corpo vazio */ }

  // ---- ÁREA DO PARCEIRO (sem login: o código de resgate é a chave) ----
  if (b.action === "get" || b.action === "update") {
    const code = String(b.code || "").trim().toLowerCase();
    if (!/^[a-z0-9]{4,12}$/.test(code)) return json({ ok: false, error: "codigo_invalido" }, 400);
    const { data: pt } = await admin.from("service_partners").select("*").eq("code", code).maybeSingle();
    if (!pt) return json({ ok: false, error: "codigo_invalido" }, 404);
    if (b.action === "update") {
      const benefit = txt(b.benefit, 160);
      const benefit_value = money(b.benefit_value);
      if (benefit.length < 5) return json({ ok: false, error: "beneficio_obrigatorio" }, 400);
  if (benefit_value < 1) return json({ ok: false, error: "valor_obrigatorio" }, 400);
      if (benefit_value < 1) return json({ ok: false, error: "valor_obrigatorio" }, 400);
      const { error } = await admin.from("service_partners").update({ benefit, benefit_value, updated_at: new Date().toISOString() }).eq("id", pt.id);
      if (error) return json({ ok: false, error: "falha_ao_salvar" }, 500);
      pt.benefit = benefit; pt.benefit_value = benefit_value;
    }
    const rank = await rankContext(pt.category, pt.city || "", { id: pt.id, benefit_value: Number(pt.benefit_value) || 0 });
    return json({
      ok: true, partner: {
        name: pt.name, category: pt.category, city: pt.city, benefit: pt.benefit, benefit_value: Number(pt.benefit_value) || 0,
        status: pt.status, code: pt.code, shown_count: pt.shown_count || 0, click_count: pt.click_count || 0, redeem_count: pt.redeem_count || 0,
        honor_rate: honorRate(pt),
      }, rank,
    });
  }

  const name = txt(b.name, 120);
  const category = CATS.includes(String(b.category || "")) ? String(b.category) : "oficina";
  const city = txt(b.city, 80);
  const address = txt(b.address, 200) || null;
  const whatsapp = digits(b.whatsapp).replace(/^55(?=\d{10,11}$)/, "");
  const phone = digits(b.phone).replace(/^55(?=\d{10,11}$)/, "") || null;
  const email = txt(b.email, 120).toLowerCase() || null;
  const contact = txt(b.contact_name, 80) || null;
  const benefit = txt(b.benefit, 160);
  const benefit_value = money(b.benefit_value);
  const website = txt(b.website, 200) || null;
  const source = txt(b.source, 60) || "self_service";

  if (name.length < 3) return json({ ok: false, error: "nome_invalido" }, 400);
  if (!city) return json({ ok: false, error: "cidade_obrigatoria" }, 400);
  if (whatsapp.length < 10 || whatsapp.length > 11) return json({ ok: false, error: "whatsapp_invalido" }, 400);
  if (benefit.length < 5) return json({ ok: false, error: "beneficio_obrigatorio" }, 400);
  if (benefit_value < 1) return json({ ok: false, error: "valor_obrigatorio" }, 400);
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
    benefit, benefit_value, website, source, code, status: "pending", active: false, priority: 0,
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

  // posição que ele vai ocupar quando aprovado (motiva a subir o benefício já no cadastro)
  const rank = await rankContext(category, city, { id: null, benefit_value });
  return json({ ok: true, id: data.id, code: data.code, status: "pending", rank });
});
