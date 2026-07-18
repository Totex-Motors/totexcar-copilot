// TotexCar Co-pilot — MODO VIAGEM (web): plano de road trip com os dados REAIS do carro
// Mesmo motor do agente WhatsApp (tool planejar_viagem), exposto pro app: o front manda
// destino/origem/dias/perfil e recebe o plano pronto (IA) + os dados usados na conta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { pesquisarRota } from "../_shared/route-research.ts";

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

const DESTINOS_2026 = ["Morro Branco (CE)", "Juquehy (SP)", "Serra da Canastra (MG)", "Espírito Santo do Pinhal (SP, enoturismo)", "Bento Gonçalves (RS)", "Península de Maraú (BA)"];
const CHECKLIST = ["Calibragem dos pneus (incluindo estepe)", "Nível de óleo e água/arrefecimento", "Palhetas e água do para-brisa", "Documento (CRLV) e CNH válidos", "Triângulo, macaco e chave de roda", "Farol/lanternas funcionando"];

// consumo real tanque-a-tanque (mesma regra do agente: trechos plausíveis 3–30 km/L)
async function consumoReal(userId: string) {
  const { data: f } = await admin.from("transactions")
    .select("amount, litros, odometer, transaction_date")
    .eq("user_id", userId).gt("litros", 0).gt("odometer", 0)
    .order("odometer", { ascending: true }).limit(30);
  if (!f || f.length < 2) return null;
  let km = 0, litros = 0, custo = 0, trechos = 0;
  for (let i = 1; i < f.length; i++) {
    const dist = Number(f[i].odometer) - Number(f[i - 1].odometer);
    const l = Number(f[i].litros);
    if (!(dist > 0) || !(l > 0)) continue;
    const kml = dist / l;
    if (kml < 3 || kml > 30) continue;
    km += dist; litros += l; custo += Math.abs(Number(f[i].amount)); trechos++;
  }
  if (!trechos) return null;
  return { media_km_por_litro: Number((km / litros).toFixed(1)), custo_por_km: Number((custo / km).toFixed(2)) };
}

