// TotexCar Co-pilot — Proativo composto por IA (MODULO-PROATIVO-TOTEXCAR.md v1.1)
// Regra de ouro: CÓDIGO CALCULA, LLM NARRA. O compositor recebe o insight pronto e só escreve.
// - composeProactive(): escreve a mensagem proativa (JSON: texto + variante de template + ângulo).
// - runExtractor(): após cada interação do webhook, atualiza o dossiê (user_memory) e os open_loops.
// - loadDossier(): carrega dossiê + loops para injetar no prompt (webhook e compositor).

export type AIConfig = { provider: string; model: string; key: string };

// modelo barato por provedor (extrator roda em TODA interação com conteúdo — custo importa)
const CHEAP_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-2.5-flash",
};
export function cheapModel(cfg: AIConfig): AIConfig {
  return { ...cfg, model: CHEAP_MODELS[cfg.provider] || cfg.model };
}

// ---------------- chamada de chat simples (sem tools), saída JSON ----------------
export async function chatJSON(cfg: AIConfig, system: string, user: string, maxTokens = 600, temperature = 0.7): Promise<any | null> {
  if (!cfg?.key) return null;
  try {
    let text = "";
    if (cfg.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({
          model: cfg.model, max_tokens: maxTokens, temperature,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      text = j.choices?.[0]?.message?.content || "";
    } else if (cfg.provider === "gemini") {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      text = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text).filter(Boolean).join("");
    } else {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: cfg.model, max_tokens: maxTokens, temperature, system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      text = (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }
    const clean = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(clean);
  } catch (e) {
    console.error("chatJSON falhou:", e);
    return null;
  }
}

// ---------------- dossiê + open loops ----------------
export async function loadDossier(supabase: any, userId: string): Promise<{ memorias: string; loops: string; loopsRaw: any[] }> {
  const [{ data: mems }, { data: loops }] = await Promise.all([
    supabase.from("user_memory").select("kind, content").eq("user_id", userId)
      .order("confidence", { ascending: false }).limit(10),
    supabase.from("open_loops").select("id, kind, summary, due_at").eq("user_id", userId)
      .eq("status", "aberto").order("created_at", { ascending: false }).limit(5),
  ]);
  const memorias = (mems || []).map((m: any) => `- [${m.kind}] ${m.content}`).join("\n") || "(vazio)";
  const loopsStr = (loops || []).map((l: any) =>
    `- [${l.id}] (${l.kind}) ${l.summary}${l.due_at ? ` — prazo ~${String(l.due_at).split("T")[0]}` : ""}`).join("\n") || "(nenhum)";
  return { memorias, loops: loopsStr, loopsRaw: loops || [] };
}

// ---------------- COMPOSITOR PROATIVO ----------------
export const PROACTIVE_VARIANTS = ["copilot_msg", "copilot_msg_sim", "copilot_msg_feito", "copilot_msg_ver"] as const;

const ANGLES = ["cuidado", "bolso", "conquista", "novidade"];
export function pickAngle(last?: string | null): string {
  const pool = ANGLES.filter((a) => a !== String(last || ""));
  return pool[Math.floor(Math.random() * pool.length)];
}

// guarda anti-recategorização: template UTILITY não pode carregar texto comercial
// (precedente: boas_vindas_cortesia foi recategorizada MARKETING pela Meta)
export function soundsLikeMarketing(text: string): boolean {
  return /(desconto|oferta|promo[cç]|aproveite|imperd[ií]vel|garanta (já|sua)|últim[ao]s? (vagas|unidades)|compre)/i.test(text);
}

const COMPOSITOR_SYSTEM = `Você é o **TotexCar Co-pilot**, o assistente de IA do carro do usuário (ecossistema Totexmotors), escrevendo UMA mensagem PROATIVA de WhatsApp — você está puxando assunto, não respondendo.

IDENTIDADE E TOM (idênticos ao agente do chat — é a mesma pessoa): português do Brasil, leve, direto, gente como a gente. Parceiro do dono, nunca script de telemarketing, nunca formal demais. No máximo 1 emoji na mensagem inteira. NÃO comece com saudação ("Olá", "Oi", "Bom dia") — o template já abre com "Olá!". FORMATO WHATSAPP: só *negrito* com asterisco; link é a URL pura colada no texto — NUNCA markdown [texto](url), NUNCA colchetes em volta de link.

REGRAS DURAS (violar = mensagem reprovada):
1. Use APENAS os dados do INSIGHT e do CONTEXTO abaixo. NUNCA invente número, data, preço, prazo ou condição. O que não está ali, não existe.
2. UMA mensagem = o insight principal. O secundário só entra se couber em UMA frase e tiver conexão natural. Na dúvida, corte.
3. Tamanho: no máximo 480 caracteres. Proativo bom é curto.
4. Feche com pergunta ou chamada de ação SEMPRE que houver próximo passo possível — a resposta reabre a conversa. Sem ação possível, feche com frase humana, sem pergunta forçada.
5. Não repita a estrutura/abertura da ÚLTIMA PROATIVA. Varie o gancho dentro do ÂNGULO DO DIA.
6. Copy do ecossistema (inviolável): NUNCA "sem fidelidade" ou "cancele quando quiser"; plano anual é "12 meses pelo preço de 10 (~17% off)"; recurso de multa é MODELO — a decisão é do órgão, nunca prometa que "vai cair"; nunca prometa preço/disponibilidade de estabelecimento; não empurre troca de carro.
7. Se o DOSSIÊ tiver algo conectado ao insight, USE (no máximo 1 referência) — é o que faz parecer que você conhece o dono.
8. Se houver OPEN LOOP relacionado, prefira cobrar o loop a falar do tema no abstrato ("conseguiu trocar o óleo?" > "o óleo vence em 300 km").
9. Tom de cuidado, não de cobrança. Mesmo vencimento de plano: avise como parceiro, não como fatura.
10. ENGAJAMENTO: se unanswered >= 3, a mensagem precisa valer MUITO a pena (segurança, dinheiro ou prazo). Caso contrário retorne {"pular": true}.

VARIANTE (os botões do WhatsApp são FIXOS por variante — escolha a que combina com o seu fechamento):
- "copilot_msg": sem botões (aviso sem ação)
- "copilot_msg_sim": botões [Sim, quero | Agora não] (você ofereceu ajuda/próximo passo)
- "copilot_msg_feito": botões [Já resolvi | Me ajuda] (follow-up de algo que ele ia fazer)
- "copilot_msg_ver": botões [Ver agora | Depois] (resumo/extrato/relatório pra abrir)

SAÍDA — APENAS JSON (sem markdown):
{"pular": false, "texto": "mensagem pronta (*negrito* com asterisco)", "variante": "copilot_msg|copilot_msg_sim|copilot_msg_feito|copilot_msg_ver", "angulo_usado": "cuidado|bolso|conquista|novidade", "assunto": "etiqueta curta (ex.: resumo_pro, oleo, multa_prazo)"}

EXEMPLOS:

# Resumo PRO (ângulo conquista):
INSIGHT: {"tipo":"resumo_pro_semanal","periodo":"13 a 19/07","receita":1240,"despesa":380,"lucro":860,"lucro_km":2.11,"lucro_km_semana_anterior":1.85,"km":408}
DOSSIÊ: abastece etanol no Shell · roda de noite | ENGAJAMENTO: 0
SAÍDA: {"pular":false,"texto":"Marcos, semana boa! Faturou R$ 1.240, gastou R$ 380 → *sobraram R$ 860*. Seu lucro por km subiu pra R$ 2,11 (era R$ 1,85) 💪 Quer ver onde dá pra melhorar ainda mais?","variante":"copilot_msg_sim","angulo_usado":"conquista","assunto":"resumo_pro"}

# Follow-up de open loop (ângulo cuidado):
INSIGHT: {"tipo":"open_loop_vencendo","summary":"disse que ia trocar o óleo no fim de semana","km_restante":320}
DOSSIÊ: prefere respostas curtas | ENGAJAMENTO: 1
SAÍDA: {"pular":false,"texto":"E aí, Renata — conseguiu trocar o óleo no fim de semana? Pergunto porque já tá entrando na faixa dos 300 km.","variante":"copilot_msg_feito","angulo_usado":"cuidado","assunto":"oleo"}

# Prazo de recurso D-3 (ângulo cuidado):
INSIGHT: {"tipo":"multa_prazo","dias":3,"descricao":"avanço de sinal","valor":293.47,"recurso_pronto":true}
ENGAJAMENTO: 0
SAÍDA: {"pular":false,"texto":"Faltam *3 dias* pro prazo do recurso da multa de avanço de sinal (R$ 293,47). Sua minuta já tá pronta — a decisão é do órgão, mas recorrer no prazo aumenta suas chances. Quer revisar o texto comigo?","variante":"copilot_msg_sim","angulo_usado":"cuidado","assunto":"multa_prazo"}

# Insight fraco + engajamento baixo:
INSIGHT: {"tipo":"dica_generica","tema":"calibragem"} | ENGAJAMENTO: 3
SAÍDA: {"pular":true}`;

export type ComposeInput = {
  insight: any;
  angulo: string;
  memorias: string;
  loops: string;
  ultima: string;
  unanswered: number;
  nome: string;
  carro: string;
  pro: boolean;
  loja: string;
};

export type ComposeResult = { texto: string; variante: string; angulo_usado: string; assunto: string };

export async function composeProactive(cfg: AIConfig, inp: ComposeInput): Promise<ComposeResult | "pular" | null> {
  const user = `INSIGHT DO DIA (calculado em código — fonte da verdade):
${JSON.stringify(inp.insight)}

ÂNGULO DO DIA: ${inp.angulo}

DOSSIÊ DO DONO:
${inp.memorias}

OPEN LOOPS ABERTOS:
${inp.loops}

ÚLTIMA PROATIVA ENVIADA:
${inp.ultima || "(nenhuma)"}

ENGAJAMENTO: ${inp.unanswered} proativos seguidos sem resposta.

CONTEXTO RÁPIDO: nome=${inp.nome || "?"} · carro=${inp.carro || "?"} · modo PRO=${inp.pro ? "sim" : "não"} · loja=${inp.loja || "—"}

Responda com o JSON.`;
  const out = await chatJSON(cfg, COMPOSITOR_SYSTEM, user, 500, 0.7);
  if (!out) return null;
  if (out.pular === true) return "pular";
  // WhatsApp não renderiza markdown de link — se a IA escapar um [texto](url), fica só a URL
  const texto = String(out.texto || "").trim().replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, "$2");
  if (!texto || texto.length > 550) return null;
  if (soundsLikeMarketing(texto)) { console.error("compositor reprovado (tom comercial):", texto.slice(0, 120)); return null; }
  const variante = (PROACTIVE_VARIANTS as readonly string[]).includes(out.variante) ? out.variante : "copilot_msg";
  return {
    texto,
    variante,
    angulo_usado: ANGLES.includes(out.angulo_usado) ? out.angulo_usado : inp.angulo,
    assunto: String(out.assunto || "proativo").slice(0, 40),
  };
}

// ---------------- EXTRATOR DE MEMÓRIA (roda após cada interação, modelo barato) ----------------
const EXTRACTOR_SYSTEM = `Você é o extrator de memória do TotexCar Co-pilot. Analise a TROCA abaixo entre o usuário e o assistente e devolva APENAS um JSON (sem markdown) com o que merece ser lembrado a longo prazo.

Extraia SOMENTE:
1. "memorias" — fatos duráveis, padrões ou preferências que ajudem a personalizar o futuro:
   - padrao: comportamentos recorrentes ("abastece etanol no Shell", "roda de noite")
   - preferencia: como ele gosta de ser atendido ("prefere respostas curtas", "manda áudio")
   - fato: dados estáveis ("tem 2 filhos", "trabalha com app desde 2023", "carro é flex")
   NÃO extraia: valores pontuais do dia, gastos (já ficam no banco), saudações, nada óbvio.
2. "loops_novos" — promessas/intenções em aberto ditas pelo usuário (ex.: vai trocar o óleo, vai avaliar o carro, vai protocolar recurso, vai viajar). kind: um de [manutencao_prometida, avaliacao_incompleta, recurso_multa, viagem_planejada, documento_pendente, compra_intencao, outro]. due_at: se deu prazo ("fim de semana" → data aproximada ISO), senão null.
3. "loops_resolvidos" — ids dos OPEN LOOPS ABERTOS que esta troca claramente resolveu.

Formato EXATO:
{"memorias":[{"kind":"padrao|preferencia|fato","content":"...","confidence":0.0}],"loops_novos":[{"kind":"...","summary":"...","due_at":"AAAA-MM-DD ou null"}],"loops_resolvidos":["id1"]}
Se nada se aplicar: {"memorias":[],"loops_novos":[],"loops_resolvidos":[]}`;

// mensagens sem conteúdo útil não pagam extração
export function worthExtracting(input: string): boolean {
  const t = String(input || "").trim();
  if (t.length < 8) return false;
  if (/^(ok|blz|beleza|valeu+|obrigad[oa]!*|👍|🙏|❤️|boa|show|top|legal|sim|n[aã]o|bom dia|boa tarde|boa noite)[!.\s🙂😀👍🙏]*$/i.test(t)) return false;
  return true;
}

export async function runExtractor(supabase: any, cfg: AIConfig, userId: string, input: string, reply: string): Promise<void> {
  try {
    if (!worthExtracting(input)) return;
    const { data: loops } = await supabase.from("open_loops")
      .select("id, kind, summary, due_at").eq("user_id", userId).eq("status", "aberto").limit(10);
    const user = `TROCA:
Usuário: ${String(input).slice(0, 1200)}
Assistente: ${String(reply).slice(0, 800)}

OPEN LOOPS ABERTOS:
${JSON.stringify(loops || [])}

Hoje é ${new Date().toISOString().split("T")[0]}. Responda com o JSON.`;
    const out = await chatJSON(cheapModel(cfg), EXTRACTOR_SYSTEM, user, 400, 0);
    if (!out) return;

    const memorias = (out.memorias || []).filter((m: any) =>
      m?.content && ["padrao", "preferencia", "fato"].includes(m.kind) && Number(m.confidence ?? 0.7) >= 0.6);
    for (const m of memorias.slice(0, 4)) {
      await supabase.from("user_memory").upsert({
        user_id: userId, kind: m.kind, content: String(m.content).slice(0, 300),
        confidence: Math.min(1, Number(m.confidence ?? 0.7)),
        source: `whatsapp ${new Date().toISOString().split("T")[0]}`, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,kind,content", ignoreDuplicates: false });
    }

    const openIds = new Set((loops || []).map((l: any) => String(l.id)));
    for (const l of (out.loops_novos || []).slice(0, 3)) {
      if (!l?.summary) continue;
      const due = l.due_at && /^\d{4}-\d{2}-\d{2}/.test(String(l.due_at)) ? String(l.due_at).slice(0, 10) : null;
      await supabase.from("open_loops").insert({
        user_id: userId, kind: String(l.kind || "outro").slice(0, 40),
        summary: String(l.summary).slice(0, 300), due_at: due,
      });
    }

    for (const id of (out.loops_resolvidos || [])) {
      if (!openIds.has(String(id))) continue; // só resolve loop que existe e está aberto
      await supabase.from("open_loops").update({ status: "resolvido", resolved_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
    }
  } catch (e) {
    console.error("runExtractor falhou (não bloqueia a conversa):", e);
  }
}
