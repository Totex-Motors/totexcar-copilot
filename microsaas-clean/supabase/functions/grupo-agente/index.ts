// NINA DA EQUIPE — webhook do número do Canal (uazapi) para mensagens de GRUPO.
// POST /functions/v1/grupo-agente?secret=...   (configurado pelo painel da loja: _shared/grupo-nina.ts → garantirWebhook)
// Responde só: em grupo autorizado pela loja · quando chamada ("Nina, …" ou marcada) · com dados da própria loja.
// Nunca responde conversa particular, nunca altera dados. Deploy com --no-verify-jwt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { secretOk, unauthorized } from "../_shared/secret.ts";
import { lerMensagem, chamouNina, lojaDoGrupo, buscarFichas, respostaSimples, promptNina, responderGrupo, canalCfg, fipeDoGrupo } from "../_shared/grupo-nina.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } });

async function aiTexto(sys: string, user: string): Promise<string> {
  const { data: s } = await admin.from("app_settings").select("ai_provider, ai_model, openai_api_key, anthropic_api_key, gemini_api_key").eq("id", 1).single();
  const provider = s?.ai_provider || "anthropic";
  const model = s?.ai_model || (provider === "openai" ? "gpt-4o" : provider === "gemini" ? "gemini-2.5-flash" : "claude-opus-4-8");
  const key = provider === "openai" ? s?.openai_api_key : provider === "gemini" ? s?.gemini_api_key : s?.anthropic_api_key;
  if (!key) throw new Error("ia_nao_configurada");
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
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
    return ((await res.json()).candidates?.[0]?.content?.parts?.map((x: any) => x.text).join("") || "").trim();
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 700, system: sys, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  return (((await res.json()).content || []).find((b: any) => b.type === "text")?.text || "").trim();
}

async function tratar(body: any) {
  const m = lerMensagem(body);
  if (!m || m.deMim || !m.texto || !m.id) return;
  if (!chamouNina(m, body?.owner)) return;
  const loja = await lojaDoGrupo(admin, m.grupo);
  if (!loja) return; // grupo não autorizado por nenhuma loja: silêncio
  const chave = `grupo:${m.grupo.split("@")[0]}`;
  // mesma mensagem entregue 2x pelo webhook
  const { data: ja } = await admin.from("whatsapp_events").select("id").eq("kind", "grupo_nina").eq("from_phone", chave).eq("raw->>id", m.id).limit(1);
  if (ja?.length) return;
  // trava de volume: no máximo 60 respostas por hora por grupo
  const { count } = await admin.from("whatsapp_events").select("id", { count: "exact", head: true }).eq("kind", "grupo_nina").eq("from_phone", chave)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((count || 0) >= 60) return;
  const { data: ev } = await admin.from("whatsapp_events").insert({
    from_phone: chave, kind: "grupo_nina", status: "received", raw: { id: m.id, grupo: m.grupo },
    parsed: { input: m.texto.slice(0, 1000), loja, autor: m.autorNome || null, autor_tel: m.autorTel || null },
  }).select("id").single();

  const pergunta = m.texto.replace(/@\d+/g, " ").trim();
  let resposta = "", nFichas = 0, viaIA = false;
  try {
    const fipe = await fipeDoGrupo(admin, pergunta);
    // pergunta só de FIPE não precisa das fichas de clientes (e evita casar "Corolla" com quem comprou um)
    const soFipe = !!fipe && ["exato", "versoes", "anos"].includes(fipe.status); // achou o modelo na tabela
    const d = soFipe ? { fichas: [], total_vendas: 0, casos_abertos: [] } : await buscarFichas(admin, loja, pergunta);
    nFichas = d.fichas.length;
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const dados = JSON.stringify(soFipe ? { consulta_fipe: fipe }
      : { clientes_encontrados: d.fichas, total_de_vendas_registradas: d.total_vendas, atendimentos_em_aberto_na_loja: d.casos_abertos, ...(fipe && !d.fichas.length ? { consulta_fipe: fipe } : {}) });
    try {
      resposta = await aiTexto(promptNina(loja, hoje), `DADOS:\n${dados}\n\nPergunta de ${m.autorNome || "alguém da equipe"} no grupo: "${pergunta}"`);
      viaIA = !!resposta;
    } catch (e) { console.error("grupo-agente IA:", String((e as any)?.message || e)); }
    if (!resposta) resposta = fipe?.status === "exato" ? `*${fipe.carro}*\nTabela FIPE (${fipe.mes_referencia || "atual"}): *${fipe.valor_fipe}*${fipe.tendencia ? `\n${fipe.tendencia}` : ""}`
      : soFipe ? "Achei mais de uma versão desse modelo. Me diga a versão e o ano." : respostaSimples(d.fichas);
  } catch (e) {
    console.error("grupo-agente:", e);
    resposta = "Não consegui consultar agora. Tenta de novo em instantes.";
  }
  const enviado = await responderGrupo(admin, m.grupo, resposta, m.id);
  if (ev?.id) await admin.from("whatsapp_events").update({ status: enviado ? "processed" : "send_failed", parsed: { input: m.texto.slice(0, 1000), reply: resposta.slice(0, 2000), loja, autor: m.autorNome || null, autor_tel: m.autorTel || null, fichas: nFichas, ia: viaIA } }).eq("id", ev.id);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (!secretOk(url)) return unauthorized();
  if (req.method !== "POST") return ok();
  const body = await req.json().catch(() => null);
  if (!body) return ok();
  // só eventos de mensagem, e só do número do Canal (o uazapi manda o token da instância no corpo)
  if (body.EventType && body.EventType !== "messages") return ok();
  const canal = await canalCfg(admin);
  if (!canal || (body.token && body.token !== canal.token)) return ok({ ok: true, ignorado: true });
  const p = tratar(body).catch((e) => console.error("grupo-agente tratar:", e));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p); else await p; // responde já ao uazapi e termina em segundo plano
  return ok();
});
