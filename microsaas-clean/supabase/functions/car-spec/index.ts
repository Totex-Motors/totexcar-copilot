// TotexCar Co-pilot — FICHA TÉCNICA do carro (concierge)
// Gera, com IA + busca na web, uma ficha técnica estruturada do veículo cadastrado e cacheia em
// accounts.ficha_tecnica. Serve tanto o app (JWT do dono) quanto o agente do WhatsApp (chamada
// interna com a service role + account_id). É idempotente: só regenera se não existir ou se force=true.
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

// campos que a IA deve preencher (referência p/ o prompt e p/ o app consumir)
const FICHA_HINT = `{
  "resumo": "1 frase sobre o carro (categoria, proposta)",
  "categoria": "hatch|sedan|SUV|picape|minivan|cupê (compacto/médio/grande)",
  "motor": "ex.: 1.0 turbo 3 cil. flex | 2.0 diesel | elétrico",
  "potencia_cv": "ex.: 116 (etanol) / 111 (gasolina)",
  "torque": "ex.: 16,8 kgfm",
  "cambio": "ex.: automático 6 marchas | CVT | manual 5",
  "tracao": "dianteira|traseira|4x4|integral",
  "combustivel": "flex|gasolina|diesel|elétrico|híbrido",
  "tanque_litros": "número ou null",
  "bateria_kwh": "número ou null (só EV/híbrido)",
  "autonomia_km": "número/faixa ou null (só EV)",
  "consumo_cidade": "ex.: 9–11 km/L (ou km/kWh p/ EV)",
  "consumo_estrada": "ex.: 12–14 km/L",
  "oleo": { "especificacao": "ex.: 5W30 sintético", "capacidade_litros": "ex.: 3,5", "troca_km": "número", "troca_meses": "número" },
  "revisao": { "intervalo_km": "número", "intervalo_meses": "número", "itens_principais": ["óleo+filtro", "filtro de ar", "filtro de combustível", "..."] },
  "pneu": { "medida": "ex.: 195/55 R16", "calibragem_psi": "ex.: 32 diant./30 tras." },
  "correia_ou_corrente": "ex.: corrente (não tem troca programada) | correia — trocar a cada 60 mil km",
  "velas_troca_km": "número ou faixa",
  "bateria_12v_vida": "ex.: 3–5 anos",
  "freios_pastilha_km": "ex.: 30–40 mil km (varia com uso)",
  "pontos_de_atencao": ["defeitos/recalls/cuidados conhecidos DESTE modelo/motor"],
  "dicas_donos": ["3–5 dicas práticas específicas p/ esse carro (economia, preservação, uso do combustível/EV)"],
  "confianca": "alta|media|baixa (o quão seguro você está dos números)",
  "observacao": "Valores de referência; confirme os exatos no manual do proprietário."
}`;

function buildPrompt(v: any) {
  const nome = [v.marca, v.modelo, v.versao].filter(Boolean).join(" ");
  const ano = v.ano_modelo || v.ano_fabricacao || "";
  return `Você é um especialista técnico automotivo do mercado BRASILEIRO. Pesquise na web a ficha técnica REAL do veículo abaixo e devolva SOMENTE um JSON (sem texto fora do JSON), em português do Brasil, seguindo EXATAMENTE este formato:

${FICHA_HINT}

VEÍCULO: ${nome} ${ano}${v.combustivel ? ` (${v.combustivel})` : ""}${v.placa ? ` — placa ${v.placa}` : ""}

REGRAS:
- Priorize dados do fabricante / fontes confiáveis brasileiras (site oficial, iCarros, Quatro Rodas, CarrosNaWeb, WebMotors).
- Se houver várias versões e você não souber a exata, use a versão mais comum desse ano e diga isso no "resumo".
- Quando não tiver certeza de um número, escreva uma faixa CONCRETA de valores (ex.: "9 a 11 km/L", "10.000 a 15.000 km") — NUNCA escreva a palavra "faixa" como valor. Se realmente não houver dado, use "Não especificado". Ajuste "confianca".
- NUNCA invente especificação exata de óleo/pneu/torque como se fosse certa — na dúvida, faixa + a "observacao" de conferir no manual.
- SEMPRE preencha "dicas_donos" (3 a 5) e "pontos_de_atencao" (2 a 4) — NUNCA deixe vazios. Se faltar dado específico do modelo, baseie no TIPO de motor/câmbio/categoria (ex.: PHEV → carregar de 20–80%, aproveitar regeneração, rodar elétrico na cidade; flex → cuidar da partida a frio; turbo → deixar o óleo circular antes de acelerar; diesel → Arla/DPF; SUV/4x4 → uso da tração). Devem ser úteis e práticas, não óbvias demais.
- Para elétrico/híbrido: foque em bateria (kWh), autonomia, consumo em km/kWh, cuidados de carga (20–80%) e regeneração.
- Responda apenas o JSON.`;
}

