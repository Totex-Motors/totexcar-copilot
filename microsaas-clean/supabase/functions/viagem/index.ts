// TotexCar Co-pilot — MODO VIAGEM (web): plano de road trip com os dados REAIS do carro
// Mesmo motor do agente WhatsApp (tool planejar_viagem), exposto pro app: o front manda
// destino/origem/dias/perfil e recebe o plano pronto (IA) + os dados usados na conta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { pesquisarRota, pesquisarLugares } from "../_shared/route-research.ts";

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

    // PESQUISAS EM TEMPO REAL (paralelas): rota (pedágios/balsa/condições) + lugares (onde ficar/comer)
    let pesquisa: string | null = null;
    let lugares: string | null = null;
    if (p.destino && s?.openai_api_key) {
      [pesquisa, lugares] = await Promise.all([
        pesquisarRota(s.openai_api_key, String(p.origem || ""), String(p.destino)),
        pesquisarLugares(s.openai_api_key, String(p.destino), p.perfil ? String(p.perfil) : undefined),
      ]);
    }

    const sys = `Você é o TotexCar Co-pilot no MODO VIAGEM. Monte o plano de viagem de CARRO e responda APENAS com um JSON válido (sem markdown, sem crase), neste formato exato:
{
 "titulo": "Alphaville → Ilhabela",
 "resumo": "1-2 frases vendedoras e leves sobre a viagem",
 "rota": { "descricao": "rodovias principais e caminho", "distancia_km_ida": 210, "tempo_ida": "3h30", "condicoes": "obras/serra/dicas ou null" },
 "combustivel": { "conta": "explicação curta da conta com os números", "total_ida_volta": 260.50 },
 "pedagios": { "itens": [{ "praca": "nome/rodovia", "valor": 15.30 }], "total_ida_volta": 120.00, "obs": "obs ou null" },
 "balsa": { "descricao": "trecho da travessia", "preco_carro": 34.10, "dica": "fila/antecipado/site" } (ou null se a rota não tiver),
 "roteiro": [{ "titulo": "Parada X", "descricao": "por que parar" }],
 "hospedagem": [{ "faixa": "economica|intermediaria|charme", "nome": "...", "regiao": "...", "motivo": "reputação/por quê", "diaria": 450.00 (ou null se não encontrado) }],
 "comida": [{ "nome": "...", "especialidade": "prato/experiência" }],
 "passeios": ["..."],
 "antes_de_viajar": ["recomendações de manutenção pré-viagem, citando a loja do cliente se houver — ou lista vazia"],
 "checklist": ${JSON.stringify(CHECKLIST)}
}
REGRAS: combustível calculado com os dados REAIS do carro (se houver custo_por_km: km ida+volta × custo/km; senão (km ÷ km/L) × preço do litro; se faltar dado, explique na "conta" o que falta medir e use null no total). ${pesquisa || lugares ? "Use as PESQUISAS EM TEMPO REAL como FONTE DA VERDADE de rota, pedágios, balsa, hospedagens e restaurantes — NÃO chute valores nem invente estabelecimentos; onde a pesquisa não encontrou, use null." : "Sem pesquisa ao vivo: valores aproximados e diga isso nas obs."} NUNCA invente diária de hospedagem (null se não veio na pesquisa). Sem destino → "titulo": "Sugestões pra sua próxima viagem" e preencha "roteiro" com 2-3 destinos destes conforme o perfil: ${DESTINOS_2026.join("; ")}. Números como number (sem "R$"). Tudo em português do Brasil.`;
    const userMsg = `Dados reais do carro do cliente: ${JSON.stringify(dados)}\n\nPedido: destino=${p.destino || "(sem destino, sugerir)"}; origem=${p.origem || "(não informada)"}; dias=${p.dias || "?"}; perfil=${p.perfil || "não informado"}.${pesquisa ? `\n\nPESQUISA EM TEMPO REAL — ROTA (fonte da verdade):\n${pesquisa}` : ""}${lugares ? `\n\nPESQUISA EM TEMPO REAL — ONDE FICAR E COMER (fonte da verdade):\n${lugares}` : ""}`;

    const bruto = await aiText(s, sys, userMsg);
    // extrai o JSON (tolerante a cercas de código)
    let plano: any = null;
    try {
      let t = bruto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const a = t.indexOf("{"); const b = t.lastIndexOf("}");
      if (a >= 0 && b > a) t = t.slice(a, b + 1);
      plano = JSON.parse(t);
    } catch { /* cai no texto cru */ }

    return json({ ok: true, plano, plano_texto: plano ? null : bruto, dados, pesquisa_web: !!(pesquisa || lugares) });
  } catch (e) {
    console.error("viagem erro:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
