// NINA DA EQUIPE no grupo do WhatsApp (número do Canal, uazapi — o número oficial da Meta não entra em grupo).
// Só CONSULTA dados da loja dona do grupo (vendas/pós-venda): carro, placa, compra, garantia, transferência,
// km, troca de óleo e atendimentos. Nunca altera nada, nunca responde fora dos grupos autorizados pela loja
// (posvenda_config.grupo_id + nina_grupos) e nunca mostra CPF.
import { estadoOleo, resumoOleo } from "./oleo.ts";

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const placaN = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const dataBR = (s: unknown) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : null);
const PARADAS = new Set(("nina a o os as um uma de da do das dos e em no na nos nas que qual quais quem como quando onde por pra para com sem me te se ja tem ter foi ser esta esta estao sabe sabia saber sobre " +
  "carro veiculo cliente placa garantia transferencia vistoria revisao oleo km telefone numero contato status situacao dele dela meu minha seu sua favor obrigado obrigada ola oi bom dia boa tarde noite ai la ver vc voce").split(" "));

// ---------- canal uazapi ----------
export async function canalCfg(sb: any): Promise<{ url: string; token: string } | null> {
  const { data: st } = await sb.from("app_settings").select("canal_uazapi_url, canal_uazapi_token").eq("id", 1).single();
  const url = String(st?.canal_uazapi_url || "").replace(/\/+$/, ""), token = String(st?.canal_uazapi_token || "");
  return url && token ? { url, token } : null;
}
export async function responderGrupo(sb: any, grupo: string, texto: string, replyId?: string | null): Promise<boolean> {
  if (!/^[\w.-]+@g\.us$/.test(grupo)) return false; // regra dura: só grupo
  const c = await canalCfg(sb);
  if (!c) return false;
  const corpo: Record<string, unknown> = { number: grupo, text: texto.slice(0, 3500) };
  if (replyId) corpo.replyid = replyId;
  try {
    let r = await fetch(`${c.url}/send/text`, { method: "POST", headers: { "content-type": "application/json", token: c.token }, body: JSON.stringify(corpo) });
    if (!r.ok && replyId) { delete corpo.replyid; r = await fetch(`${c.url}/send/text`, { method: "POST", headers: { "content-type": "application/json", token: c.token }, body: JSON.stringify(corpo) }); }
    if (!r.ok) console.error("nina grupo envio:", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) { console.error("nina grupo envio:", e); return false; }
}

// ---------- mensagem recebida (formato do webhook do uazapi; leitura tolerante a variações) ----------
export type MsgGrupo = { id: string; grupo: string; texto: string; deMim: boolean; autorTel: string; autorNome: string; mencoes: string[] };
export function lerMensagem(body: any): MsgGrupo | null {
  const m = body?.message || body?.data?.message || body?.data || body;
  if (!m || typeof m !== "object") return null;
  const key = m.key || {};
  const grupo = [m.chatid, m.chatId, m.remoteJid, key.remoteJid, body?.chat?.wa_chatid, body?.chat?.id, m.chat].find((v) => typeof v === "string" && /@g\.us$/.test(v));
  if (!grupo) return null;
  const c = m.content;
  const texto = [m.text, typeof c === "string" ? c : null, c?.text, c?.conversation, c?.extendedTextMessage?.text, c?.caption, m.body, m.message?.conversation, m.message?.extendedTextMessage?.text, m.caption]
    .find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const ctx = c?.contextInfo || m.contextInfo || m.message?.extendedTextMessage?.contextInfo || {};
  const menc = [m.mentions, m.mentionedJid, ctx.mentionedJid, ctx.mentionedJID].find((v) => Array.isArray(v) || typeof v === "string");
  return {
    id: String(m.messageid || m.messageId || m.id || key.id || ""),
    grupo: String(grupo),
    texto: String(texto || "").trim(),
    deMim: m.fromMe === true || key.fromMe === true || m.wasSentByApi === true,
    autorTel: dig(String(m.sender_pn || m.sender || m.participant || key.participant || "").split("@")[0]),
    autorNome: String(m.senderName || m.pushName || m.notifyName || "").slice(0, 60),
    mencoes: (Array.isArray(menc) ? menc : String(menc || "").split(",")).map((x: any) => dig(String(x).split("@")[0])).filter(Boolean),
  };
}
// chamou a Nina? ("Nina, …", "@nina", ou marcou o número dela)
export function chamouNina(m: MsgGrupo, meuNumero?: string | null): boolean {
  if (/(^|[^a-z0-9])nina([^a-z0-9]|$)/.test(norm(m.texto))) return true;
  const eu = dig(meuNumero).slice(-8);
  return !!eu && m.mencoes.some((x) => x.slice(-8) === eu);
}

// ---------- loja do grupo ----------
export async function lojaDoGrupo(sb: any, grupo: string): Promise<string | null> {
  const { data } = await sb.from("posvenda_config").select("*");
  for (const c of data || []) {
    const extras = Array.isArray(c.nina_grupos) ? c.nina_grupos.map((g: any) => String(g?.id || g)) : [];
    if (c.grupo_id === grupo || extras.includes(grupo)) return c.dealership;
  }
  return null;
}

// ---------- busca dos clientes da loja citados na pergunta ----------
export async function buscarFichas(sb: any, loja: string, pergunta: string): Promise<{ fichas: any[]; total_vendas: number; casos_abertos: any[] }> {
  const [{ data: js }, { data: tags }, { data: ents }, { data: casos }, { data: equipe }] = await Promise.all([
    sb.from("postsale_journeys").select("id, customer_name, customer_phone, car_desc, purchase_date, warranty_until, revisao_proxima, transfer_status, transfer, vendedor_id, user_id, nps_score, status")
      .eq("dealership", loja).order("purchase_date", { ascending: false }).limit(1500),
    sb.from("car_tags").select("journey_id, label, placa, km_entrega").eq("dealership", loja).not("journey_id", "is", null).limit(2000),
    sb.from("entrega_checklists").select("journey_id, placa, km, status, iniciado_em").eq("dealership", loja).limit(2000),
    sb.from("posvenda_casos").select("numero, customer_name, customer_phone, car_desc, placa, motivo, resumo, prioridade, status, journey_id, created_at")
      .eq("dealership", loja).in("status", ["aberto", "em_atendimento"]).order("created_at", { ascending: false }).limit(30),
    sb.from("posvenda_equipe").select("id, nome").eq("dealership", loja),
  ]);
  const jornadas = js || [];
  const tagDe = new Map<string, any>(); for (const t of tags || []) if (t.journey_id) tagDe.set(t.journey_id, t);
  const entDe = new Map<string, any>(); for (const e of ents || []) if (e.journey_id && !entDe.has(e.journey_id)) entDe.set(e.journey_id, e);
  const nomeEq = new Map<string, string>((equipe || []).map((m: any) => [m.id, m.nome]));

  const p = norm(pergunta);
  const palavras = p.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !PARADAS.has(w));
  const numeros = (pergunta.match(/\d[\d\s().-]{6,}\d/g) || []).map(dig).filter((d) => d.length >= 8);
  const placas = (pergunta.toUpperCase().match(/\b[A-Z]{3}[-\s]?\d[A-Z0-9]\d{2}\b/g) || []).map(placaN);

  const pontuar = (j: any) => {
    const nome = norm(j.customer_name), carro = norm(j.car_desc), tel = dig(j.customer_phone);
    const pl = placaN(tagDe.get(j.id)?.placa || entDe.get(j.id)?.placa || "");
    let s = 0;
    for (const w of palavras) { if (nome.split(/\s+/).includes(w)) s += 5; else if (nome.includes(w)) s += 3; if (carro.includes(w)) s += 2; }
    for (const n of numeros) if (tel && (tel.endsWith(n.slice(-8)) || n.endsWith(tel.slice(-8)))) s += 10;
    for (const x of placas) if (pl && pl === x) s += 12;
    return s;
  };
  const top = jornadas.map((j: any) => ({ j, s: pontuar(j) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 6);
  // placa citada que só existe no carro cadastrado do cliente (accounts)
  if (!top.length && placas.length) {
    const { data: accs } = await sb.from("accounts").select("user_id, placa").in("placa", placas).limit(5);
    const uids = new Set((accs || []).map((a: any) => a.user_id));
    for (const j of jornadas) if (j.user_id && uids.has(j.user_id)) top.push({ j, s: 12 });
  }

  const fichas: any[] = [];
  for (const { j } of top) {
    const tag = tagDe.get(j.id), ent = entDe.get(j.id);
    let acc: any = null, oleo: string | null = null;
    if (j.user_id) {
      const { data: a } = await sb.from("accounts").select("id, name, marca, modelo, ano_modelo, placa, cor, hodometro, licenciamento_vencimento, ipva_vencimento, created_at")
        .eq("user_id", j.user_id).eq("is_active", true).limit(1);
      acc = a?.[0] || null;
      if (acc) {
        try {
          const { data: u } = await sb.from("users").select("id, driver_mode").eq("id", j.user_id).maybeSingle();
          oleo = resumoOleo(await estadoOleo(sb, u || { id: j.user_id }, acc));
        } catch { /* sem dados de óleo */ }
      }
    }
    const T = j.transfer || {};
    fichas.push({
      cliente: j.customer_name, telefone: j.customer_phone, carro: j.car_desc || acc?.name || null,
      placa: acc?.placa || tag?.placa || ent?.placa || null, cor: acc?.cor || null, ano_modelo: acc?.ano_modelo || null,
      etiqueta: tag?.label || null,
      data_compra: dataBR(j.purchase_date), vendedor: j.vendedor_id ? nomeEq.get(j.vendedor_id) || null : null,
      garantia_ate: dataBR(j.warranty_until), proxima_revisao: dataBR(j.revisao_proxima),
      transferencia: { status: j.transfer_status || "pendente", vistoria: !!T.vistoria, atpv_assinada: !!T.atpv, taxas_detran: !!T.taxas, debitos_quitados: !!T.debitos, comunicacao_de_venda: !!T.comunicacao, crlv_no_nome_do_cliente: !!T.crlv_novo },
      km_na_entrega: ent?.km || tag?.km_entrega || null, km_atual_registrado: acc?.hodometro || null,
      troca_de_oleo: oleo, usa_o_copilot: !!j.user_id, nota_nps: j.nps_score ?? null,
      atendimentos_abertos: (casos || []).filter((c: any) => c.journey_id === j.id || dig(c.customer_phone).slice(-8) === dig(j.customer_phone).slice(-8))
        .map((c: any) => ({ numero: c.numero, motivo: c.motivo, resumo: c.resumo, status: c.status, prioridade: c.prioridade })),
    });
  }
  return {
    fichas, total_vendas: jornadas.length,
    casos_abertos: (casos || []).map((c: any) => ({ numero: c.numero, cliente: c.customer_name, carro: c.car_desc, placa: c.placa, motivo: c.motivo, status: c.status, prioridade: c.prioridade, aberto_em: dataBR(c.created_at) })),
  };
}

// resposta sem IA (IA fora do ar ou sem chave): o essencial das fichas
export function respostaSimples(fichas: any[]): string {
  if (!fichas.length) return "Não achei esse cliente nas vendas da loja. Me diga o nome completo, o telefone ou a placa.";
  return fichas.slice(0, 4).map((f) =>
    `*${f.cliente || "Cliente"}* · ${f.carro || "carro não informado"}\nPlaca: ${f.placa || "não registrada"} · Compra: ${f.data_compra || "?"}${f.garantia_ate ? ` · Garantia até ${f.garantia_ate}` : ""}\nTransferência: ${f.transferencia.status}`).join("\n\n");
}

export function promptNina(loja: string, hoje: string): string {
  return `Você é a Nina, assistente INTERNA da equipe da ${loja}, respondendo no grupo de WhatsApp da equipe (vendas, pós-venda e garantia). Hoje é ${hoje}.
Você só CONSULTA: responda usando APENAS os DADOS abaixo (vendas e pós-venda registrados no Co-pilot). Regras:
- Resposta curta, direta, formato WhatsApp (*negrito* com um asterisco, sem títulos, sem tabela). Comece pela resposta.
- NUNCA invente placa, data, km ou status. Dado ausente ou null = diga "não está registrado" e, se couber, quem costuma ter (vendedor da venda, despachante).
- Mais de um cliente bate com a pergunta: liste as opções em 1 linha cada (nome, carro, data da compra) e pergunte qual.
- Nenhum cliente encontrado: diga que não achou nas vendas registradas e peça nome completo, telefone ou placa.
- Transferência: mostre o status e os passos como ✅ feito / ⬜ pendente só quando perguntarem disso.
- "troca_de_oleo" e km são estimativas do Co-pilot quando o cliente usa o app; diga "pelo registro do Co-pilot".
- Não mostre CPF nem dados que não estejam nos DADOS. Você não altera cadastro: se pedirem pra mudar algo, diga que é pelo painel da loja.
- Pergunta fora do assunto da loja/clientes: responda em 1 linha que você ajuda com dados de clientes e carros vendidos.`;
}

// ---------- webhook do número do Canal → função grupo-agente ----------
// Liga (uma vez) o repasse das mensagens de GRUPO recebidas pelo número do Canal. Não mexe em webhook
// que já exista pra outro destino: se houver outro, ADICIONA o nosso. O segredo fica só no servidor.
export async function garantirWebhook(sb: any): Promise<{ ok: boolean; estado: "ja_ligado" | "ligado" | "sem_canal" | "sem_segredo" | "falhou"; detalhe?: string }> {
  const c = await canalCfg(sb);
  if (!c) return { ok: false, estado: "sem_canal" };
  const segredo = (Deno.env.get("WEBHOOK_SECRET") || "").trim();
  if (segredo.length < 16) return { ok: false, estado: "sem_segredo" };
  const destino = `${Deno.env.get("SUPABASE_URL")}/functions/v1/grupo-agente`;
  const h = { "content-type": "application/json", token: c.token };
  let existentes: any[] = [];
  try {
    const r = await fetch(`${c.url}/webhook`, { headers: h });
    if (r.ok) { const j = await r.json().catch(() => null); existentes = Array.isArray(j) ? j : Array.isArray(j?.webhooks) ? j.webhooks : j && typeof j === "object" && j.url ? [j] : []; }
  } catch { /* segue e tenta configurar */ }
  const nosso = existentes.find((w: any) => String(w?.url || "").startsWith(destino));
  if (nosso && nosso.enabled !== false) return { ok: true, estado: "ja_ligado" };
  const outros = existentes.filter((w: any) => w?.url && !String(w.url).startsWith(destino) && w.enabled !== false);
  const corpo: Record<string, unknown> = {
    enabled: true, url: `${destino}?secret=${encodeURIComponent(segredo)}`, events: ["messages"],
    excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupNo"], addUrlEvents: false, addUrlTypesMessages: false,
  };
  if (nosso?.id) { corpo.action = "update"; corpo.id = nosso.id; } else if (outros.length) corpo.action = "add";
  try {
    const r = await fetch(`${c.url}/webhook`, { method: "POST", headers: h, body: JSON.stringify(corpo) });
    if (!r.ok) return { ok: false, estado: "falhou", detalhe: `uazapi ${r.status}: ${(await r.text()).slice(0, 160)}` };
    return { ok: true, estado: "ligado" };
  } catch (e) { return { ok: false, estado: "falhou", detalhe: String((e as any)?.message || e).slice(0, 160) }; }
}