// chamada OpenAI com busca na web (modelo *-search-preview faz a pesquisa automaticamente)
async function generateFicha(v: any): Promise<{ ficha: any; fonte: string } | null> {
  const { data: cfg } = await admin.from("app_settings")
    .select("ai_provider, openai_api_key, anthropic_api_key, gemini_api_key").eq("id", 1).single();
  const openaiKey = cfg?.openai_api_key;
  if (!openaiKey) { console.error("sem openai_api_key p/ ficha"); return null; }

  const prompt = buildPrompt(v);
  // gpt-4o-search-preview: chat completions com busca web embutida
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-search-preview",
      web_search_options: {},
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("openai search falhou:", res.status, t.slice(0, 300));
    // fallback: modelo normal sem busca (ainda dá uma ficha útil)
    const res2 = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], temperature: 0.2 }),
    });
    if (!res2.ok) return null;
    const d2 = await res2.json();
    const ficha = parseJson(d2?.choices?.[0]?.message?.content || "");
    return ficha ? { ficha, fonte: "gpt-4o (sem busca)" } : null;
  }
  const d = await res.json();
  const content = d?.choices?.[0]?.message?.content || "";
  const ficha = parseJson(content);
  return ficha ? { ficha, fonte: "gpt-4o-search-preview (web)" } : null;
}

function parseJson(s: string): any | null {
  if (!s) return null;
  let t = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"); const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "missing_token" }, 401);

  let b: any = {};
  try { b = await req.json(); } catch { /* */ }
  const force = !!b.force;

  // resolve o veículo: interno (service role + account_id) OU dono (JWT)
  let account: any = null;
  if (jwt === SERVICE_ROLE && b.account_id) {
    const { data } = await admin.from("accounts").select("*").eq("id", b.account_id).maybeSingle();
    account = data;
  } else {
    const { data: ud, error } = await admin.auth.getUser(jwt);
    if (error || !ud?.user) return json({ error: "invalid_token" }, 401);
    const { data } = await admin.from("accounts").select("*")
      .eq("user_id", ud.user.id).eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
    account = data;
  }
  if (!account) return json({ error: "sem_veiculo" }, 404);
  if (!account.marca && !account.modelo) return json({ error: "veiculo_incompleto" }, 400);

  // cache: já tem ficha e não foi forçado → devolve
  if (account.ficha_tecnica && !force) {
    return json({ ok: true, cached: true, ficha: account.ficha_tecnica, fonte: account.ficha_fonte });
  }

  try {
    const out = await generateFicha(account);
    if (!out) return json({ error: "falha_geracao" }, 502);
    await admin.from("accounts").update({
      ficha_tecnica: out.ficha, ficha_fonte: out.fonte, ficha_at: new Date().toISOString(),
    }).eq("id", account.id);
    return json({ ok: true, cached: false, ficha: out.ficha, fonte: out.fonte });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