// geração de texto com o provedor de IA do /admin (OpenAI/Anthropic/Gemini)
async function aiText(s: any, sys: string, user: string): Promise<string> {
  const provider = s?.ai_provider || "anthropic";
  const model = s?.ai_model || (provider === "openai" ? "gpt-4o" : provider === "gemini" ? "gemini-2.5-flash" : "claude-opus-4-8");
  const key = provider === "openai" ? s?.openai_api_key : provider === "gemini" ? s?.gemini_api_key : s?.anthropic_api_key;
  if (!key) throw new Error("ia_nao_configurada");

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    return (await res.json()).choices?.[0]?.message?.content?.trim() || "";
  }
  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: sys }] }, contents: [{ role: "user", parts: [{ text: user }] }] }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const j = await res.json();
    return (j.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join("") || "").trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1200, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  return (((await res.json()).content || []).find((b: any) => b.type === "text")?.text || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  let p: any = {};
  try { p = await req.json(); } catch { /* */ }

  try {
    const { data: me } = await admin.from("users").select("name, dealership").eq("id", ud.user.id).single();
    const { data: veh } = await admin.from("accounts").select("*")
      .eq("user_id", ud.user.id).eq("is_active", true).limit(1).maybeSingle();

    // dados reais do carro
    const real = await consumoReal(ud.user.id);
    const oficial = (veh as any)?.consumo_oficial;
    const kmPorLitro = real?.media_km_por_litro
      ?? (Number(oficial?.estrada_kml || oficial?.rodovia_kml || oficial?.cidade_kml) > 0
        ? Number(oficial.estrada_kml || oficial.rodovia_kml || oficial.cidade_kml) : null);

    const { data: fuels } = await admin.from("transactions")
      .select("amount, litros").eq("user_id", ud.user.id).gt("litros", 0)
      .order("transaction_date", { ascending: false }).limit(5);
    let precoLitro: number | null = null;
    if (fuels?.length) {
      const tv = fuels.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
      const tl = fuels.reduce((s: number, t: any) => s + Number(t.litros), 0);
      if (tl > 0) precoLitro = Math.round((tv / tl) * 100) / 100;
    }

    const { data: rem } = await admin.from("maintenance_reminders").select("*")
      .eq("user_id", ud.user.id).eq("active", true);
    const kmAtual = Number(veh?.hodometro || 0);
    const pendencias = (rem || []).map((r: any) => ({
      item: r.title, faltam_km: Number(r.interval_km) - (kmAtual - Number(r.last_km || 0)),
    })).filter((x: any) => x.faltam_km <= 1500);

    const dados = {
      carro: veh ? `${veh.marca || ""} ${veh.modelo || ""} ${veh.ano_modelo || ""}`.trim() : null,
      consumo_km_por_litro: kmPorLitro,
      fonte_consumo: real ? "real (abastecimentos medidos)" : kmPorLitro ? "oficial INMETRO" : null,
      custo_por_km: real?.custo_por_km ?? null,
      preco_medio_litro: precoLitro,
      manutencoes_pendentes: pendencias,
      loja: me?.dealership || null,
    };

    const { data: s } = await admin.from("app_settings").select("ai_provider, ai_model, openai_api_key, anthropic_api_key, gemini_api_key").eq("id", 1).single();

    // PESQUISA EM TEMPO REAL da rota (pedágios atuais, balsa, condições) — busca web via OpenAI
    let pesquisa: string | null = null;
    if (p.destino && s?.openai_api_key) {
      pesquisa = await pesquisarRota(s.openai_api_key, String(p.origem || ""), String(p.destino));
    }

    const sys = `Você é o TotexCar Co-pilot no MODO VIAGEM: parceiro de estrada do dono do carro. Monte um plano de viagem de CARRO em português do Brasil, claro e amigável, formato: 🗺️ Rota e distância (ida) · ⛽ Custo de combustível (MOSTRE a conta com os dados reais: se houver custo_por_km use km total ida+volta × custo/km; senão (km ÷ km/L) × preço do litro; se faltar dado, diga o que falta medir) · 🛣️ Pedágios (LISTE praça a praça com valores e o total ida+volta) · ⛴️ Balsa/travessia SE a rota tiver (preço do carro, fila, compra antecipada) · 📍 Roteiro com 2-3 paradas boas · 🔧 Antes de viajar (se houver manutenções pendentes, recomende resolver ANTES, sugerindo a loja do cliente se houver) · ✅ Checklist: ${CHECKLIST.join(", ")}. ${pesquisa ? "Use a PESQUISA EM TEMPO REAL abaixo como FONTE DA VERDADE de distância, pedágios, balsa e condições — NÃO chute valores de rota; onde a pesquisa disser que não encontrou, seja transparente." : "Sem pesquisa ao vivo disponível: use sua base de rotas BR e SINALIZE que os valores de pedágio/travessia são aproximados e devem ser conferidos."} NUNCA invente preço de hospedagem — no máximo indique bairros/regiões boas de ficar. Se não houver destino, sugira 2-3 destes destinos em alta 2026 conforme o perfil: ${DESTINOS_2026.join("; ")}. Tom leve, zero jargão, no máximo 4 emojis.`;
    const userMsg = `Dados reais do carro do cliente: ${JSON.stringify(dados)}\n\nPedido: destino=${p.destino || "(sem destino, sugerir)"}; origem=${p.origem || "(não informada — assuma a mais provável ou peça)"}; dias=${p.dias || "?"}; perfil=${p.perfil || "não informado"}.${pesquisa ? `\n\nPESQUISA EM TEMPO REAL (fonte da verdade da rota):\n${pesquisa}` : ""}`;

    const plano = await aiText(s, sys, userMsg);

    return json({ ok: true, plano, dados, pesquisa_web: !!pesquisa });
  } catch (e) {
    console.error("viagem erro:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
