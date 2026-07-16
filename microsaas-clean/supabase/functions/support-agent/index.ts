// TotexCar Co-pilot — SUPORTE (super agente de atendimento, chat web)
// Chat stateless (o front manda o histórico). Resolve dúvidas de produto/planos/uso com uma
// base de conhecimento completa; o que não conseguir resolver vira CHAMADO (support_tickets)
// e NOTIFICA o dono no WhatsApp (app_settings.support_owner_phone) — provider dual (uazapi|meta).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { waSendTemplate } from "../_shared/wa.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

let _settings: any = null;
async function getSettings() {
  if (_settings) return _settings;
  const { data } = await admin.from("app_settings").select("*").eq("id", 1).single();
  _settings = data || {};
  return _settings;
}

async function getAIConfig() {
  const s = await getSettings();
  const provider = s?.ai_provider || "anthropic";
  let key = "";
  if (provider === "openai") key = s?.openai_api_key || "";
  else if (provider === "gemini") key = s?.gemini_api_key || "";
  else key = s?.anthropic_api_key || ANTHROPIC_API_KEY;
  const defaults: Record<string, string> = { anthropic: "claude-opus-4-8", openai: "gpt-4o", gemini: "gemini-2.5-flash" };
  return { provider, model: s?.ai_model || defaults[provider], key };
}

// Notifica o dono (iniciado pelo negócio) → TEMPLATE chamado_suporte na API oficial.
async function notifyOwner(params: string[]) {
  const s = await getSettings();
  const phone = (s.support_owner_phone || "").replace(/\D/g, "");
  if (!phone) { console.error("escalação: telefone do dono não configurado"); return false; }
  try { return await waSendTemplate(s, phone, "chamado_suporte", params); }
  catch (e) { console.error("notifyOwner:", e); return false; }
}

const TOOLS = [
  {
    name: "abrir_chamado",
    description: "Abre um chamado para o responsável humano (dono do Totexmotors) e o notifica no WhatsApp. Use quando NÃO conseguir resolver: problema de pagamento/cobrança, reembolso ou cancelamento, bug/erro no sistema, dado que você não consegue corrigir, reclamação séria, ou quando o cliente PEDIR falar com um humano. Use também para registrar SUGESTÕES de melhoria (assunto 'Sugestão').",
    parameters: {
      type: "object",
      properties: {
        assunto: { type: "string", description: "Assunto curto, ex.: 'Pagamento não liberado', 'Sugestão'" },
        resumo: { type: "string", description: "Resumo objetivo do problema/sugestão + o que já foi tentado" },
        urgencia: { type: "string", enum: ["baixa", "media", "alta"] },
      },
      required: ["assunto", "resumo", "urgencia"],
    },
  },
];

type Ctx = { user: any; profile: any; messages: any[]; escalated: { id: string | null } };

async function dispatchTool(name: string, args: any, ctx: Ctx): Promise<any> {
  if (name !== "abrir_chamado") return { error: "ferramenta_desconhecida" };
  try {
    const { data: t, error } = await admin.from("support_tickets").insert({
      user_id: ctx.user.id,
      name: ctx.profile?.name || null,
      email: ctx.profile?.email || ctx.user.email || null,
      phone: ctx.profile?.phone || null,
      channel: "web",
      subject: String(args?.assunto || "Chamado"),
      description: String(args?.resumo || ""),
      status: "escalado",
      transcript: ctx.messages.slice(-12),
    }).select("id").single();
    if (error) return { ok: false, error: error.message };
    ctx.escalated.id = t.id;

    const urg = String(args?.urgencia || "media").toUpperCase();
    await notifyOwner([
      urg,
      `${ctx.profile?.name || "?"} · ${ctx.profile?.email || "?"} · ${ctx.profile?.phone || "s/ tel"}`,
      `${ctx.profile?.plan || "?"} (${ctx.profile?.subscription_status || "?"})${ctx.profile?.dealership ? ` · Loja: ${ctx.profile.dealership}` : ""}`,
      String(args?.assunto || ""),
      String(args?.resumo || ""),
      `${t.id} (canal: painel web)`,
    ]);
    return { ok: true, ticket_id: t.id, message: "Chamado aberto e responsável notificado no WhatsApp." };
  } catch (e) {
    return { ok: false, error: String((e as any)?.message || e) };
  }
}

const MAX_TURNS = 4;

async function runOpenAI(cfg: any, system: string, history: any[], ctx: Ctx): Promise<string> {
  const messages: any[] = [{ role: "system", content: system }, ...history];
  const tools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1000, messages, tools, tool_choice: "auto" }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const m = j.choices[0].message;
    messages.push(m);
    if (m.tool_calls?.length) {
      for (const tc of m.tool_calls) {
        let a: any = {}; try { a = JSON.parse(tc.function.arguments || "{}"); } catch { /* */ }
        const r = await dispatchTool(tc.function.name, a, ctx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(r) });
      }
      continue;
    }
    return m.content || "";
  }
  return "";
}

async function runAnthropic(cfg: any, system: string, history: any[], ctx: Ctx): Promise<string> {
  const messages: any[] = history.map((m) => ({ role: m.role, content: m.content }));
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1000, system, tools, messages }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const j = await res.json();
    messages.push({ role: "assistant", content: j.content });
    if (j.stop_reason === "tool_use") {
      const results: any[] = [];
      for (const b of j.content || []) {
        if (b.type === "tool_use") {
          const r = await dispatchTool(b.name, b.input || {}, ctx);
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r) });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    return (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
  }
  return "";
}

async function runGemini(cfg: any, system: string, history: any[], ctx: Ctx): Promise<string> {
  const contents: any[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const tools = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents, tools, tool_config: { function_calling_config: { mode: "AUTO" } } }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const parts = j.candidates?.[0]?.content?.parts || [];
    contents.push({ role: "model", parts });
    const calls = parts.filter((p: any) => p.functionCall);
    if (calls.length) {
      const fr: any[] = [];
      for (const c of calls) {
        const r = await dispatchTool(c.functionCall.name, c.functionCall.args || {}, ctx);
        fr.push({ functionResponse: { name: c.functionCall.name, response: { result: r } } });
      }
      contents.push({ role: "user", parts: fr });
      continue;
    }
    return parts.map((p: any) => p.text).filter(Boolean).join("\n").trim();
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  _settings = null;

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_token" }, 401);
  const { data: ud, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ud?.user) return json({ error: "invalid_token" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const history = Array.isArray(body.messages) ? body.messages.slice(-16).map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 2000),
  })) : [];
  if (!history.length) return json({ error: "sem_mensagens" }, 400);

  const { data: profile } = await admin.from("users").select("*").eq("id", ud.user.id).single();
  const { data: vehicles } = await admin.from("accounts").select("name, marca, modelo, placa, hodometro")
    .eq("user_id", ud.user.id).eq("is_active", true).limit(1);
  const vehicle = vehicles?.[0] || null;

  const s = await getSettings();
  const appUrl = (s.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");

  const system = `Você é o SUPORTE oficial do TotexCar Co-pilot / TotexCar Co-pilot (ecossistema Totexmotors). Português do Brasil, cordial, objetivo, no máximo 1 emoji. Seu objetivo: RESOLVER o problema do cliente aqui mesmo. Você é o "braço direito" do dono — só escale o que realmente precisar de humano.

BASE DE CONHECIMENTO DO PRODUTO:
- O produto: app web (${appUrl}) + agente de IA no WhatsApp (TotexCar Co-pilot). O cliente registra TUDO do carro mandando foto/áudio/texto no WhatsApp.
- Registrar gasto: foto do cupom/nota, áudio ou texto no WhatsApp → a IA lê, categoriza e registra. Também dá pra lançar manualmente no app (Gastos).
- CONSUMO (km/L): a cada abastecimento o cliente manda a foto do cupom E a foto do hodômetro. A partir do 2º abastecimento com km, a IA calcula: km rodados ÷ litros = km/L + custo por km. Aparece no dashboard (card "Meu consumo"). Se o consumo não aparece: falta o km em ≥2 abastecimentos.
- MULTAS: foto do auto de infração no WhatsApp → a IA extrai os dados, cruza com falhas processuais da lei (prazo de notificação Art. 281 CTB, dados obrigatórios Res. 918/2022, dupla notificação, aferição INMETRO do radar, sinalização) e gera um MODELO de recurso. Fica em /multas no app (copiar/baixar). O recurso é um modelo — a decisão é do órgão; NUNCA prometa que a multa cai. Alertas de prazo do recurso chegam no WhatsApp.
- Manutenção por km (/manutencao): lembretes por intervalo de km (ex.: troca de óleo); usa o hodômetro.
- Financiamento (/financiamento): cadastra parcelas (leitor de linha digitável de boleto), alertas de vencimento de parcela.
- Vencimentos: IPVA, licenciamento, seguro e CNH → alertas automáticos no WhatsApp (30/15/7/1/0 dias).
- Indique e Ganhe (/indique): o cliente indica carros do estoque da loja parceira com o link dele e ganha comissão em PIX quando a venda é confirmada. Cadastrar a chave PIX na página.
- Vender meu carro (/recompra): avaliação FIPE + pedido de recompra pela loja parceira.
- Meu Veículo (/settings): dados do carro; botão "Buscar pela placa" autopreenche.
- Rastreamento GPS: recurso OPCIONAL/premium, ainda não ativo para todos — se perguntarem, diga que está chegando como opcional.
- PLANOS E PAGAMENTO: teste grátis de 7 dias (sem cartão). Plano Totex Care: R$ 109,90/mês. Membros do ecossistema Totexmotors (cupom da loja parceira): R$ 10,99/mês. Plano ANUAL: R$ 109,90 à vista — 12 meses pelo preço de 10 (~17% de desconto). Pagamento por PIX ou cartão (Asaas), em /plans. Cupom se aplica em /plans. ⚠️ NUNCA diga "sem fidelidade" ou "cancele quando quiser".
- Acesso bloqueado ("Assine para continuar"): o teste acabou ou o pagamento está pendente → assinar em /plans; libera na hora após a confirmação.
- WhatsApp não responde: o número de WhatsApp do cliente precisa ser O MESMO cadastrado no perfil (só dígitos). Conferir em /settings; após pagar, o acesso volta automaticamente.

QUANDO ESCALAR (abrir_chamado): pagamento cobrado e não liberado, pedido de reembolso/cancelamento, erro/bug no sistema, dado errado que você não consegue orientar a corrigir, reclamação séria, ou o cliente pediu explicitamente um humano. TAMBÉM registre SUGESTÕES de melhoria (assunto "Sugestão", urgência baixa). Antes de escalar, tente resolver com a base acima e colete: o que aconteceu, quando, e-mail/telefone. Ao escalar, avise o cliente que o responsável já foi notificado no WhatsApp e vai retornar.

DADOS DO CLIENTE (use para personalizar):
${JSON.stringify({
    nome: profile?.name, email: profile?.email, telefone: profile?.phone,
    plano: profile?.plan, status: profile?.subscription_status,
    trial_termina: profile?.trial_ends_at, loja: profile?.dealership,
    veiculo: vehicle ? `${vehicle.marca || ""} ${vehicle.modelo || ""} ${vehicle.placa || ""}`.trim() : null,
  })}`;

  try {
    const cfg = await getAIConfig();
    if (!cfg.key) return json({ error: "ia_nao_configurada" }, 500);
    const ctx: Ctx = { user: ud.user, profile, messages: history, escalated: { id: null } };
    let reply = "";
    if (cfg.provider === "openai") reply = await runOpenAI(cfg, system, history, ctx);
    else if (cfg.provider === "gemini") reply = await runGemini(cfg, system, history, ctx);
    else reply = await runAnthropic(cfg, system, history, ctx);
    if (!reply) reply = "Desculpe, tive um problema aqui. Pode repetir sua pergunta?";
    return json({ ok: true, reply, escalated: !!ctx.escalated.id, ticket_id: ctx.escalated.id });
  } catch (e) {
    console.error("support-agent:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
