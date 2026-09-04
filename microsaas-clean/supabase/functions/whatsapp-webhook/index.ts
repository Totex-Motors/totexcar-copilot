// TotexCar Co-pilot — Agente de IA do carro via WhatsApp (DUAL: Uazapi OU API oficial Meta)
// Recebe texto/foto/áudio, identifica o usuário pelo telefone e usa a IA (OpenAI/Claude/Gemini)
// com FERRAMENTAS (function calling): registrar gasto (com litros), medir consumo pela foto do
// hodômetro, resumo financeiro, manutenção e ANTI-MULTAS
// (foto do auto de infração → vícios + minuta de recurso).
// Provider de envio/recebimento escolhido em app_settings.wa_provider (uazapi | meta).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import { waSendText, waSendMenu, waSendTemplate, waSendFlow, waSendImage, waSendDocument, waSendCarousel, waUploadMedia, metaDownloadMedia, parseMetaInbound, metaVerifyChallenge } from "../_shared/wa.ts";
import { kitUrlFor, KIT_FILENAME } from "../_shared/kit.ts";
import { pesquisarRota, pesquisarLugares, consumoDoVeiculo } from "../_shared/route-research.ts";
import { loadDossier, runExtractor, detectCarIntent } from "../_shared/proactive.ts";
import { careFuel, careOdometer, careStatement, seloElegivel } from "../_shared/care-score.ts";
import { upcoming as calendarUpcoming, kmMedioDia as calendarKmDia } from "../_shared/calendar.ts";
import {
  SERVICE_TYPES, normalizeServiceType, isEmergencyService, dedupProviders,
  rankProviders, normalizePhone as radarNormalizePhone,
  searchViaSearchPreview, searchViaGooglePlaces,
  partnerToRaw, partnersFirst,
  type RankingMode,
} from "../_shared/radar-search.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/+$/, "");
const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN") || "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// configurações (chaves) carregadas 1x por requisição
let _settings: any = null;
async function getSettings() {
  if (_settings) return _settings;
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  _settings = data || {};
  return _settings;
}

// ---------- helpers ----------
const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

function pick(obj: any, paths: string[]): any {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok && cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}

// Adaptador tolerante do payload do Uazapi (estrutura confirmada em produção)
function parseInbound(body: any) {
  const m = body?.message ?? body?.data?.message ?? body?.data ?? body;

  const fromMe = Boolean(pick(body, ["message.fromMe", "fromMe", "data.message.fromMe", "key.fromMe"]) ?? m?.fromMe);

  // Telefone REAL: prioriza sender_pn / chatid (@s.whatsapp.net) e IGNORA @lid (id interno do WhatsApp)
  const senderRaw = pick(m, ["sender_pn", "chatid", "wa_chatid", "from", "jid", "key.remoteJid", "remoteJid"]) ||
    pick(body, ["chat.phone", "chat.wa_chatid", "sender_pn", "from"]) || "";
  const phone = onlyDigits(String(senderRaw).split("@")[0]);

  const typeRaw = String(
    pick(m, ["messageType", "mediaType", "type", "msgContent.type"]) || "",
  ).toLowerCase();

  const text = pick(m, [
    "text", "body", "caption", "conversation",
    "message.conversation", "message.extendedTextMessage.text",
    "extendedTextMessage.text", "msgContent.text",
    // respostas de botões/listas (Uazapi: vote / buttonOrListid / content.selected*)
    "vote", "buttonOrListid",
    "content.selectedDisplayText", "content.selectedID",
    "selectedDisplayText", "selectedButtonId",
  ]) || "";

  const transcription = pick(m, [
    "transcription", "audioTranscription", "speechToText", "transcript",
  ]) || "";

  // Mídia: no Uazapi os dados ficam em message.content (URL criptografada + chaves)
  const content = (m && typeof m.content === "object") ? m.content : null;
  const mimetype = pick(m, ["content.mimetype", "mimetype", "mimeType", "media.mimetype"]) || "";
  const mediaUrl = pick(m, ["content.URL", "content.url", "mediaUrl", "url", "file", "fileUrl", "downloadUrl"]) || "";
  const base64 = pick(m, ["base64", "mediaBase64", "fileBase64"]) || "";
  const messageid = pick(m, ["messageid", "id", "key.id"]) || "";
  const baseUrl = String(pick(body, ["BaseUrl", "baseUrl"]) || "").replace(/\/+$/, "");
  const token = pick(body, ["token"]) || "";

  let kind: "text" | "image" | "audio" | "pdf" | "other" = "other";
  if (typeRaw.includes("image") || /image\//.test(String(mimetype))) kind = "image";
  else if (typeRaw.includes("audio") || typeRaw.includes("ptt") || /audio\//.test(String(mimetype))) kind = "audio";
  else if ((typeRaw.includes("document") || /pdf/.test(String(mimetype))) && /pdf/.test(String(mimetype))) kind = "pdf";
  else if (typeRaw.includes("text") || typeRaw.includes("conversation") || (text && !mediaUrl)) kind = "text";
  else if (mediaUrl || base64) kind = String(mimetype).includes("image") ? "image" : "other";

  return {
    fromMe, phone, kind,
    text: String(text), transcription: String(transcription),
    mediaUrl: String(mediaUrl), base64: String(base64), mimetype: String(mimetype),
    content, messageid: String(messageid), baseUrl: String(baseUrl), token: String(token),
  };
}

async function uazapiCreds() {
  const s = await getSettings();
  const url = (s.uazapi_url || UAZAPI_URL || "").replace(/\/+$/, "");
  const token = s.uazapi_token || UAZAPI_TOKEN || "";
  return { url, token };
}

// Texto livre — usar SÓ em RESPOSTA a mensagem do cliente (janela de 24h da API oficial).
async function sendText(phone: string, text: string) {
  const s = await getSettings();
  await waSendText(s, phone, text);
}

// Página "quero comprar" do marketplace Totexmotors (janela de carros da Garagem Totex)
const GARAGEM_LABEL = "🚗 Garagem Totex";
const GARAGEM_URL = "https://totexmotors.com/comprar";
// Flow com o ESTOQUE AO VIVO (endpoint dinâmico) — substitui o link no provider meta
const GARAGEM_FLOW_ID = "1052809144367365";
// Flow da RECOMPRA FIPE AO VIVO (avaliar o próprio carro pela FIPE dentro do WhatsApp)
const RECOMPRA_FLOW_ID = "2122157961991407";
// Flows novos (Radar e Modo Viagem). Ficam em SECRET porque o id só existe depois
// de publicar o flow na Meta — sem o id, o código cai no caminho de texto do agente
// em vez de mandar um formulário quebrado.
const RADAR_FLOW_ID = Deno.env.get("RADAR_FLOW_ID") || "";
const VIAGEM_FLOW_ID = Deno.env.get("VIAGEM_FLOW_ID") || "";

// pedido de SERVIÇO no carro → abre o flow do Radar
function isRadarQuery(t: string): boolean {
  return /(oficina|mec[âa]nic[oa]|borracharia|guincho|reboque|chaveiro|autoel[ée]tric|funilaria|lanternagem|bateria (do |arriada|descarregada)|troc(ar|a) (de )?(pneu|bateria|[óo]leo)|furei o pneu|pneu furado|carro (n[ãa]o pega|quebrou|parou)|onde (arrumo|conserto|consertar)|preciso de (um |uma )?(mec[âa]nico|oficina|guincho|chaveiro))/i.test(t || "");
}

// pedido de AVALIAR/VENDER o próprio carro → abre o flow da Recompra FIPE (não "vá no app")
function isRecompraQuery(t: string): boolean {
  return /(avaliar|avalia[çc][ãa]o|quanto vale|vender|recompra|revender).{0,25}(meu |o )?(carro|ve[íi]culo|autom[óo]vel)|quero vender|vale meu carro/i.test(t || "");
}

// nome da loja → dealershipId do marketplace (p/ escopar o estoque do cliente de loja no flow)
let _mktDealers: Record<string, string> | null = null;
async function garagemDealerId(name?: string | null): Promise<string | null> {
  if (!name) return null;
  if (!_mktDealers) {
    const base = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
    const res = await fetch(`${base}/api/dealerships`, { headers: { Accept: "application/json" } });
    const d = await res.json().catch(() => []);
    const list = Array.isArray(d) ? d : (d?.data || []);
    _mktDealers = {};
    for (const x of list) if (x?.name && x?.id) _mktDealers[String(x.name).toLowerCase()] = String(x.id);
  }
  return _mktDealers[String(name).toLowerCase()] || null;
}
// Opção do menu que gera o link mágico de acesso ao painel web (atalho determinístico)
const PAINEL_LABEL = "🖥️ Quero o painel";

// Ações rápidas exibidas após cada resposta. WhatsApp só permite 3 BOTÕES, então com 4+ opções
// usamos uma LISTA (type:"list"). A 4ª opção (Garagem Totex) abre a janela de carros do marketplace.
const VIAGEM_LABEL = "🏖️ Planejar viagem";
const RADAR_LABEL = "🔎 Achar oficina/serviço";
const QUICK_ACTIONS = ["📊 Gastos do mês", "⛽ Meu consumo", "🔧 Manutenção (km)", RADAR_LABEL, GARAGEM_LABEL, VIAGEM_LABEL, PAINEL_LABEL];

// Envia a resposta com o menu de ações (lista interativa nos dois providers).
// Usar SÓ em RESPOSTA a mensagem do cliente (janela de 24h da API oficial).
async function sendMenu(phone: string, text: string, choices: string[], footerText?: string) {
  const s = await getSettings();
  await waSendMenu(s, phone, text, choices, footerText);
}

async function fetchImageBase64(url: string): Promise<{ data: string; media_type: string } | null> {
  try {
    const { token } = await uazapiCreds();
    const res = await fetch(url, { headers: token ? { token } : {} });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { data: btoa(bin), media_type: ct.split(";")[0] };
  } catch (e) {
    console.error("Erro ao baixar imagem:", e);
    return null;
  }
}

// Baixa a mídia do Uazapi: /message/download descriptografa e devolve base64/fileURL.
// mediaType: "image" (padrão) ou "audio" — usado p/ fotos de cupom e áudios de voz.
async function downloadUazapiMedia(
  baseUrl: string, token: string, content: any, messageid: string, mediaType: string = "image",
): Promise<{ data: string; media_type: string } | null> {
  if (!baseUrl || !token || !content) return null;
  try {
    const res = await fetch(`${baseUrl}/message/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({
        url: content.URL || content.url,
        directPath: content.directPath,
        mediaKey: content.mediaKey,
        mimetype: content.mimetype,
        fileSHA256: content.fileSHA256,
        fileLength: content.fileLength,
        type: mediaType,
        id: messageid,
      }),
    });
    if (!res.ok) { console.error("uazapi /message/download falhou:", res.status, await res.text()); return null; }
    const j = await res.json();
    const fallbackMt = mediaType === "audio" ? "audio/ogg" : "image/jpeg";
    const mt = j.mimetype || content.mimetype || fallbackMt;
    const b64 = j.base64 || j.fileBase64;
    if (b64) return { data: String(b64).replace(/^data:[^;]+;base64,/, ""), media_type: mt };
    const fileURL = j.fileURL || j.fileUrl || j.url;
    if (fileURL) {
      const f = await fetch(fileURL);
      if (!f.ok) return null;
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return { data: btoa(bin), media_type: (f.headers.get("content-type") || mt).split(";")[0] };
    }
    return null;
  } catch (e) {
    console.error("Erro downloadUazapiMedia:", e);
    return null;
  }
}

// Transcreve áudio (nota de voz do WhatsApp) para texto.
// Usa Whisper (OpenAI) se houver chave; senão tenta Gemini. Devolve "" se não der.
async function transcribeAudio(base64Audio: string, mimetype: string): Promise<string> {
  const s = await getSettings();
  const openaiKey = s.openai_api_key || "";
  const geminiKey = s.gemini_api_key || "";

  const bin = atob(base64Audio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  if (openaiKey) {
    const mt = (mimetype || "").toLowerCase();
    const ext = mt.includes("mp3") || mt.includes("mpeg") ? "mp3"
      : mt.includes("wav") ? "wav"
      : mt.includes("m4a") || mt.includes("mp4") ? "m4a"
      : mt.includes("webm") ? "webm"
      : "ogg";
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: mimetype || "audio/ogg" }), `audio.${ext}`);
    form.append("model", "whisper-1");
    form.append("language", "pt");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${openaiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return String(j.text || "").trim();
  }

  if (geminiKey) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: "Transcreva este áudio em português do Brasil. Responda apenas com a transcrição, sem comentários." },
              { inline_data: { mime_type: mimetype || "audio/ogg", data: base64Audio } },
            ],
          }],
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini STT ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return String(j.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "").trim();
  }

  throw new Error("Nenhuma chave de transcrição (OpenAI/Gemini) configurada");
}

async function findUserByPhone(phone: string) {
  if (!phone) return null;
  // tenta sufixos (10/11 dígitos) para casar com formatos +55DDD...
  const candidates = [phone, phone.slice(-11), phone.slice(-10), phone.slice(-8)];
  for (const c of candidates) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .ilike("phone", `%${c}`)
      .limit(20);
    if (!data || !data.length) continue;
    if (data.length === 1) return data[0];

    // DUPLICIDADE DE TELEFONE — antes isto era `.limit(1)` sem ORDER BY, ou seja,
    // o Postgres devolvia QUALQUER uma das contas conforme o plano de execução.
    // Na prática: quem tinha 2+ cadastros (típico de e-mail digitado errado no
    // signup) caía numa conta diferente a cada mensagem, e os gastos ficavam
    // espalhados. Agora o desempate é explícito e estável.
    console.warn(`findUserByPhone: ${data.length} contas com o telefone ${c} — desempatando`, data.map((u: any) => u.email));

    // quem tem veículo ATIVO é a conta que o agente realmente serve
    const ids = data.map((u: any) => u.id);
    const { data: vehs } = await supabase
      .from("accounts").select("user_id").in("user_id", ids).eq("is_active", true);
    const temVeiculo = new Set((vehs || []).map((v: any) => v.user_id));

    const ordenadas = [...data].sort((a: any, b: any) => {
      // 1) tem carro cadastrado
      const va = temVeiculo.has(a.id) ? 0 : 1, vb = temVeiculo.has(b.id) ? 0 : 1;
      if (va !== vb) return va - vb;
      // 2) assinatura ativa/premium ganha de conta abandonada
      const pa = a.plan === "premium" ? 0 : 1, pb = b.plan === "premium" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      // 3) mais recente
      const da = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (da !== 0) return da;
      // 4) desempate absoluto — garante estabilidade mesmo com tudo igual
      return String(a.id).localeCompare(String(b.id));
    });
    return ordenadas[0];
  }
  return null;
}

// Acesso bloqueado quando o dono não pagou: trial expirou e não assinou,
// ou assinatura vencida/cancelada. Admin e lojista nunca são bloqueados.
function accessBlocked(u: any): boolean {
  if (!u) return false;
  if (u.role && u.role !== "owner") return false;
  if (u.plan === "premium") {
    // trava EM TEMPO REAL no vencimento (cortesia/assinatura avulsa): mesmo antes do cron
    // re-bloquear, premium com plan_expires_at no passado não usa (não "esticamos" o grátis).
    const exp = u.plan_expires_at ? Date.parse(u.plan_expires_at) : 0;
    return exp > 0 && exp < Date.now();
  }
  const status = (u.subscription_status || "").toLowerCase();
  if (status === "overdue" || status === "canceled") return true;
  const ends = u.trial_ends_at ? Date.parse(u.trial_ends_at) : 0;
  return !ends || ends < Date.now();
}

// Pontos da CNH (Lei 14.071/2021): 20 pts (2+ gravíssimas), 30 (1 gravíssima), 40 (nenhuma); EAR = 40.
function pontosDaMulta(m: any): number {
  if (m.pontos != null && Number(m.pontos) > 0) return Number(m.pontos);
  const g = String(m.gravidade || "").toLowerCase();
  if (/grav[ií]ss/.test(g)) return 7;
  if (/grave/.test(g)) return 5;
  if (/m[ée]dia/.test(g)) return 4;
  if (/leve/.test(g)) return 3;
  return 0;
}
function computeCnhPoints(multas: any[], ear: boolean) {
  const doze = Date.now() - 365 * 86400000;
  const dt = (m: any) => new Date(m.data_infracao || m.created_at || "").getTime();
  const validas = (multas || []).filter((m) => String(m.status || "") !== "deferida")
    .filter((m) => { const d = dt(m); return isFinite(d) && d >= doze; });
  const pontos = validas.reduce((s, m) => s + pontosDaMulta(m), 0);
  const gravissimas = validas.filter((m) => /grav[ií]ss/.test(String(m.gravidade || "").toLowerCase()) || pontosDaMulta(m) >= 7).length;
  const limite = ear ? 40 : gravissimas >= 2 ? 20 : gravissimas === 1 ? 30 : 40;
  const faltam = Math.max(0, limite - pontos);
  const risco = pontos >= limite ? "suspensao" : faltam <= 5 ? "alto" : faltam <= limite / 2 ? "medio" : "baixo";
  const comData = validas.map((m) => ({ d: dt(m), p: pontosDaMulta(m) })).filter((x) => isFinite(x.d) && x.p > 0).sort((a, b) => a.d - b.d);
  let proxima_queda: any = null;
  if (comData.length) { const q = new Date(comData[0].d); q.setFullYear(q.getFullYear() + 1); proxima_queda = { data: q.toISOString().split("T")[0], pontos: comData[0].p }; }
  return { pontos, gravissimas, limite, faltam, risco, consideradas: validas.length, proxima_queda };
}

// classifica a categoria do gasto num "balde" (pra onde vai o dinheiro) — usado no custo_por_km
function bucketOf(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (/combust|gasolin|etanol|diesel|carga|abastec/.test(c)) return "Combustível";
  if (/financ|parcela|boleto/.test(c)) return "Financiamento";
  if (/ipva|seguro|licenc|multa|document|dpvat|estacion|ped[aá]gio/.test(c)) return "Fixos (imposto/seguro)";
  if (/manuten|pe[çc]a|pneu|[óo]leo|revis|mec|funilar|lavagem|acess/.test(c)) return "Manutenção";
  return "Outros";
}

async function buildSnapshot(userId: string, vehicle: any) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: month } = await supabase
    .from("transactions")
    .select("amount, type, categories(name)")
    .eq("user_id", userId)
    .gte("transaction_date", first)
    .lte("transaction_date", last);

  const byCat: Record<string, number> = {};
  let totalExp = 0;
  (month || []).forEach((t: any) => {
    if (t.type === "expense") {
      totalExp += Math.abs(t.amount);
      const n = t.categories?.name || "Outros";
      byCat[n] = (byCat[n] || 0) + Math.abs(t.amount);
    }
  });

  const { data: recent } = await supabase
    .from("transactions")
    .select("description, amount, type, transaction_date, categories(name)")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false })
    .limit(5);

  // total gasto histórico com o carro (concierge)
  const { data: allExp } = await supabase
    .from("transactions").select("amount, type").eq("user_id", userId);
  const totalGeral = (allExp || [])
    .filter((t: any) => t.type === "expense")
    .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

  // financiamento ativo (concierge: saldo devedor, parcelas)
  const { data: fins } = await supabase
    .from("financiamentos").select("*").eq("user_id", userId).eq("ativo", true);
  const financiamentos = (fins || []).map((f: any) => {
    const restantes = Math.max(0, Number(f.num_parcelas) - Number(f.parcelas_pagas));
    return {
      banco: f.banco,
      valor_parcela: Number(f.valor_parcela),
      parcelas: `${f.parcelas_pagas}/${f.num_parcelas}`,
      parcelas_restantes: restantes,
      saldo_devedor: Number((restantes * Number(f.valor_parcela || 0)).toFixed(2)),
      primeira_parcela: f.primeira_parcela,
    };
  });

  return {
    veiculo: vehicle ? {
      apelido: vehicle.name, marca: vehicle.marca, modelo: vehicle.modelo,
      placa: vehicle.placa, hodometro: vehicle.hodometro,
      valor_compra: vehicle.valor_compra, data_compra: vehicle.data_compra,
      licenciamento_vencimento: vehicle.licenciamento_vencimento,
      ipva_vencimento: vehicle.ipva_vencimento,
      seguro_vencimento: vehicle.seguro_vencimento,
    } : null,
    gasto_total_mes: Number(totalExp.toFixed(2)),
    gasto_total_geral: Number(totalGeral.toFixed(2)),
    financiamentos,
    gastos_por_categoria_mes: byCat,
    ultimos_lancamentos: (recent || []).map((r: any) => ({
      descricao: r.description, valor: r.amount, tipo: r.type,
      data: r.transaction_date, categoria: r.categories?.name,
    })),
  };
}

// Abastecimentos com hodômetro e litros (p/ consumo), em ordem cronológica.
async function fuelTxns(userId: string): Promise<any[]> {
  try {
    const { data } = await supabase
      .from("transactions")
      .select("amount, odometer, litros, transaction_date, created_at, categories(name)")
      .eq("user_id", userId).eq("type", "expense")
      .order("created_at", { ascending: true });
    return (data || []).filter((t: any) =>
      String(t.categories?.name || "").toLowerCase().includes("combust") &&
      Number(t.odometer) > 0 && Number(t.litros) > 0);
  } catch { return []; }
}

// Consumo TANQUE-A-TANQUE, simples pro dono entender: a cada abastecimento,
// km rodados desde o anterior ÷ litros deste = km/L. Trechos implausíveis
// (hodômetro mal lido → km/L fora de 3–30) são descartados.
async function computeConsumo(userId: string): Promise<any | null> {
  const f = await fuelTxns(userId);
  if (f.length < 2) return null;
  const trechos: any[] = [];
  for (let i = 1; i < f.length; i++) {
    const dist = Number(f[i].odometer) - Number(f[i - 1].odometer);
    const litros = Number(f[i].litros);
    if (!(dist > 0) || !(litros > 0)) continue;
    const kml = dist / litros;
    if (kml < 3 || kml > 30) continue; // leitura de hodômetro implausível — ignora o trecho
    trechos.push({ km_rodados: Math.round(dist), litros, km_por_litro: Number(kml.toFixed(1)), custo: Math.abs(Number(f[i].amount)) });
  }
  if (!trechos.length) return null;
  const ult = trechos[trechos.length - 1];
  const somaKm = trechos.reduce((s, t) => s + t.km_rodados, 0);
  const somaL = trechos.reduce((s, t) => s + t.litros, 0);
  const somaCusto = trechos.reduce((s, t) => s + t.custo, 0);
  return {
    ultimo_abastecimento: { km_rodados: ult.km_rodados, litros: Number(ult.litros.toFixed(1)), km_por_litro: ult.km_por_litro },
    media_km_por_litro: Number((somaKm / somaL).toFixed(1)),
    custo_combustivel_por_km: Number((somaCusto / somaKm).toFixed(2)),
    abastecimentos_medidos: trechos.length,
  };
}

// Configuração de IA (provedor/modelo/chave) vinda do painel admin (app_settings); fallback p/ env
async function getAIConfig() {
  const data = await getSettings();
  const provider = data?.ai_provider || "anthropic";
  let key = "";
  if (provider === "openai") key = data?.openai_api_key || "";
  else if (provider === "gemini") key = data?.gemini_api_key || "";
  else key = data?.anthropic_api_key || ANTHROPIC_API_KEY || "";
  const defaults: Record<string, string> = {
    anthropic: "claude-opus-4-8", openai: "gpt-4o", gemini: "gemini-2.5-flash",
  };
  const model = data?.ai_model || defaults[provider] || "claude-opus-4-8";
  if (provider === "anthropic" && !key) key = ANTHROPIC_API_KEY || "";
  return { provider, model, key };
}

async function resolveCategory(name: string, type: string, isNew: boolean): Promise<number | null> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("type", type);
  const match = (existing || []).find(
    (c: any) => c.name.toLowerCase() === name.toLowerCase(),
  );
  if (match) return match.id;
  if (!isNew && existing && existing.length) {
    // fallback: "Outros" do tipo
    const outros = existing.find((c: any) => c.name.toLowerCase() === "outros");
    if (outros) return outros.id;
  }
  // cria categoria personalizada
  const { data: created, error } = await supabase
    .from("categories")
    .insert({ name, type, color: "#0ea5e9", icon: "MoreHorizontal", is_system: false })
    .select("id")
    .single();
  if (error) { console.error("erro criar categoria", error); return null; }
  return created.id;
}

// Opção "Garagem Totex" do menu (ou pedido direto): manda o link da janela de carros do marketplace
function isGaragemQuery(t: string): boolean {
  return /garagem\s*totex/i.test(t || "");
}

// Opção "Planejar viagem" do menu (ou pedido direto) → abre o FORMULÁRIO do Modo Viagem.
// Só o gatilho EXPLÍCITO abre o flow; conversa solta sobre viagem continua com a IA,
// que pergunta o destino no meio do papo (mais natural que jogar um formulário na cara).
function isViagemQuery(t: string): boolean {
  return /planejar\s*viagem|modo\s*viagem|quero\s*(planejar|fazer)\s*uma\s*viagem/i.test(t || "");
}

// Busca jornadas de pós-venda pelo telefone com TOLERÂNCIA de formato (a loja registra "11980292779",
// o WhatsApp entrega "5511980292779"; há ainda números sem o 9º dígito) — mesmo padrão do findUserByPhone.
async function findJourneysByPhone(phone: string): Promise<any[]> {
  const digits = onlyDigits(phone);
  if (!digits) return [];
  for (const c of [digits, digits.slice(-11), digits.slice(-10), digits.slice(-8)]) {
    if (!c) continue;
    const { data } = await supabase.from("postsale_journeys")
      .select("*").ilike("customer_phone", `%${c}`)
      .order("created_at", { ascending: false }).limit(5);
    if (data && data.length) return data;
  }
  return [];
}

// Aplica a nota do NPS numa jornada e roteia (detrator → alerta a loja; promotor/passivo → avaliação
// no Google). Usado tanto pela resposta em NÚMERO (texto) quanto pelo formulário nativo (WhatsApp Flow).
async function applyNpsScore(j: any, phone: string, score: number, comentario?: string | null) {
  const seg = score <= 6 ? "detrator" : score <= 8 ? "passivo" : "promotor";
  const upd: Record<string, unknown> = { nps_score: score, nps_at: new Date().toISOString(), status: seg };
  if (comentario && String(comentario).trim()) upd.nps_comment = String(comentario).trim().slice(0, 1000);
  await supabase.from("postsale_journeys").update(upd).eq("id", j.id);

  const { data: dcfg } = await supabase.from("dealership_settings")
    .select("google_review_url").eq("dealership", j.dealership).maybeSingle();
  const reviewUrl = dcfg?.google_review_url || null;
  const nome = j.customer_name ? " " + String(j.customer_name).split(" ")[0] : "";

  if (seg === "detrator") {
    await sendText(phone, `Poxa${nome}, sentimos muito que não tenha sido uma nota 10. 🙏 O que a gente poderia ter feito melhor? Pode escrever aqui — vai direto pro responsável da ${j.dealership} pra resolver.`);
    const { data: dealers } = await supabase.from("users")
      .select("phone").eq("role", "dealer").eq("dealership", j.dealership).not("phone", "is", null);
    const sTpl = await getSettings();
    const notaLoja = comentario ? `${score} — "${String(comentario).slice(0, 120)}"` : String(score);
    for (const d of dealers || []) {
      const dp = onlyDigits(d.phone || "");
      // iniciado pelo negócio (o lojista não mandou msg) → TEMPLATE na API oficial
      if (dp) await waSendTemplate(sTpl, dp, "alerta_nps_loja", [j.dealership, j.customer_name || j.customer_phone, notaLoja, j.customer_phone]);
    }
  } else if (seg === "promotor") {
    const rev = reviewUrl ? `\n\n⭐ Já que curtiu, deixa uma avaliação no Google (leva 30s e ajuda demais a ${j.dealership}):\n${reviewUrl}` : "";
    await sendText(phone, `Que alegria${nome}! 🎉 Muito obrigado pela nota ${score}!${rev}\n\nE se indicar um amigo que comprar, todo mundo ganha. 😉`);
    if (reviewUrl) await supabase.from("postsale_journeys").update({ review_link_sent: true }).eq("id", j.id);
  } else {
    const rev = reviewUrl ? `\n\nSe puder, deixa uma avaliação rápida — ajuda muito a loja:\n${reviewUrl}` : "";
    await sendText(phone, `Obrigado pela nota ${score}${nome}! 🙌 Vamos trabalhar pra ser 10 na próxima.${rev}`);
    if (reviewUrl) await supabase.from("postsale_journeys").update({ review_link_sent: true }).eq("id", j.id);
  }
}

// Pós-venda (Sucesso do Cliente): se há um NPS pendente p/ este telefone e a resposta é um número 0–10,
// registra a nota e roteia. Funciona mesmo p/ quem NÃO é usuário do app.
async function handlePostsaleNps(phone: string, text: string): Promise<boolean> {
  const js = (await findJourneysByPhone(phone)).filter((x: any) => x.nps_asked_at && x.nps_score == null);
  const j = js?.[0];
  if (!j) return false;
  const m = String(text || "").trim().match(/\b(10|[0-9])\b/);
  if (!m) return false; // tem NPS pendente mas não veio número — deixa o fluxo normal seguir
  await applyNpsScore(j, phone, Number(m[1]));
  return true;
}

// Resposta do FLOW da GARAGEM TOTEX: "Tenho interesse" num carro do estoque → lead no marketplace.
async function handleGaragemFlowReply(phone: string, flow: Record<string, any>): Promise<boolean> {
  if (flow?.tipo !== "garagem_lead") return false;
  const user = await findUserByPhone(phone);
  const base = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
  try {
    await fetch(`${base}/api/leads/vehicle-interest`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        nome: user?.name || "Cliente WhatsApp",
        email: user?.email || `${phone}@totexcarfinance.app`,
        telefone: phone,
        vehicleId: flow.vid,
        mensagem: `Interesse via WhatsApp (Garagem Totex): ${flow.titulo} — ${flow.preco}`,
      }),
    });
  } catch (e) { console.error("lead garagem flow:", e); }
  await sendText(phone, `🙌 Interesse registrado no *${flow.titulo}* (${flow.preco})! A loja já recebeu seus dados e vai te chamar. Enquanto isso, as fotos estão aqui:\n${flow.url}`);
  return true;
}

// Resposta do FLOW do RADAR: o motorista escolheu um estabelecimento e pediu os contatos.
// Manda telefone/WhatsApp/rota no chat (fica salvo na conversa dele) e grava a TELEMETRIA.
// Telemetria de produto, NÃO CRM: não cria cadastro do motorista no estabelecimento.
async function handleRadarFlowReply(phone: string, flow: Record<string, any>): Promise<boolean> {
  if (flow?.tipo === "radar_espera") {
    await sendText(phone, "Beleza! Assim que a busca terminar eu te mando as opções aqui. 🔎");
    return true;
  }
  if (flow?.tipo !== "radar_escolha") return false;

  const { data: p } = await supabase.from("discovered_providers")
    .select("*").eq("id", String(flow.pid)).maybeSingle();
  if (!p) {
    await sendText(phone, "Não consegui recuperar esse estabelecimento. Me diga o serviço e a cidade que eu procuro de novo. 🙏");
    return true;
  }

  const user = await findUserByPhone(phone);
  await supabase.from("driver_provider_actions").insert({
    user_id: user?.id || null, provider_id: p.id,
    search_id: flow.sid || null, action_type: "viewed",
    metadata: { canal: "flow" },
  }).then(() => {}, () => {});

  const tel = p.phone ? String(p.phone).replace(/\D/g, "") : "";
  const zap = (p.whatsapp ? String(p.whatsapp).replace(/\D/g, "") : "") || tel;
  const destino = p.address
    ? encodeURIComponent(`${p.name} ${p.address}`)
    : encodeURIComponent(p.name);

  const linhas = [`📍 *${p.name}*`];
  if (p.address) linhas.push(p.address);
  if (p.rating != null) linhas.push(`⭐ ${Number(p.rating).toFixed(1)}${p.review_count ? ` (${p.review_count} avaliações)` : ""}`);
  linhas.push("");
  if (tel) linhas.push(`📞 Ligar: +55${tel}`);
  if (zap) linhas.push(`💬 WhatsApp: https://wa.me/55${zap}`);
  linhas.push(`🗺️ Rota: https://www.google.com/maps/search/?api=1&query=${destino}`);
  if (p.website) linhas.push(`🔗 Site: ${p.website}`);
  linhas.push("");
  linhas.push(
    p.provider_status === "parceiro_totex"
      ? "_Parceiro do ecossistema Totex. Confirme preço e prazo direto com a loja._"
      : "_Resultado público: confirme preço e disponibilidade direto com o estabelecimento. A Totex não credencia nem garante o serviço._",
  );
  await sendText(phone, linhas.join("\n"));
  return true;
}

// Resposta do FLOW do MODO VIAGEM: o formulário só COLETA (destino/origem/dias/perfil).
// O plano é montado aqui e volta no chat — a pesquisa de rota + composição pela IA leva
// bem mais que o timeout do endpoint de Flow, então não dá pra fazer dentro da tela.
async function handleViagemFlowReply(phone: string, flow: Record<string, any>): Promise<boolean> {
  if (flow?.tipo !== "viagem_plano") return false;
  const destino = String(flow.destino || "").trim();
  if (!destino) {
    await sendText(phone, "Não peguei o destino. Pra onde você quer ir? 🏖️");
    return true;
  }
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendText(phone, "Pra montar o plano com os dados do seu carro preciso te identificar. Cadastre-se no app com este mesmo número. 🚗");
    return true;
  }

  await sendText(phone, `Fechou! Montando seu plano pra *${destino}* com o consumo real do seu carro — pesquisando pedágio, balsa e onde ficar. Só um instante… 🔎`);

  const { data: vehicles } = await supabase.from("accounts").select("*")
    .eq("user_id", user.id).eq("is_active", true).limit(1);
  const vehicle = vehicles?.[0] || null;
  const today = new Date().toISOString().slice(0, 10);
  const pedido = `Planejar viagem de carro. Destino: ${destino}. Origem: ${flow.origem || "não informada"}. Dias: ${flow.dias || "não informado"}. Perfil: ${flow.perfil || "não informado"}.`;

  // runAgent já faz o tool-use: ele mesmo chama planejar_viagem e compõe o plano.
  const sysViagem = `Você é o **TotexCar Co-pilot** no MODO VIAGEM, respondendo no WhatsApp em português do Brasil.
O cliente acabou de preencher o formulário de viagem, então NÃO se reapresente e NÃO pergunte o destino de novo — ele já disse.
Chame a ferramenta planejar_viagem com os dados do pedido e monte o plano seguindo a instrução que ela devolver.
Formato WhatsApp: *negrito* nos títulos de seção (nada de # markdown), frases curtas, no máximo 2 emojis no total, e a conta do combustível explicada de forma simples.
NUNCA invente pedágio, preço de hospedagem ou estabelecimento: o que a pesquisa não trouxe, diga que não encontrou.`;

  const aiCfg = await getAIConfig();
  const texto = await runAgent(
    aiCfg, sysViagem,
    [{ kind: "text", text: pedido }],
    { user, vehicle, today, inputText: pedido },
  ).catch((e) => { console.error("viagem flow runAgent:", e); return ""; });

  await sendText(phone, texto || "Tive um problema pra montar o plano agora. Pode tentar de novo em instantes? 🙏");
  return true;
}

// Resposta do FLOW de RECOMPRA FIPE (endpoint dinâmico): payload {tipo:"recompra", ...} do nfm_reply.
// NÃO fecha o lead ainda: guarda a referência (FIPE + carro + atribuição) num evento sell_pending e
// pergunta a MODALIDADE. O valor sai depois, por MARGEM (Express à vista / Vitrine por prazo).
async function handleRecompraFlowReply(phone: string, flow: Record<string, any>): Promise<boolean> {
  if (flow?.tipo !== "recompra") return false;
  const fipeValue = Number(flow.fipe_value) || 0;
  const carro = [flow.marca_nome, flow.modelo_nome, flow.ano_nome].filter(Boolean).join(" ") || "veículo";

  // dedup: mesmo carro já em fechamento (ou fechado) neste telefone → não reabre o menu (retry do webhook)
  const emAndamento = await findSellPending(phone);
  if (emAndamento && Number(emAndamento.parsed?.fipe_value) === fipeValue) return true;

  const attr = await resolveSellAttribution(phone);
  await supabase.from("whatsapp_events").insert({
    from_phone: phone, kind: "sell_pending", status: "processed",
    raw: { flow: { marca: flow.marca_nome, modelo: flow.modelo_nome, ano: flow.ano_nome } },
    parsed: {
      step: "modalidade", carro, fipe_value: fipeValue,
      marca_nome: flow.marca_nome || null, modelo_nome: flow.modelo_nome || null, ano_nome: flow.ano_nome || null,
      combustivel: flow.combustivel || null, fipe_code: flow.fipe_code || null,
      dealership: attr.dealership, nome: attr.nome, loja: attr.loja, promotor: attr.promotor, ownerId: attr.ownerId,
    },
  });

  const s = await getSettings();
  await sendText(phone, `Peguei a referência do seu ${carro} 🚗\nTabela FIPE: *${fmtReais(fipeValue)}*\n\nComo você prefere vender?\n\n⚡ *Venda Express* — à vista pelo nosso grupo de repasse, em *até 48h* (pra carros de boa demanda).\n🏆 *Venda Vitrine* — a loja anuncia e vende o seu; você escolhe o prazo e *quanto mais tempo, mais recebe*.`);
  await waSendMenu(s, phone, "Toque na opção que combina com você:", ["Venda Express", "Venda Vitrine", "Me ajuda a escolher"]);
  return true;
}

// Resposta do FORMULÁRIO nativo de NPS (WhatsApp Flow): payload {nota, comentario} do nfm_reply.
async function handleNpsFlowReply(phone: string, flow: Record<string, any>): Promise<boolean> {
  const score = Number(flow?.nota);
  if (!Number.isFinite(score) || score < 0 || score > 10) return false;
  // preferência: jornada com NPS pendente; fallback: a mais recente sem nota (reenvio manual, etc.)
  const all = await findJourneysByPhone(phone);
  const j = all.find((x: any) => x.nps_asked_at && x.nps_score == null) || all.find((x: any) => x.nps_score == null);
  if (!j) return false;
  await applyNpsScore(j, phone, score, flow?.comentario);
  return true;
}

// Pós-venda: cliente pergunta sobre a transferência/documentação → responde o checklist da jornada dele.
async function handlePostsaleTransfer(phone: string, text: string): Promise<boolean> {
  if (!/transfer[êe]nc|transferir|documenta[çc]|meus? documento/i.test(text || "")) return false;
  const js = await findJourneysByPhone(phone);
  const j = js?.[0];
  if (!j) return false;
  const T = j.transfer || {};
  const steps: Array<[string, any]> = [
    ["Vistoria (se exigida)", T.vistoria],
    ["ATPV-e (autorização) assinada", T.atpv],
    ["Taxas do DETRAN pagas", T.taxas],
    ["Débitos quitados (IPVA/multas)", T.debitos],
    ["Comunicação de venda", T.comunicacao],
    ["Novo documento (CRLV-e) em seu nome", T.crlv_novo],
  ];
  const statusTxt = j.transfer_status === "concluida" ? "✅ CONCLUÍDA" : j.transfer_status === "em_andamento" ? "⏳ em andamento" : "🕒 pendente";
  const linhas = steps.map(([label, done]) => `${done ? "✅" : "⬜"} ${label}`).join("\n");
  await sendText(phone, `📄 *Transferência do seu ${j.car_desc || "carro"}* (${j.dealership})\nStatus: ${statusTxt}\n\n${linhas}\n\nDúvida na documentação? É só falar com a ${j.dealership}. 🙌`);
  return true;
}

// ---------- Garagem Totex (estoque do marketplace totexmotors.com) ----------
const MARKETPLACE_URL = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");

async function mktVehicles(params: Record<string, string | number | undefined>): Promise<any[]> {
  const u = new URL(`${MARKETPLACE_URL}/api/vehicles`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
  const res = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`marketplace_${res.status}`);
  return Array.isArray(d?.data) ? d.data : [];
}

const carImg = (v: any) => {
  const imgs = Array.isArray(v?.images) ? v.images : [];
  return (imgs.find((i: any) => i?.isPrimary) || imgs[0])?.url || "";
};

// ---- FOTO WebP NA VITRINE: converter e hospedar na Meta ----
// A Meta rejeita WebP em header de card em TODAS as vias (link E media id: erro 131053 na
// ENTREGA, depois do "accepted" — a vitrine morre em silêncio). Proxies públicos de conversão
// também falham: a Meta cacheia mídia por host+path e o wsrv.nl usa o MESMO path pra tudo.
// Caminho validado em produção: baixar o .webp, converter pra PNG (wasm) e subir na API de
// mídia da Meta → card usa image.id. O media id vale ~30 dias; cache em wa_media_cache (25d)
// pra converter cada foto uma vez só. Estoques BNDV (Julio Multimarcas) são o caso real.
const isWebpUrl = (url: string) => /\.webp$/.test(String(url || "").toLowerCase().split("?")[0]);

async function webpToPng(bytes: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    // imports dinâmicos: se o wasm falhar, a vitrine degrada (card sai) mas o webhook NÃO cai no boot
    const [webp, png] = await Promise.all([
      import("https://esm.sh/@jsquash/webp@1.5.0?target=denonext"),
      import("https://esm.sh/@jsquash/png@3.1.1?target=denonext"),
    ]);
    const img = await webp.decode(bytes);
    const out = await png.encode(img);
    return new Uint8Array(out);
  } catch (e) { console.error("webpToPng:", e); return null; }
}

async function webpMediaId(s: any, url: string): Promise<string | null> {
  try {
    const cacheOk = new Date(Date.now() - 25 * 24 * 3600_000).toISOString();
    const { data: hit } = await supabase.from("wa_media_cache")
      .select("media_id, created_at").eq("url", url).gte("created_at", cacheOk).maybeSingle();
    if (hit?.media_id) return hit.media_id;
    const res = await fetch(url);
    if (!res.ok) return null;
    const pngBytes = await webpToPng(await res.arrayBuffer());
    if (!pngBytes) return null;
    const id = await waUploadMedia(s, pngBytes, "image/png", "foto.png");
    if (!id) return null;
    await supabase.from("wa_media_cache").upsert({ url, media_id: id, created_at: new Date().toISOString() });
    return id;
  } catch (e) { console.error("webpMediaId:", e); return null; }
}

// MEDIA ID pra QUALQUER foto de card. A Meta rejeita na ENTREGA (131053) quando o host serve
// Content-Type inválido — ex.: o blob BNDV serve .jpg como "image/jpg" (Julio Multimarcas), e
// WebP falha em card. Em vez de mandar por URL e torcer, baixamos os bytes e subimos na API de
// mídia da Meta com o MIME CORRETO (sniff por magic bytes) → o card usa image.id e SEMPRE entrega.
// Cache em wa_media_cache (25d) — converte cada foto uma vez só.
async function imageMediaId(s: any, url: string): Promise<string | null> {
  try {
    if (!url || !/^https:\/\//i.test(url)) return null;
    const cacheOk = new Date(Date.now() - 25 * 24 * 3600_000).toISOString();
    const { data: hit } = await supabase.from("wa_media_cache")
      .select("media_id, created_at").eq("url", url).gte("created_at", cacheOk).maybeSingle();
    if (hit?.media_id) return hit.media_id;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const u8 = new Uint8Array(buf);
    let bytes: Uint8Array; let mime: string; let fname: string;
    const isWebp = isWebpUrl(url) || (u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50); // "WEBP"
    if (isWebp) {
      const png = await webpToPng(buf);
      if (!png) return null;
      bytes = png; mime = "image/png"; fname = "foto.png";
    } else if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) { // PNG
      bytes = u8; mime = "image/png"; fname = "foto.png";
    } else { // trata o resto como JPEG (corrige o "image/jpg" do host)
      bytes = u8; mime = "image/jpeg"; fname = "foto.jpg";
    }
    const id = await waUploadMedia(s, bytes, mime, fname);
    if (!id) return null;
    await supabase.from("wa_media_cache").upsert({ url, media_id: id, created_at: new Date().toISOString() });
    return id;
  } catch (e) { console.error("imageMediaId:", e); return null; }
}

// resumo compacto de um carro pro chat (com link rastreável ?ref do dono → comissão do Indique)
function mktResumo(v: any, refCode?: string | null) {
  return {
    carro: [v.brand, v.model, v.version].filter(Boolean).join(" "),
    ano: v.year, km: v.mileage, preco: v.price, fipe: v.fipePrice ?? null,
    cor: v.color || null, cambio: v.transmission || null, loja: v.dealership?.name || null,
    img: carImg(v),
    link: `${MARKETPLACE_URL}/veiculo/${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`,
  };
}

// ---- CATEGORIA DE CARROCERIA (SUV/sedan/hatch/picape) ----
// O bodyType do marketplace vem do importador e é SUJO (45% genérico "Carro"; GLA marcado "Hatch").
// Classificador híbrido: mapa de modelos do mercado BR decide primeiro; bodyType é só fallback.
// ORDEM IMPORTA: suv antes de sedan/hatch ("corolla cross" vence "corolla", "onix plus" vence "onix").
const MODEL_CLASS: Array<[string, string[]]> = [
  ["suv", ["corolla cross", "rav4", "sw4", "renegade", "compass", "commander", "tracker", "trailblazer", "equinox", "creta", "tucson", "ix35", "santa fe", "kona", "kicks", "captur", "duster", "t-cross", "tcross", "taos", "tiguan", "touareg", "nivus", "pulse", "territory", "bronco", "ecosport", "hr-v", "hrv", "zr-v", "zrv", "cr-v", "crv", "wr-v", "wrv", "pajero", "tr4", "asx", "outlander", "eclipse cross", "tiggo", "haval", "song", "yuan", "x1", "x2", "x3", "x4", "x5", "x6", "gla", "glb", "glc", "gle", "evoque", "discovery", "defender", "range rover", "xc40", "xc60", "xc90", "2008", "3008", "5008", "aircross", "cactus", "grand vitara", "vitara", "jimny", "land cruiser", "macan", "cayenne", "seltos", "sportage", "sorento", "stonic", "q2", "q3", "q5", "q7", "q8", "edge", "mustang mach"]],
  ["picape", ["saveiro", "strada", "toro", "hilux", "ranger", "s10", "s-10", "amarok", "frontier", "l200", "triton", "montana", "oroch", "maverick", "courier", "f-250", "f250", "gladiator", "ram"]],
  ["sedan", ["onix plus", "hb20s", "civic", "corolla", "sentra", "versa", "virtus", "jetta", "passat", "cruze", "prisma", "cronos", "siena", "logan", "fluence", "cerato", "elantra", "azera", "camry", "accord", "voyage", "cobalt", "classic", "a3 sedan", "a4", "a5", "c180", "c200", "c250", "c300", "320i", "330i", "m3"]],
  ["hatch", ["onix", "hb20", "gol", "up!", "up ", "polo", "fox", "golf", "argo", "mobi", "uno", "palio", "punto", "208", "207", "c3", "kwid", "sandero", "march", "picanto", "i30", "etios", "yaris", "500", "fit", "dolphin", "mini cooper", "a1", "a3", "118i", "clio", "ka ", "fiesta", "focus"]],
];
// termo tem que casar em FRONTEIRA de palavra, não substring solta: "x4"/"x2" (BMW) casavam
// dentro de "4x4"/"4x2" das versões e a Toro (picape) virava SUV; "500" casava em "1500" etc.
const escRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const temTermo = (nome: string, t: string) =>
  new RegExp(`(^|[^a-z0-9])${escRe(t.trim())}($|[^a-z0-9])`).test(nome);
function carClass(v: any): string | null {
  const nome = ` ${String(v.model || "")} ${String(v.version || "")} `.toLowerCase();
  // "fastback" é ambíguo: Fiat Fastback = SUV, mas Ford Focus Fastback = sedan.
  // Só é SUV quando o MODELO em si é Fastback (Fiat).
  if (/^\s*fastback/.test(String(v.model || "").toLowerCase())) return "suv";
  for (const [cls, termos] of MODEL_CLASS) {
    if (termos.some((t) => temTermo(nome, t))) return cls;
  }
  const bt = String(v.bodyType || "").toLowerCase();
  if (/suv|utilit[aá]rio esportivo/.test(bt)) return "suv";
  if (/picap|pick-?up/.test(bt)) return "picape";
  if (/sed[aã]/.test(bt)) return "sedan";
  if (/hatch/.test(bt)) return "hatch";
  return null; // "Carro" genérico / desconhecido
}
const normCategoria = (c: any): string | null => {
  const s = String(c || "").toLowerCase();
  if (/suv|utilit[aá]rio esportivo/.test(s)) return "suv";
  if (/picap|pick-?up|caminhonete/.test(s)) return "picape";
  if (/sed[aã]/.test(s)) return "sedan";
  if (/hatch/.test(s)) return "hatch";
  return null;
};

// VITRINE: envia cada carro como uma FOTO com legenda (modelo, ano, km, preço, link) direto no chat.
// Retorna quantos foram enviados (o agente comenta os porquês SEM repetir a lista).

// Body de card de carrossel: a Meta limita o texto HIDRATADO (fixo + variável) a 160 chars por card;
// o texto fixo do template vitrine_carros ocupa 72 → sobram 88 pra variável. Estourou em QUALQUER card
// = erro 132018 e a mensagem inteira não sai (era por isso que o estoque real, com versões longas tipo
// "COMPASS LONG. T270 1.3 TB 4x2 Flex Aut.", nunca chegava). A Meta conta CODE POINTS (emoji = 1),
// por isso [...s].length e não s.length.
const CARD_PARAM_MAX = 88;
const cpLen = (t: string) => [...t].length;
function cardTexto(v: any, brl: (x: any) => string): string {
  // o importador repete o modelo dentro da versão ("COMPASS COMPASS LONG. …") — remove o eco
  const modelo = String(v.model || "").trim();
  let versao = String(v.version || "").trim();
  if (modelo && versao.toUpperCase().startsWith(modelo.toUpperCase())) versao = versao.slice(modelo.length).trim();
  const tituloCompleto = [v.brand, modelo, versao].filter(Boolean).join(" ");
  const tituloCurto = [v.brand, modelo].filter(Boolean).join(" ");
  const kmTxt = Number(v.mileage) > 0 ? `${Number(v.mileage).toLocaleString("pt-BR")} km` : "";
  const fipeTxt = v.fipePrice && Number(v.price) < Number(v.fipePrice) ? "🔥 abaixo da FIPE" : "";
  const lojaTxt = v.dealership?.name ? `📍 ${v.dealership.name}` : "";
  const monta = (titulo: string, extras: string[]) =>
    [`${titulo} ${v.year || ""}`.trim(), brl(v.price), ...extras.filter(Boolean)].join(" · ");
  // degrada por prioridade: versão → FIPE → loja → km, até caber no orçamento
  const tentativas = [
    monta(tituloCompleto, [kmTxt, fipeTxt, lojaTxt]),
    monta(tituloCurto, [kmTxt, fipeTxt, lojaTxt]),
    monta(tituloCurto, [kmTxt, lojaTxt]),
    monta(tituloCurto, [kmTxt]),
    monta(tituloCurto, []),
  ];
  const ok = tentativas.find((t) => cpLen(t) <= CARD_PARAM_MAX);
  return ok ?? [...tentativas[tentativas.length - 1]].slice(0, CARD_PARAM_MAX - 1).join("") + "…";
}

async function sendCarShowcase(phone: string, cars: any[], refCode?: string | null): Promise<number> {
  const s = await getSettings();
  const brl = (v: any) => v != null ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "consulte";
  // CATÁLOGO DESLIZÁVEL primeiro: 1 mensagem com até 10 cards (foto + botão "Ver carro" com ?ref).
  // Template pendente/erro → cai nas fotos individuais abaixo. Sem quebra de linha nos textos (regra de template).
  const cards: { imageUrl: string; imageId?: string; texto: string; urlSuffix: string }[] = [];
  // TODA foto vai por MEDIA ID (bytes re-hospedados na Meta com MIME correto). Assim nem WebP nem
  // host que serve "image/jpg" (BNDV/Julio) derruba o card no 131053. Resolve em paralelo (rápido;
  // cacheado depois da 1ª vez). Card sem media id fica de fora — melhor 8 entregues do que 0.
  const cand = cars.slice(0, 10).filter((v) => { const i = carImg(v); return i && /^https:\/\//i.test(i); });
  const ids = await Promise.all(cand.map((v) => imageMediaId(s, carImg(v))));
  cand.forEach((v, i) => {
    const imageId = ids[i] || undefined;
    if (!imageId) return;
    cards.push({
      imageUrl: carImg(v), imageId,
      texto: cardTexto(v, brl),
      urlSuffix: `${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`,
    });
  });
  if (cards.length >= 2) {
    if (await waSendCarousel(s, phone, cards)) return cards.length;
    // falhou com o lote cheio? tenta com 5 (imagem/limite de algum card pode ter derrubado)
    if (cards.length > 5 && await waSendCarousel(s, phone, cards.slice(0, 5))) return 5;
  }

  let sent = 0;
  for (const v of cars.slice(0, 5)) {
    const img = carImg(v);
    if (!img) continue;
    const mediaId = (await imageMediaId(s, img)) || undefined; // sempre via media id (MIME correto)
    if (!mediaId) continue; // sem media id não entrega — pula
    const titulo = [v.brand, v.model, v.version].filter(Boolean).join(" ");
    const km = Number(v.mileage) > 0 ? ` · ${Number(v.mileage).toLocaleString("pt-BR")} km` : "";
    const fipe = v.fipePrice && Number(v.price) < Number(v.fipePrice) ? " · 🔥 abaixo da FIPE" : "";
    const link = `${MARKETPLACE_URL}/veiculo/${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`;
    // legenda pensada TAMBÉM pra ser ENCAMINHADA (Modo Indicador: motorista manda pro passageiro)
    const loja = v.dealership?.name ? `\n📍 ${v.dealership.name}` : "";
    const caption = `🚗 *${titulo}* ${v.year || ""}\n${brl(v.price)}${km}${fipe}${loja}\n\nFotos e detalhes: ${link}`;
    if (await waSendImage(s, phone, img, caption, mediaId)) sent++;
  }
  return sent;
}

// carro abaixo da FIPE = "oferta imperdível"
const abaixoFipe = (v: any) => v?.fipePrice && Number(v.price) > 0 && Number(v.price) < Number(v.fipePrice);

// OFERTA NA HORA: o motor de intenção detectou um desejo e o carro JÁ está no estoque agora.
// Manda a vitrine na sequência da conversa (janela de 24h aberta → mensagem livre, sem template).
// Dedup casa com o cron: mesma chave notification_log radar:{radarId}:{vehId} + âncora = data de
// criação do radar → a oferta instantânea e a do cron NUNCA mandam o mesmo carro duas vezes.
async function maybeInstantOffer(user: any, intent: any): Promise<void> {
  try {
    if (!user?.phone || !intent?.radarId) return;
    const scopeId = await garagemDealerId(user.dealership).catch(() => null);
    let cars = await mktVehicles({
      brand: intent.brand || undefined, search: intent.model || undefined,
      maxPrice: intent.maxPrice || undefined, minYear: intent.minYear || undefined,
      dealershipId: scopeId || undefined, limit: 6,
    }).catch(() => [] as any[]);
    if (!cars.length) return; // não tem agora → o cron avisa quando entrar (mágica adiada)

    const anchor = String(intent.createdAt || new Date().toISOString()).split("T")[0];
    const novos: any[] = [];
    for (const v of cars) {
      if (!v?.id) continue;
      const { error } = await supabase.from("notification_log").insert({
        user_id: user.id, kind: `radar:${intent.radarId}:${v.id}`, due_date: anchor, channel: "whatsapp",
      });
      if (error) continue; // 23505 = já avisado (cron ou rodada anterior) → pula
      novos.push(v);
    }
    if (!novos.length) return; // tudo que casa já foi avisado
    novos.sort((a, b) => Number(abaixoFipe(b)) - Number(abaixoFipe(a))); // oferta imperdível primeiro

    const s = await getSettings();
    const desejo = [intent.brand, intent.model].filter(Boolean).join(" ") || "o carro que você comentou";
    const hot = abaixoFipe(novos[0]) ? ", e tem um *abaixo da tabela* 🔥" : "";
    await waSendText(s, user.phone, `🎯 Que timing! Você comentou de *${desejo}* e eu tenho no estoque *agora*${hot}. Olha só 👇`);
    await sendCarShowcase(user.phone, novos.slice(0, 5), user.referral_code);
  } catch (e) { console.error("maybeInstantOffer:", e); }
}

// ---------- FERRAMENTAS DA IA (function calling) ----------
const TOOL_SPECS = [
  {
    name: "registrar_gasto",
    description: "Registra um GASTO ou RECEITA do carro. Use quando a mensagem (texto, foto de cupom/nota ou áudio) descrever uma despesa/receita. Em COMBUSTÍVEL, informe também os litros.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "Descrição curta, ex.: 'Abastecimento Posto Shell'" },
        amount: { type: "number", description: "Valor POSITIVO em reais. Em cupom, leia o TOTAL." },
        type: { type: "string", enum: ["expense", "income"] },
        category: { type: "string", description: "A melhor categoria EXISTENTE; ou nome novo curto se nenhuma servir" },
        is_new_category: { type: "boolean" },
        date: { type: "string", description: "Data yyyy-mm-dd" },
        odometer: { type: "number", description: "Km atual, ou 0 se não houver" },
        litros: { type: "number", description: "Litros abastecidos (só combustível), ou 0" },
      },
      required: ["description", "amount", "type", "category", "is_new_category", "date", "odometer"],
    },
  },
  {
    name: "atualizar_hodometro",
    description: "Registra a quilometragem lida na foto do hodômetro (painel). Usa para completar o consumo do último abastecimento e atualizar a km do carro.",
    parameters: { type: "object", properties: { km: { type: "number", description: "Quilometragem lida" } }, required: ["km"] },
  },
  {
    name: "consumo_medio",
    description: "Consumo do carro: km rodados vs litros usados (km/L) por abastecimento e na média, e custo de combustível por km.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "corrigir_ultimo_gasto",
    description: "CORRIGE o último gasto registrado (valor, litros, km ou descrição). Use quando o usuário corrigir algo logo após um registro (ex.: 'o valor exato é 101'). NUNCA crie um novo lançamento para correção.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Novo valor em reais (positivo), se corrigido" },
        litros: { type: "number", description: "Novos litros, se corrigido" },
        odometer: { type: "number", description: "Nova km, se corrigida" },
        description: { type: "string", description: "Nova descrição, se corrigida" },
      },
    },
  },
  {
    name: "resumo_financeiro",
    description: "Resumo financeiro do carro: gasto do mês/por categoria, total histórico, financiamentos, valor de compra e vencimentos (IPVA, licenciamento, seguro).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "status_manutencao",
    description: "Itens de manutenção por km e quantos km faltam, com base no hodômetro atual.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "registrar_multa",
    description: "Salva uma multa analisada e a minuta de recurso gerada. Use SEMPRE que analisar a foto de um auto de infração/multa.",
    parameters: {
      type: "object",
      properties: {
        descricao: { type: "string", description: "Resumo da infração" },
        orgao: { type: "string" },
        auto_numero: { type: "string" },
        data_infracao: { type: "string", description: "yyyy-mm-dd" },
        local: { type: "string" },
        enquadramento: { type: "string", description: "Artigo do CTB / código" },
        valor: { type: "number" },
        pontos: { type: "number" },
        placa: { type: "string" },
        prazo_recurso: { type: "string", description: "yyyy-mm-dd (data limite p/ recorrer)" },
        gravidade: { type: "string", description: "leve/media/grave/gravissima" },
        chance: { type: "string", enum: ["baixa", "media", "alta"] },
        recurso_texto: { type: "string", description: "Minuta do recurso (defesa prévia) pronta pra protocolar" },
      },
      required: ["descricao", "recurso_texto"],
    },
  },
  {
    name: "minhas_multas",
    description: "Lista as multas do usuário e o status do recurso.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "arquivar_documento",
    description: "GUARDA no ArquivoZap o documento que o usuário acabou de enviar (foto/PDF). Chame SEMPRE que a mídia for um documento que vale guardar: multa/auto de infração, IPVA, boleto, CRLV/CRV (documento do carro), CNH, nota fiscal, apólice de seguro, manual, comprovante. Chame ALÉM de qualquer outra ação (ex.: junto com registrar_multa). NÃO chame para hodômetro/painel, print de ganhos de app, foto de carro à venda, selfie ou paisagem.",
    parameters: {
      type: "object",
      properties: {
        tipo: { type: "string", description: "Um de: multa, ipva, boleto, crlv, cnh, nota_fiscal, seguro, manual, comprovante, documento" },
        nome: { type: "string", description: "Rótulo curto e humano, ex.: 'Boleto IPVA 2026', 'CRLV Civic', 'Multa Av. Paulista'" },
        resumo: { type: "string", description: "1 linha com o essencial que dá pra ler (vencimento, valor, placa, órgão...)" },
      },
      required: ["tipo", "nome"],
    },
  },
  {
    name: "buscar_documento",
    description: "Acha e ENVIA no chat os documentos que o usuário guardou no ArquivoZap. Use quando pedir 'cadê meu X', 'me manda o boleto/CRLV', 'onde está meu documento', 'meus documentos'. Sem termo, manda os mais recentes.",
    parameters: {
      type: "object",
      properties: { termo: { type: "string", description: "Tipo ou nome do documento, ex.: 'boleto ipva', 'crlv', 'multa', 'cnh'. Vazio = mais recentes." } },
    },
  },
  {
    name: "pontos_cnh",
    description: "Pontos acumulados na CNH nos últimos 12 meses (das multas registradas) e risco de suspensão (regra do CTB). Use para 'quantos pontos eu tenho?', 'vou perder a CNH?', 'tô perto de suspender?'.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "buscar_carros",
    description: "Caminho PRINCIPAL de recomendação: busca carros no ESTOQUE REAL do marketplace Totexmotors pelos critérios que o USUÁRIO QUER (tipo, marca, preço, ano, km). BUSCA DIRETA: se o usuário NOMEAR um modelo/marca ou perguntar 'tem X?' ('tem Mustang?', 'quero um Onix', 'tem Corolla até 80 mil?'), chame JÁ com busca=<modelo> — NÃO faça perguntas antes. Só pergunte pra entender o desejo quando ele NÃO deu nenhum critério ('quero trocar de carro'). Sempre que for recomendar/comprar/trocar pelo gosto do usuário, é esta.",
    parameters: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Texto livre: MODELO específico (ex.: 'Argo', 'Corolla'). NUNCA coloque categoria (SUV/sedan) aqui — use o campo categoria." },
        categoria: { type: "string", enum: ["suv", "sedan", "hatch", "picape"], description: "Categoria de carroceria, quando o usuário pedir por tipo ('um SUV', 'uma picape', 'um sedan')" },
        marca: { type: "string" },
        preco_max: { type: "number", description: "Preço máximo em reais" },
        ano_min: { type: "number", description: "Ano mínimo" },
        km_max: { type: "number", description: "Km máxima" },
      },
    },
  },
  {
    name: "oportunidades_carros",
    description: "EXTRA opcional: ideias de carro na faixa de preço do carro atual. NÃO é o caminho para recomendar — só use se o usuário pedir explicitamente 'me dá ideias/o que tem na minha faixa', ou como complemento DEPOIS de já ter entendido o desejo dele. Para recomendar de verdade, entenda o que o usuário QUER e use buscar_carros. Nunca sugira trocar por conta própria.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "criar_radar",
    description: "Deixa um carro desejado NO RADAR: salva o pedido, avisa a loja (lead) e o usuário será notificado quando o carro aparecer. Use quando o carro que o usuário quer NÃO está no estoque.",
    parameters: {
      type: "object",
      properties: {
        marca: { type: "string" }, modelo: { type: "string" }, cor: { type: "string" },
        preco_max: { type: "number" }, ano_min: { type: "number" }, km_max: { type: "number" },
        obs: { type: "string", description: "Preferências extras (câmbio, teto solar…)" },
      },
    },
  },
  {
    name: "planejar_viagem",
    description: "MODO VIAGEM: monta o plano de uma viagem de CARRO usando os dados REAIS do carro do usuário (consumo, preço médio que ele paga no litro, manutenções pendentes). Use quando falarem de viagem, road trip, feriado, férias, 'vou pra praia/serra', 'quanto gasto pra ir até X'. Retorna os dados do carro; você monta o roteiro e as contas.",
    parameters: {
      type: "object",
      properties: {
        destino: { type: "string", description: "Cidade/região de destino (se o usuário já disse)" },
        origem: { type: "string", description: "Cidade de partida, se informada" },
        dias: { type: "number", description: "Duração em dias, se informada" },
        perfil: { type: "string", description: "Perfil da viagem: familia, casal, amigos, sozinho, pet, carro_novo" },
      },
    },
  },
  {
    name: "buscar_servico",
    description: "RADAR DE SERVIÇOS: encontra oficina, borracharia, pneus, bateria, autoelétrica, chaveiro, guincho, funilaria, vidros, ar-condicionado ou estética PERTO do motorista. Use SEMPRE que ele precisar de um serviço no carro ('preciso trocar a bateria', 'onde arrumo o freio', 'furei o pneu', 'meu carro não pega'), inclusive depois de um diagnóstico. NÃO peça autorização para pesquisar — busca de dado público é livre. Se não souber onde ele está, pergunte a cidade/bairro ANTES de chamar.",
    parameters: {
      type: "object",
      properties: {
        service_type: {
          type: "string",
          description: "Categoria conhecida: oficina, freios, autoeletrica, bateria, pneus, borracharia, chaveiro, vidros, ar_condicionado, funilaria, estetica, vistoria, guincho, socorro, eletrico_hibrido, posto, alinhamento, escapamento, cambio, oleo, insulfilm, som, martelinho, despachante, gnv. Se não encaixar em nenhuma, use 'oficina' e preencha busca_livre.",
        },
        busca_livre: { type: "string", description: "Use quando o serviço NÃO estiver na lista de categorias: o termo exato que o motorista pediu (ex.: 'blindagem', 'plotagem de adesivo', 'guincho de moto', 'oficina de câmbio CVT'). Deixe vazio se usou uma categoria conhecida." },
        location_text: { type: "string", description: "Cidade, bairro ou referência (ex.: 'Barueri', 'Alphaville', 'Castelo Branco km 22'). Se ele já informou antes, pode omitir." },
        emergency: { type: "boolean", description: "true se o carro está parado/na rua/em risco — prioriza quem vai até ele e atende 24h" },
        mode: { type: "string", enum: ["balanced", "nearest", "best_rated", "open_now", "mobile_service", "totex_partner"], description: "Ordenação, quando o motorista pedir ('o mais perto', 'o mais bem avaliado')" },
        limit: { type: "number", description: "Quantos apresentar (3 a 6; padrão 6)" },
      },
      required: ["service_type"],
    },
  },
  {
    name: "pedir_orcamento",
    description: "Registra pedido de orçamento a estabelecimentos ESCOLHIDOS pelo motorista. EFEITO EXTERNO: só chame DEPOIS de ele autorizar explicitamente e você ter dito QUAIS dados serão compartilhados. Nunca chame por iniciativa própria.",
    parameters: {
      type: "object",
      properties: {
        provider_ids: { type: "array", items: { type: "string" }, description: "IDs (provider_id) devolvidos por buscar_servico — no máximo 4" },
        service_type: { type: "string" },
        details: { type: "string", description: "O que ele quer orçar, em 1 frase" },
        shared_fields: { type: "array", items: { type: "string" }, description: "Dados autorizados. Ex.: ['primeiro_nome','telefone','resumo_do_veiculo']" },
        consent_text: { type: "string", description: "A frase de autorização DELE, literal (ex.: 'pode pedir orçamento pras duas primeiras')" },
      },
      required: ["provider_ids", "service_type", "shared_fields", "consent_text"],
    },
  },
  {
    name: "registrar_receita",
    description: "Registra uma RECEITA/ganho do motorista de aplicativo: print da tela de ganhos (Uber/99/outros), áudio ou texto ('fiz 380 hoje na uber'). No print, leia o app, o período e o VALOR TOTAL. Ativa o Modo PRO automaticamente.",
    parameters: {
      type: "object",
      properties: {
        fonte: { type: "string", enum: ["Uber", "99", "Outros apps", "Táxi", "Corrida particular", "Gorjeta"] },
        valor: { type: "number", description: "Valor POSITIVO em reais (total do período do print, ou o valor informado)" },
        descricao: { type: "string", description: "Ex.: 'Ganhos Uber 24–30/06'" },
        date: { type: "string", description: "Data yyyy-mm-dd (fim do período do print, ou hoje)" },
      },
      required: ["fonte", "valor", "descricao", "date"],
    },
  },
  {
    name: "lucro_periodo",
    description: "Lucro do motorista num período: receitas − despesas, km rodados (se houver) e lucro por km. Use para 'quanto sobrou essa semana/esse mês?'. Datas yyyy-mm-dd.",
    parameters: {
      type: "object",
      properties: { de: { type: "string" }, ate: { type: "string" } },
      required: ["de", "ate"],
    },
  },
  {
    name: "care_statement",
    description: "Score de Cuidado / Selo Totex do usuário: pontos, selo (Bronze/Prata/Ouro), o que falta pro próximo, faixa garantida da FIPE na recompra e últimos eventos. Use quando ele perguntar do Selo, pontos, 'quanto vale meu cuidado', 'quanto meu carro vale na troca garantida', progresso do programa.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "meu_calendario",
    description: "Próximas datas do carro num lugar só: vencimentos (IPVA, licenciamento, seguro, CNH, parcela do financiamento, prazo de multa, assinatura) e revisões PROJETADAS pelo ritmo de uso. Use para 'o que vence?', 'tá tudo em dia?', 'quando é minha próxima revisão?', 'o que tenho pra pagar?'.",
    parameters: { type: "object", properties: { dias: { type: "number", description: "janela em dias, default 60" } } },
  },
  {
    name: "relatorio_fiscal",
    description: "Gera e ENVIA (PDF aqui no WhatsApp) o relatório fiscal do motorista: receitas por app, despesas dedutíveis, lucro, km, R$/km e % do limite MEI. Use para: relatório, IR, imposto de renda, MEI, carnê-leão, extrato pra contador. Default: mês anterior fechado; 'do ano'/'declaração' → anual.",
    parameters: {
      type: "object",
      properties: {
        periodo: { type: "string", description: "AAAA-MM (mensal) ou AAAA (anual); vazio = mês anterior fechado" },
        kind: { type: "string", enum: ["mensal", "anual"] },
      },
    },
  },
  {
    name: "custo_por_km",
    description: "Custo REAL do carro: quanto custa por KM rodado e por MÊS, e pra onde vai o dinheiro (combustível, manutenção, impostos/seguro, financiamento). Use para 'quanto meu carro me custa?', 'custo por km', 'quanto gasto por mês com o carro?'. Sem datas = tudo que foi registrado.",
    parameters: { type: "object", properties: { de: { type: "string", description: "AAAA-MM-DD (opcional)" }, ate: { type: "string", description: "AAAA-MM-DD (opcional)" } } },
  },
  {
    name: "boleto_parcela",
    description: "Consulta o financiamento do usuário: próxima parcela (número, valor, vencimento) e a LINHA DIGITÁVEL do boleto salvo, se houver. Use quando o usuário pedir o boleto/código de barras da parcela.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "salvar_boleto",
    description: "Salva a linha digitável do boleto da PRÓXIMA parcela do financiamento (o usuário manda por texto ou FOTO do boleto — leia TODOS os dígitos da linha digitável, geralmente 47).",
    parameters: {
      type: "object",
      properties: {
        linha_digitavel: { type: "string", description: "Somente os dígitos da linha digitável (44, 47 ou 48 dígitos)" },
        banco: { type: "string", description: "Banco do financiamento, se o usuário tiver mais de um" },
      },
      required: ["linha_digitavel"],
    },
  },
  {
    name: "salvar_carne",
    description: "Salva TODAS as parcelas do CARNÊ do financiamento de uma vez (PDF ou fotos do carnê do banco). Passe o número da parcela e a linha digitável COMPLETA de cada uma.",
    parameters: {
      type: "object",
      properties: {
        parcelas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              numero: { type: "number", description: "Número da parcela (1, 2, 3...)" },
              linha_digitavel: { type: "string", description: "Somente os dígitos (44, 47 ou 48)" },
            },
            required: ["numero", "linha_digitavel"],
          },
        },
        banco: { type: "string", description: "Banco, se o usuário tiver mais de um financiamento" },
      },
      required: ["parcelas"],
    },
  },
  {
    name: "abrir_chamado",
    description: "Abre um chamado de SUPORTE para o responsável humano e o notifica no WhatsApp. Use quando NÃO conseguir resolver: problema de pagamento/cobrança, reembolso/cancelamento, bug/erro, reclamação séria, ou quando o cliente pedir um humano. Use também para registrar SUGESTÕES de melhoria (assunto 'Sugestão').",
    parameters: {
      type: "object",
      properties: {
        assunto: { type: "string", description: "Assunto curto" },
        resumo: { type: "string", description: "Resumo do problema/sugestão + o que já foi tentado" },
        urgencia: { type: "string", enum: ["baixa", "media", "alta"] },
      },
      required: ["assunto", "resumo", "urgencia"],
    },
  },
  {
    name: "link_acesso",
    description: "Gera e ENVIA ao usuário um link SEGURO de acesso ao PAINEL WEB (login de uso único, sem senha, expira em ~1h). Use quando ele perguntar como acessar/entrar no app/site/painel, quiser 'ver o painel', ou pedir o link/login. NÃO existe app na Play Store/App Store — o acesso é este link (ou o próprio WhatsApp).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "status_transferencia",
    description: "Status REAL da transferência de propriedade / documentação do carro comprado na loja parceira (checklist do pós-venda: vistoria, ATPV-e, taxas DETRAN, débitos, comunicação de venda, novo CRLV-e) + garantia e próxima revisão. Use SEMPRE que perguntarem sobre transferência, documentação, CRLV, 'meu documento', garantia da loja ou revisão agendada — NUNCA responda com passos genéricos de DETRAN sem consultar esta ferramenta primeiro.",
    parameters: { type: "object", properties: {} },
  },
];

type ToolCtx = { user: any; vehicle: any; today: string; inputText: string; shownCars?: boolean; archive?: { tipo: string; nome: string; resumo?: string; meta?: any } };

// ArquivoZap: sobe os bytes do documento pro Storage e grava a ficha (o arquivamento é automático —
// dispara em background depois do turno, com a classificação que a IA já fez na foto/PDF).
async function archiveDoc(phone: string, userId: string | null, media: { data: string; mime: string; kind: string }, cls: { tipo: string; nome: string; resumo?: string; meta?: any }): Promise<void> {
  try {
    const ext = media.kind === "pdf" ? "pdf" : (String(media.mime || "").split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${onlyDigits(phone)}/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(media.data), (c) => c.charCodeAt(0));
    const up = await supabase.storage.from("arquivozap").upload(path, bytes, { contentType: media.mime || "application/octet-stream", upsert: false });
    if (up.error) { console.error("arquivozap upload:", up.error.message); return; }
    await supabase.from("arquivozap_docs").insert({
      user_id: userId || null, phone: onlyDigits(phone),
      tipo: (cls.tipo || "documento").toLowerCase(), nome: cls.nome || cls.tipo || "documento",
      resumo: cls.resumo || null, meta: cls.meta || {},
      storage_path: path, mime: media.mime || null, size: bytes.length,
    });
  } catch (e) { console.error("archiveDoc:", e); }
}

async function dispatchTool(name: string, args: any, ctx: ToolCtx): Promise<any> {
  const { user, vehicle, today } = ctx;
  try {
    if (name === "registrar_gasto") {
      if (!vehicle) return { ok: false, error: "sem_veiculo", message: "O usuário precisa cadastrar o veículo no app (menu 'Meu Veículo') antes de registrar gastos." };
      const exp = args || {};
      if (!(Math.abs(Number(exp.amount)) > 0)) {
        return { ok: false, error: "valor_ausente", message: "NÃO registrado: o valor em R$ está faltando ou é zero. Pergunte o valor ao usuário (ou recupere-o da conversa) e tente de novo." };
      }
      const tipo = exp.type === "income" ? "income" : "expense";
      const catId = await resolveCategory(String(exp.category || "Outros"), tipo, !!exp.is_new_category);
      const amount = tipo === "income" ? Math.abs(Number(exp.amount)) : -Math.abs(Number(exp.amount));
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(exp.date)) ? exp.date : today;
      const odometer = Number(exp.odometer) > 0 ? Number(exp.odometer) : null;
      const litros = Number(exp.litros) > 0 ? Number(exp.litros) : null;
      const base: any = {
        user_id: user.id, account_id: vehicle.id, category_id: catId,
        description: exp.description, amount, type: tipo,
        transaction_date: date, odometer, source: "whatsapp", raw_input: ctx.inputText,
      };
      let ins = await supabase.from("transactions").insert(litros != null ? { ...base, litros } : base);
      if (ins.error && litros != null) ins = await supabase.from("transactions").insert(base); // fallback se coluna litros não existir ainda
      if (odometer && (!vehicle.hodometro || odometer > Number(vehicle.hodometro))) {
        await supabase.from("accounts").update({ hodometro: odometer }).eq("id", vehicle.id);
        vehicle.hodometro = odometer;
      }
      const isFuel = /combust/i.test(String(exp.category || "")) || litros != null;
      // Score de Cuidado (fase SILENCIOSA — GAMIFICACAO-SCORE-CUIDADO.md): pontua em background,
      // sem mencionar nada ao usuário até o lançamento do Selo (Fase 4).
      if (isFuel && tipo === "expense" && !ins.error) {
        const p = careFuel(supabase, user.id, vehicle.id, { litros, odometer, dateStr: date, isPro: !!user.driver_mode });
        (globalThis as any).EdgeRuntime?.waitUntil?.(p) ?? p.catch(() => {});
      }
      return {
        ok: true,
        registrado: { descricao: exp.description, valor: Math.abs(Number(exp.amount)), tipo, categoria: exp.category, data: date, litros },
        pedir_hodometro: (isFuel && !odometer) ? true : false,
      };
    }

    if (name === "atualizar_hodometro") {
      const km = Number(args?.km);
      if (!(km > 0)) return { error: "km_invalido" };
      if (!vehicle) return { ok: false, error: "sem_veiculo" };
      // sanidade: km menor que o registrado = leitura truncada OU registro antigo errado — não grava
      const atual = Number(vehicle.hodometro || 0);
      if (atual > 0 && km < atual) {
        return {
          ok: false, error: "km_menor_que_registrado", km_lido: km, km_registrado: atual,
          message: `A km lida (${km}) é MENOR que a registrada (${atual}). Peça ao usuário para confirmar a leitura completa do hodômetro (todos os dígitos). Se a km registrada estiver errada (ex.: teste), oriente a corrigir em Meu Veículo no app.`,
        };
      }
      if (km > atual) {
        await supabase.from("accounts").update({ hodometro: km }).eq("id", vehicle.id);
        vehicle.hodometro = km;
      }
      // back-fill: completa o último abastecimento sem km (últimos 3 dias)
      try {
        const { data: fuelCats } = await supabase.from("categories").select("id").ilike("name", "%combust%");
        const ids = (fuelCats || []).map((c: any) => c.id);
        if (ids.length) {
          const since = new Date(Date.now() - 3 * 86400000).toISOString();
          const { data: pend } = await supabase.from("transactions").select("id")
            .eq("user_id", user.id).in("category_id", ids).is("odometer", null)
            .gte("created_at", since).order("created_at", { ascending: false }).limit(1);
          if (pend && pend.length) await supabase.from("transactions").update({ odometer: km }).eq("id", pend[0].id);
        }
      } catch { /* */ }
      const consumo = await computeConsumo(user.id);
      // Score de Cuidado (silencioso): hodômetro do mês pontua 1×
      {
        const p = careOdometer(supabase, user.id, vehicle.id, km);
        (globalThis as any).EdgeRuntime?.waitUntil?.(p) ?? p.catch(() => {});
      }
      return { ok: true, hodometro: km, consumo };
    }

    if (name === "consumo_medio") {
      const consumo = await computeConsumo(user.id);
      if (!consumo) return { ok: false, message: "Ainda não tenho abastecimentos suficientes com o hodômetro. A cada abastecimento, me mande o valor/litros e uma foto do hodômetro." };
      return { ok: true, ...consumo };
    }

    if (name === "corrigir_ultimo_gasto") {
      const { data: lastTx } = await supabase.from("transactions")
        .select("id, type, amount")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!lastTx) return { ok: false, error: "sem_lancamentos" };
      const upd: any = {};
      if (Number(args?.amount) > 0) upd.amount = lastTx.type === "income" ? Math.abs(Number(args.amount)) : -Math.abs(Number(args.amount));
      if (Number(args?.litros) > 0) upd.litros = Number(args.litros);
      if (Number(args?.odometer) > 0) upd.odometer = Number(args.odometer);
      if (args?.description) upd.description = String(args.description);
      if (!Object.keys(upd).length) return { ok: false, error: "nada_para_corrigir" };
      const { error } = await supabase.from("transactions").update(upd).eq("id", lastTx.id);
      if (error) {
        // fallback se a coluna litros não existir ainda
        delete upd.litros;
        if (Object.keys(upd).length) await supabase.from("transactions").update(upd).eq("id", lastTx.id);
      }
      if (upd.odometer && (!vehicle?.hodometro || upd.odometer > Number(vehicle.hodometro))) {
        await supabase.from("accounts").update({ hodometro: upd.odometer }).eq("id", vehicle.id);
        vehicle.hodometro = upd.odometer;
      }
      return { ok: true, corrigido: upd };
    }

    if (name === "resumo_financeiro") return await buildSnapshot(user.id, vehicle);

    if (name === "status_manutencao") {
      const { data: rem } = await supabase.from("maintenance_reminders").select("*").eq("user_id", user.id).eq("active", true);
      const km = Number(vehicle?.hodometro || 0);
      const itens = (rem || []).map((r: any) => {
        const faltam = Number(r.interval_km) - (km - Number(r.last_km || 0));
        return { item: r.title, intervalo_km: r.interval_km, faltam_km: faltam, status: faltam <= 0 ? "vencida" : faltam <= 500 ? "proxima" : "em_dia" };
      });
      return { hodometro_atual: km, itens, total: itens.length };
    }

    if (name === "buscar_servico") {
      // RADAR DE SERVIÇOS. Busca pública = livre, sem pedir autorização.
      // Não cria lead: o estabelecimento é opção, o motorista é que escolhe.
      const sCfg = await getSettings();
      if (sCfg?.radar_enabled === false) return { ok: false, error: "radar_desativado" };

      const serviceType = normalizeServiceType(args?.service_type);
      const def = SERVICE_TYPES[serviceType];
      const local = String(args?.location_text || (vehicle as any)?.cidade || "").trim();
      if (!local) {
        return {
          ok: false, error: "localizacao_ausente", service_label: def.label,
          message: `Pergunte em UMA linha onde ele está (cidade ou bairro) para procurar ${def.label.toLowerCase()}. Não invente localização.`,
        };
      }
      // lembra a cidade pra não perguntar toda vez
      if (args?.location_text && vehicle?.id && String(args.location_text).trim() !== String((vehicle as any)?.cidade || "")) {
        await supabase.from("accounts").update({ cidade: String(args.location_text).trim() }).eq("id", vehicle.id);
      }

      const combustivel = String(vehicle?.combustivel || "").toLowerCase();
      const isEv = /elétric|eletric|ev\b/.test(combustivel);
      const isHybrid = /híbrid|hibrid/.test(combustivel);
      const carro = vehicle ? `${vehicle.marca || ""} ${vehicle.modelo || ""} ${vehicle.ano_modelo || ""}`.trim() : null;
      const limite = Math.min(Math.max(Number(args?.limit) || 6, 3), 6);
      const emEmergencia = isEmergencyService(serviceType) || args?.emergency === true;
      const t0 = Date.now();

      // busca livre: se o motorista pediu algo fora da lista, o termo dele manda
      const buscaLivre = String(args?.busca_livre || "").trim() || null;
      const usarPlaces = sCfg?.radar_search_provider === "google_places" && !!sCfg?.google_places_api_key && !buscaLivre;
      const r = usarPlaces
        ? await searchViaGooglePlaces(sCfg.google_places_api_key, { serviceType, locationText: local, limit: limite })
        : await searchViaSearchPreview(sCfg?.openai_api_key || "", { serviceType, locationText: local, vehicle: carro, limit: limite, freeQuery: buscaLivre });

      // lojas do ecossistema ganham selo
      const { data: lojas } = await supabase.from("users")
        .select("dealership").eq("role", "dealer").not("dealership", "is", null);
      // PARCEIROS cadastrados do Radar: entram na lista + selo + topo (prioridade)
      const cityTok = local.split(/[,\-]/)[0].replace(/[,()%]/g, " ").trim();
      let pQuery = supabase.from("service_partners").select("*").eq("active", true)
        .or(`city.is.null,city.ilike.%${cityTok}%`);
      // busca livre casa parceiro pelo termo (categoria/nome); busca por categoria casa a categoria exata
      const livreSan = (buscaLivre || "").replace(/[,()%]/g, " ").trim();
      pQuery = buscaLivre
        ? pQuery.or(`category.ilike.%${livreSan}%,name.ilike.%${livreSan}%`)
        : pQuery.eq("category", serviceType);
      const { data: partners } = await pQuery.limit(10);
      const partnerRaws = (partners || []).map(partnerToRaw);
      const partnerNames = [...new Set([...(lojas || []).map((l: any) => String(l.dealership)), ...(partners || []).map((p: any) => String(p.name))])];

      const ranked = partnersFirst(rankProviders(dedupProviders([...partnerRaws, ...r.providers]), {
        mode: (String(args?.mode || "balanced") as RankingMode),
        isEv, isHybrid, emergency: emEmergencia, partnerNames,
      })).slice(0, limite);

      // conta indicações dos parceiros que apareceram (prova de valor pra cobrança)
      for (const rp of ranked) {
        if (!rp.partner_id) continue;
        const row = (partners || []).find((x: any) => String(x.id) === rp.partner_id);
        if (row) await supabase.from("service_partners").update({ shown_count: (Number(row.shown_count) || 0) + 1, updated_at: new Date().toISOString() }).eq("id", rp.partner_id);
      }

      // registra a busca (auditoria + custo), mesmo se falhou
      const { data: busca } = await supabase.from("service_searches").insert({
        user_id: user.id, vehicle_id: vehicle?.id || null,
        query: String(args?.service_type || def.label), service_type: serviceType,
        location_text: local, radius_km: 15,
        filters: { canal: "whatsapp", emergency: emEmergencia },
        result_count: ranked.length, sources: [usarPlaces ? "google_places" : "search_preview"],
        cost: r.cost, duration_ms: Date.now() - t0, ok: !r.error, error: r.error,
      }).select().single();

      // persiste os estabelecimentos e devolve com id + links prontos
      const saida: any[] = [];
      for (const prov of ranked) {
        const externalId = prov.external_id || (radarNormalizePhone(prov.phone) || prov.name.toLowerCase().replace(/\s+/g, "-"));
        const { data: up } = await supabase.from("discovered_providers").upsert({
          external_source: prov.source, external_id: externalId,
          name: prov.name, normalized_name: prov.name.toLowerCase().trim(),
          category: def.label, provider_status: prov.provider_status,
          phone: prov.phone, phone_normalized: radarNormalizePhone(prov.phone),
          whatsapp: prov.whatsapp, website: prov.website, address: prov.address,
          city: prov.city, state: prov.state, rating: prov.rating, review_count: prov.review_count,
          service_attributes: {
            open_24h: prov.open_24h, mobile_service: prov.mobile_service,
            supports_ev: prov.supports_ev, supports_hybrid: prov.supports_hybrid,
          },
          last_checked_at: new Date().toISOString(),
        }, { onConflict: "external_source,external_id" }).select().single();

        if (up?.id && busca?.id) {
          await supabase.from("provider_search_results").upsert({
            search_id: busca.id, provider_id: up.id, rank_score: prov.rank_score,
            rank_position: prov.rank_position, matched_reasons: prov.matched_reasons,
          }, { onConflict: "search_id,provider_id" });
        }

        const tel = radarNormalizePhone(prov.phone);
        const zap = radarNormalizePhone(prov.whatsapp) || tel;
        saida.push({
          provider_id: up?.id || null, nome: prov.name,
          tipo: prov.provider_status === "parceiro_totex" ? "PARCEIRO TOTEX" : "resultado público",
          endereco: prov.address || "não informado",
          nota: prov.rating ?? "não informado",
          avaliacoes: prov.review_count ?? "não informado",
          telefone: tel ? `+55${tel}` : "não informado",
          whatsapp: zap ? `https://wa.me/55${zap}` : null,
          mapa: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prov.address ? `${prov.name} ${prov.address}` : prov.name)}`,
          site: prov.website || null,
          atende_24h: prov.open_24h ?? "não informado",
          vai_ate_voce: prov.mobile_service ?? "não informado",
          porque: prov.matched_reasons,
        });
      }

      return {
        ok: true, search_id: busca?.id || null,
        servico: def.label, local, emergencia: emEmergencia,
        total: saida.length, opcoes: saida,
        instrucao: saida.length
          ? `Apresente as ${saida.length} opções de forma CURTA (WhatsApp): nome, o motivo (campo 'porque'), nota e telefone/link. Marque quem é PARCEIRO TOTEX e diga que o resto é resultado público — encontrado em fonte pública, a confirmar direto com o estabelecimento; a Totex não credencia nem garante. NUNCA invente preço, disponibilidade, garantia ou tempo de chegada: o que veio "não informado" fica "não informado". Feche com UMA próxima ação (mandar o link do WhatsApp dele, ligar ou abrir a rota). Se ele quiser que a gente peça orçamento, aí sim peça autorização explícita e diga quais dados vão.`
          : `Não achei estabelecimento confiável para ${def.label.toLowerCase()} em ${local}. Diga isso com honestidade e ofereça ampliar a região ou tentar categoria parecida. NÃO invente nome de oficina.`,
      };
    }

    if (name === "pedir_orcamento") {
      // EFEITO EXTERNO: sem consentimento explícito, não passa.
      const consent = String(args?.consent_text || "").trim();
      const shared: string[] = Array.isArray(args?.shared_fields) ? args.shared_fields : [];
      const ids: string[] = Array.isArray(args?.provider_ids) ? args.provider_ids.filter(Boolean) : [];
      if (consent.length < 10) {
        return { ok: false, error: "consentimento_ausente", message: "NÃO enviado. Antes, diga ao motorista exatamente quais dados serão compartilhados e com quem, e espere ele autorizar com clareza." };
      }
      if (!shared.length) return { ok: false, error: "shared_fields_ausente", message: "NÃO enviado. Liste ao motorista quais dados você vai compartilhar e confirme." };
      if (!ids.length || ids.length > 4) return { ok: false, error: "provider_ids_invalido", message: "Informe de 1 a 4 provider_id vindos de buscar_servico." };

      const { data: qr, error } = await supabase.from("provider_quote_requests").insert({
        user_id: user.id, vehicle_id: vehicle?.id || null,
        service_type: normalizeServiceType(args?.service_type),
        provider_ids: ids, details: { texto: String(args?.details || "") },
        shared_fields: shared, consent_text: consent, status: "pending",
      }).select().single();
      if (error) return { ok: false, error: "falha_ao_registrar", detalhes: error.message };

      for (const pid of ids) {
        await supabase.from("driver_provider_actions").insert({
          user_id: user.id, provider_id: pid, action_type: "requested_quote", metadata: { quote_id: qr.id },
        }).then(() => {}, () => {});
      }

      return {
        ok: true, quote_id: qr.id, dados_compartilhados: shared,
        instrucao: "Confirme que o pedido ficou registrado COM a autorização dele e repita quais dados foram compartilhados. Explique que o envio automático ao estabelecimento ainda não está ativo — então o caminho mais rápido é ele chamar no WhatsApp/telefone pelos links que você já mandou.",
      };
    }

    if (name === "planejar_viagem") {
      // CAMINHO PRINCIPAL: edge viagem (mesmo motor do app) — pesquisa ao vivo, monta o plano
      // ESTRUTURADO e SALVA em viagem_planos → a página /viagem abre em cards sem recalcular.
      try {
        const resV = await fetch(`${SUPABASE_URL}/functions/v1/viagem`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
          body: JSON.stringify({ user_id: user.id, destino: args?.destino || undefined, origem: args?.origem || undefined, dias: args?.dias || undefined, perfil: args?.perfil || undefined }),
        });
        const rv = await resV.json().catch(() => ({}));
        if (rv?.ok && (rv.plano || rv.plano_texto)) {
          const { data: cfgApp } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
          const appUrl = String(cfgApp?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
          // link só quando o plano ESTRUTURADO existe (é ele que vira cards e fica salvo)
          const linkCards = rv.plano ? `${appUrl}/viagem` : null;
          return {
            ok: true, plano: rv.plano || null, plano_texto: rv.plano_texto || null,
            dados_do_carro: rv.dados, pesquisa_web: rv.pesquisa_web,
            link_cards: linkCards,
            instrucao: `Transforme o PLANO em uma mensagem de WhatsApp gostosa de ler: título com origem→destino, a conta do combustível MOSTRADA (cite a fonte do consumo que está em dados_do_carro.fonte_consumo — se for estimativa, DIGA que é estimativa), pedágios (total ida+volta), balsa se houver (preço + dica), 2-3 hospedagens por faixa, comidas imperdíveis e o alerta de manutenção pré-viagem se existir. Use *negrito* e emojis com moderação.${linkCards ? " FECHE SEMPRE com: '✨ Seu plano ficou salvo no app com cards e valores: " + linkCards + "'" : ""} NUNCA invente valor que não está no plano.`,
          };
        }
      } catch (e) { console.error("edge viagem falhou, caindo no caminho inline:", e); }

      // FALLBACK (edge indisponível): monta os ingredientes aqui e a IA compõe o texto.
      // MODO VIAGEM: entrega os dados REAIS do carro; a IA monta roteiro + contas por cima.
      // 1) consumo: real (tanque-a-tanque) > oficial (INMETRO) > estimativa por categoria
      const consumoReal = await computeConsumo(user.id).catch(() => null);
      const consV = consumoDoVeiculo(vehicle, Number(consumoReal?.media_km_por_litro) > 0 ? Number(consumoReal.media_km_por_litro) : null);
      const kmPorLitro = consV.kml;
      const custoPorKm = Number(consumoReal?.custo_combustivel_por_km) > 0 ? Number(consumoReal.custo_combustivel_por_km) : null;
      // 2) preço médio do litro que ELE paga (últimos abastecimentos com litros)
      const { data: fuels } = await supabase.from("transactions")
        .select("amount, litros").eq("user_id", user.id).gt("litros", 0)
        .order("transaction_date", { ascending: false }).limit(5);
      let precoLitro: number | null = null;
      if (fuels?.length) {
        const totV = fuels.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
        const totL = fuels.reduce((s: number, t: any) => s + Number(t.litros), 0);
        if (totL > 0) precoLitro = Math.round((totV / totL) * 100) / 100;
      }
      // 3) manutenções que merecem atenção ANTES de pegar estrada
      const { data: rem } = await supabase.from("maintenance_reminders").select("*").eq("user_id", user.id).eq("active", true);
      const kmAtual = Number(vehicle?.hodometro || 0);
      const pendencias = (rem || []).map((r: any) => {
        const faltam = Number(r.interval_km) - (kmAtual - Number(r.last_km || 0));
        return { item: r.title, faltam_km: faltam };
      }).filter((p: any) => p.faltam_km <= 1500);

      // PESQUISAS EM TEMPO REAL (paralelas): rota (pedágios/balsa) + lugares (onde ficar/comer)
      let pesquisa: string | null = null;
      let lugares: string | null = null;
      if (args?.destino) {
        const sCfg = await getSettings();
        if (sCfg?.openai_api_key) {
          [pesquisa, lugares] = await Promise.all([
            pesquisarRota(sCfg.openai_api_key, String(args?.origem || ""), String(args.destino)).catch(() => null),
            pesquisarLugares(sCfg.openai_api_key, String(args.destino), args?.perfil ? String(args.perfil) : undefined).catch(() => null),
          ]);
        }
      }

      return {
        ok: true,
        carro: { marca: vehicle?.marca, modelo: vehicle?.modelo, ano: vehicle?.ano_modelo, combustivel: vehicle?.combustivel },
        consumo_km_por_litro: kmPorLitro,
        custo_combustivel_por_km_real: custoPorKm,
        fonte_consumo: consV.fonte,
        preco_medio_litro_que_ele_paga: precoLitro,
        manutencoes_antes_de_viajar: pendencias,
        loja_do_cliente: user.dealership || null,
        checklist_padrao: ["Calibragem dos pneus (incluindo estepe)", "Nível de óleo e água/arrefecimento", "Palhetas e água do para-brisa", "Documento (CRLV) e CNH válidos", "Triângulo, macaco e chave de roda", "Farol/lanternas funcionando"],
        destinos_em_alta_2026: ["Morro Branco (CE)", "Juquehy (SP)", "Serra da Canastra (MG)", "Espírito Santo do Pinhal (SP, enoturismo)", "Bento Gonçalves (RS)", "Península de Maraú (BA)"],
        pesquisa_tempo_real: pesquisa,
        onde_ficar_e_comer: lugares,
        instrucao: pesquisa || lugares
          ? "Monte o plano usando as pesquisas como FONTE DA VERDADE. Da pesquisa_tempo_real: distância, PEDÁGIOS praça a praça (some ida e volta), BALSA/travessia se houver (preço do carro + dica de fila/compra antecipada) e condições — NÃO chute valores de rota. De onde_ficar_e_comer: cite 2-3 hospedagens por faixa (nome + bairro + reputação; diária só se veio na pesquisa) e os restaurantes/bares imperdíveis — NUNCA invente estabelecimento nem preço. Combustível: MOSTRE a conta com os dados reais — se houver custo_combustivel_por_km_real use km total × custo/km; senão (km ÷ km/L) × preço do litro, ida E volta. Se houver manutencoes_antes_de_viajar, recomende resolver ANTES (agendar na loja_do_cliente, se houver). Feche com checklist resumido. Tom leve de parceiro de estrada."
          : "Monte o plano da viagem: estime a distância (base de rotas BR) SINALIZANDO que pedágio/travessia são aproximados e devem ser conferidos. Combustível com a conta mostrada (custo/km real ou km÷km/L × preço do litro, ida e volta). Manutenções pendentes → resolver antes (loja do cliente). Checklist no fim. Sem destino → sugira 2-3 destinos_em_alta pelo perfil. Não invente preço de hospedagem nem estabelecimentos.",
      };
    }

    if (name === "registrar_multa") {
      const a = args || {};
      const row: any = {
        user_id: user.id, account_id: vehicle?.id || null,
        orgao: a.orgao || null, auto_numero: a.auto_numero || null,
        data_infracao: /^\d{4}-\d{2}-\d{2}$/.test(String(a.data_infracao)) ? a.data_infracao : null,
        local: a.local || null, enquadramento: a.enquadramento || null, descricao: a.descricao || null,
        valor: Number(a.valor) > 0 ? Number(a.valor) : null, pontos: Number(a.pontos) >= 0 ? Number(a.pontos) : null,
        placa: a.placa || vehicle?.placa || null,
        prazo_recurso: /^\d{4}-\d{2}-\d{2}$/.test(String(a.prazo_recurso)) ? a.prazo_recurso : null,
        gravidade: a.gravidade || null, chance: a.chance || null,
        recurso_texto: a.recurso_texto || null, status: "recurso_gerado",
      };
      const { data, error } = await supabase.from("multas").insert(row).select("id").single();
      if (error) return { ok: false, error: error.message };
      // multa sempre vai pro ArquivoZap (mesmo se a IA esquecer arquivar_documento)
      ctx.archive = { tipo: "multa", nome: `Multa ${a.local || a.auto_numero || ""}`.trim(), resumo: a.descricao || "" };
      return { ok: true, id: data.id };
    }

    if (name === "arquivar_documento") {
      ctx.archive = {
        tipo: String(args?.tipo || "documento"),
        nome: String(args?.nome || "Documento"),
        resumo: String(args?.resumo || ""),
      };
      return { ok: true, message: "Documento guardado no ArquivoZap. Confirme em 1 linha natural que guardou e que ele pode pedir depois (ex.: 'guardei seu CRLV no ArquivoZap — é só me pedir quando precisar 👍'). NÃO invente conteúdo." };
    }

    if (name === "buscar_documento") {
      const ph = onlyDigits(String(user?.phone || ""));
      if (!ph) return { ok: false, message: "Preciso do WhatsApp do usuário pra achar os documentos." };
      // sanitiza: vírgula/parênteses/% quebram o filtro .or() do PostgREST
      const termo = String(args?.termo || "").replace(/[,()%]/g, " ").trim().slice(0, 40);
      let query = supabase.from("arquivozap_docs").select("*").eq("phone", ph).order("created_at", { ascending: false });
      query = termo ? query.or(`tipo.ilike.%${termo}%,nome.ilike.%${termo}%,resumo.ilike.%${termo}%`).limit(6) : query.limit(8);
      const { data: docs } = await query;
      if (!docs?.length) {
        return { ok: true, encontrados: 0, message: termo
          ? `Não achei documento de "${termo}" no ArquivoZap. Assim que você mandar um (foto ou PDF), eu guardo automático e ele fica aqui pra sempre.`
          : "Você ainda não tem documentos no ArquivoZap. Manda uma multa, boleto, IPVA, CRLV etc. que eu guardo sozinho — depois é só pedir." };
      }
      const s = await getSettings();
      let enviados = 0;
      for (const d of docs) {
        const { data: signed } = await supabase.storage.from("arquivozap").createSignedUrl(d.storage_path, 600);
        if (!signed?.signedUrl) continue;
        const cap = `📎 ${d.nome || d.tipo}${d.resumo ? ` — ${d.resumo}` : ""}`;
        const isPdf = String(d.mime || "").includes("pdf") || String(d.storage_path || "").endsWith(".pdf");
        const ok = isPdf
          ? await waSendDocument(s, String(user.phone), signed.signedUrl, `${String(d.nome || d.tipo || "documento").replace(/[^\w.-]+/g, "_")}.pdf`, cap)
          : await waSendImage(s, String(user.phone), signed.signedUrl, cap);
        if (ok) enviados++;
      }
      return { ok: true, encontrados: docs.length, enviados, itens: docs.map((d: any) => ({ tipo: d.tipo, nome: d.nome })),
        instrucao: "Os arquivos JÁ foram enviados no chat acima. Comente em 1 linha natural o que mandou (ex.: 'te mandei seu CRLV e o boleto do IPVA 👆'). NÃO repita o conteúdo nem invente." };
    }

    if (name === "minhas_multas") {
      try {
        const { data } = await supabase.from("multas")
          .select("descricao, valor, pontos, prazo_recurso, status, chance, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
        return { multas: data || [] };
      } catch (e) { return { error: String((e as any)?.message || e) }; }
    }

    if (name === "pontos_cnh") {
      try {
        const { data } = await supabase.from("multas")
          .select("pontos, gravidade, data_infracao, created_at, status").eq("user_id", user.id);
        // regra padrão (não assume EAR — só avisa): assumir 40 sem a CNH ter EAR daria falsa folga
        const r = computeCnhPoints(data || [], false);
        return {
          ok: true, ...r,
          nota_ear: user.driver_mode ? "Você é motorista de app: SE sua CNH tiver EAR (atividade remunerada), seu limite é 40 pontos — confirme na sua CNH." : "Se a CNH tiver EAR (atividade remunerada), o limite é 40.",
          obs: "Baseado nas multas registradas aqui nos últimos 12 meses — pode não incluir todas; confirme o total no DETRAN.",
        };
      } catch (e) { return { error: String((e as any)?.message || e) }; }
    }

    if (name === "buscar_carros") {
      // cliente de loja (cortesia/bônus) vê SÓ o estoque da loja dele; demais veem tudo
      const scopeId = await garagemDealerId(user.dealership).catch(() => null);
      // categoria de carroceria: o filtro é NOSSO (a API do marketplace não filtra por categoria
      // e o bodyType vem sujo) — busca um lote maior e classifica com carClass().
      // Lote de 120: uma loja sozinha já passa de 50 carros (Cardoso tem 94) — com 40, parte do
      // estoque nunca entrava no funil e SUVs reais sumiam da vitrine.
      const catFiltro = normCategoria(args?.categoria);
      const busca = String(args?.busca || "").trim();
      const maxPrice = Number(args?.preco_max) > 0 ? Number(args.preco_max) : undefined;
      const minYear = Number(args?.ano_min) > 0 ? Number(args.ano_min) : undefined;
      const maxMileage = Number(args?.km_max) > 0 ? Number(args.km_max) : undefined;
      let cars = await mktVehicles({
        brand: args?.marca, maxPrice, minYear, maxMileage,
        dealershipId: scopeId || undefined,
        limit: (catFiltro || busca) ? 120 : 10,
      });
      // até 10: é o máximo de cards do carrossel — vitrine cheia em vez de 6
      if (catFiltro) cars = cars.filter((c: any) => carClass(c) === catFiltro);
      if (busca) {
        // interpreta o MODELO digitado: tolera minúsculas, parcial e erro de digitação (carMatchesQuery)
        let matched = cars.filter((c: any) => carMatchesQuery(c, busca));
        if (!matched.length) { // pode estar além do lote → reforça com a busca exata do servidor
          const server = await mktVehicles({ search: busca, brand: args?.marca, maxPrice, minYear, maxMileage, dealershipId: scopeId || undefined, limit: 120 });
          matched = catFiltro ? server.filter((c: any) => carClass(c) === catFiltro) : server;
        }
        cars = matched;
      }
      cars = cars.slice(0, 10);
      if (!cars.length) {
        const alvo = busca || catFiltro || [args?.marca].filter(Boolean).join(" ") || "esse perfil";
        return { ok: true, total: 0, categoria: catFiltro || undefined, message: `NENHUM carro no estoque com "${alvo}". Seja DIRETO e honesto: diga que NÃO tem "${alvo}" no estoque agora — NÃO mostre nem sugira outros carros como se fossem a resposta. No máximo ofereça, em 1 linha, criar um radar (criar_radar) pra avisar quando aparecer, OU pergunte se ele topa ver algo parecido (aí sim, só se ele aceitar).` };
      }
      // VITRINE: manda as fotos dos carros direto no chat
      const enviados = user.phone ? await sendCarShowcase(user.phone, cars, user.referral_code) : 0;
      if (enviados > 0) ctx.shownCars = true; // já mostrou carros nesta conversa → motor de intenção não duplica
      return {
        ok: true, total: cars.length, fotos_enviadas: enviados,
        carros: cars.map((v: any) => mktResumo(v, user.referral_code)),
        instrucao: enviados > 0 ? "As FOTOS já foram enviadas (cards deslizáveis). Agora fala como um amigo que manja de carro num papo de WhatsApp — NÃO como vendedor nem folheto. Regras: (a) SEM lista numerada, SEM negrito, SEM '1. 2. 3.'; texto corrido de 2-3 linhas. (b) PROIBIDO adjetivo de propaganda ('ótimo custo-benefício', 'muito confiável', 'design moderno', 'completo'); fale detalhe CONCRETO e honesto (ex.: 'o Corolla 2018 é câmbio CVT, macio no trânsito e revenda tranquila', 'o Prisma tem porta-malas grande, bom se você anda com a família'). (c) puxa 1 ou 2 que MAIS casam com o que ELE falou e diz o porquê ligado ao USO dele; se algum tiver um ponto fraco relevante, seja honesto. (d) varia a abertura (nada de 'Encontrei X opções que podem te interessar'); pode fechar perguntando qual chamou mais atenção. NÃO repita preço/link (já estão nos cards)." : undefined,
      };
    }

    if (name === "oportunidades_carros") {
      let cars: any[] = [];
      let criterio = "destaques do estoque";
      // cliente de loja vê SÓ o estoque da loja dele
      const scopeId = await garagemDealerId(user.dealership).catch(() => null);
      if (vehicle?.valor_compra && Number(vehicle.valor_compra) > 0) {
        const v = Number(vehicle.valor_compra);
        criterio = `upgrade a partir do ${vehicle.marca || ""} ${vehicle.modelo || ""} (referência R$ ${v})`;
        cars = await mktVehicles({ minPrice: Math.round(v * 0.9), maxPrice: Math.round(v * 1.9), minYear: vehicle.ano_modelo || undefined, dealershipId: scopeId || undefined, limit: 6 });
        if (!cars.length) cars = await mktVehicles({ minPrice: Math.round(v * 0.7), dealershipId: scopeId || undefined, limit: 6 });
      } else if (scopeId) {
        cars = await mktVehicles({ dealershipId: scopeId, limit: 6, sort: "year_desc" });
      } else {
        const res = await fetch(`${MARKETPLACE_URL}/api/vehicles/featured?limit=6`);
        const d = await res.json().catch(() => []);
        cars = Array.isArray(d) ? d : (d?.data || []);
      }
      const own = `${vehicle?.marca || ""} ${vehicle?.modelo || ""}`.trim().toLowerCase();
      if (own) cars = cars.filter((c: any) => `${c.brand} ${c.model}`.toLowerCase() !== own || c.year !== vehicle?.ano_modelo);
      cars = cars.slice(0, 6);
      const enviados = user.phone ? await sendCarShowcase(user.phone, cars, user.referral_code) : 0;
      if (enviados > 0) ctx.shownCars = true; // já mostrou carros → motor de intenção não duplica
      return {
        ok: true, criterio, fotos_enviadas: enviados,
        carros: cars.map((c: any) => mktResumo(c, user.referral_code)),
        instrucao: enviados > 0 ? "As FOTOS já foram enviadas (cards deslizáveis). Comenta em 1-2 linhas naturais, como amigo que entende de carro — SEM lista numerada, SEM negrito, SEM adjetivo de folheto. Puxa 1 que faça sentido e diz um detalhe concreto do porquê. Não repita preço/link." : undefined,
      };
    }

    if (name === "criar_radar") {
      const row = {
        user_id: user.id,
        brand: args?.marca || null, model: args?.modelo || null, color: args?.cor || null,
        max_price: Number(args?.preco_max) > 0 ? Number(args.preco_max) : null,
        min_year: Number(args?.ano_min) > 0 ? Number(args.ano_min) : null,
        max_km: Number(args?.km_max) > 0 ? Number(args.km_max) : null,
        notes: args?.obs || null, active: true,
      };
      if (!row.brand && !row.model && !row.max_price) return { ok: false, error: "criterios_insuficientes", message: "Pergunte ao menos marca, modelo ou faixa de preço." };
      const { data: created, error } = await supabase.from("car_radar").insert(row).select("id").single();
      if (error) return { ok: false, error: error.message };
      const desejo = [row.brand, row.model, row.min_year ? `a partir de ${row.min_year}` : "", row.color, row.max_km ? `até ${row.max_km} km` : "", row.max_price ? `até R$ ${row.max_price}` : ""].filter(Boolean).join(", ");
      try {
        const res = await fetch(`${MARKETPLACE_URL}/api/leads/contact`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: user.name || "Cliente TotexCar", email: user.email || "", telefone: user.phone || "",
            assunto: "RADAR TotexCar Co-pilot — carro procurado",
            mensagem: `Cliente deixou no radar (via WhatsApp): ${desejo}.${row.notes ? ` Obs: ${row.notes}.` : ""} Carro atual: ${vehicle ? `${vehicle.marca || ""} ${vehicle.modelo || ""} ${vehicle.ano_modelo || ""}` : "não informado"}.${user.dealership ? ` Loja de origem: ${user.dealership}.` : ""}`,
          }),
        });
        if (res.ok) await supabase.from("car_radar").update({ lead_sent: true }).eq("id", created.id);
      } catch { /* lead falhou: radar segue salvo */ }
      return { ok: true, radar_id: created.id, message: "Radar ativado e loja avisada. O usuário pode acompanhar em Garagem Totex no app." };
    }

    if (name === "registrar_receita") {
      if (!vehicle) return { ok: false, error: "sem_veiculo", message: "Cadastre o veículo no app (menu 'Meu Veículo') antes." };
      const fonte = String(args?.fonte || "Outros apps");
      const valor = Math.abs(Number(args?.valor));
      if (!(valor > 0)) return { error: "valor_invalido" };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.date)) ? args.date : today;
      const catId = await resolveCategory(fonte, "income", false);
      await supabase.from("transactions").insert({
        user_id: user.id, account_id: vehicle.id, category_id: catId,
        description: String(args?.descricao || `Ganhos ${fonte}`), amount: valor, type: "income",
        transaction_date: date, source: "whatsapp", raw_input: ctx.inputText,
      });
      let proAtivado = false;
      if (!user.driver_mode) {
        await supabase.from("users").update({ driver_mode: true }).eq("id", user.id);
        user.driver_mode = true;
        proAtivado = true;
      }
      return { ok: true, registrado: { fonte, valor, data: date }, modo_pro_ativado_agora: proAtivado };
    }

    if (name === "lucro_periodo") {
      const de = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.de)) ? args.de : today;
      const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.ate)) ? args.ate : today;
      const { data: tx } = await supabase.from("transactions")
        .select("amount, type, odometer")
        .eq("user_id", user.id).gte("transaction_date", de).lte("transaction_date", ate);
      let receita = 0, despesa = 0;
      const odos: number[] = [];
      (tx || []).forEach((t: any) => {
        if (t.type === "income") receita += Math.abs(Number(t.amount));
        else despesa += Math.abs(Number(t.amount));
        if (Number(t.odometer) > 0) odos.push(Number(t.odometer));
      });
      const km = odos.length >= 2 ? Math.round(Math.max(...odos) - Math.min(...odos)) : null;
      const lucro = Number((receita - despesa).toFixed(2));
      return {
        ok: true, de, ate,
        receita: Number(receita.toFixed(2)), despesa: Number(despesa.toFixed(2)), lucro,
        km_rodados: km, lucro_por_km: km && km > 0 ? Number((lucro / km).toFixed(2)) : null,
      };
    }

    if (name === "care_statement") {
      const st = await careStatement(supabase, user);
      if (!st.elegivel) {
        return {
          ok: false, error: "nao_elegivel",
          message: "O programa Selo Totex é EXCLUSIVO para clientes que compraram o carro numa loja parceira aderida. NÃO venda nem prometa o programa a este usuário. Se ele perguntou, explique com naturalidade que é um benefício dos clientes das lojas parceiras Totex — e que os registros dele continuam valorizando o histórico do carro de qualquer forma.",
        };
      }
      return {
        ok: true, ...st,
        orientacao: "Traduza SEMPRE em dinheiro/faixa, nunca só pontos: selo atual → faixa mínima garantida da FIPE na recompra da loja dele (condicionada à vistoria presencial). NUNCA prometa 90% fixo — diga 'até 90%, conforme seu Selo e a vistoria'. Se tiver proximo_selo, mostre o caminho ('faltam X pontos e Y meses pro Selo prata = mínimo 85%'). Se troca12m_ate existir, lembre do bônus: trocando até essa data, garante o teto de 90%.",
      };
    }

    if (name === "meu_calendario") {
      const dias = Number(args?.dias) > 0 ? Math.min(365, Number(args.dias)) : 60;
      const eventos = await calendarUpcoming(supabase, user.id, dias);
      const kmDia = await calendarKmDia(supabase, user.id, !!user.driver_mode);
      return {
        ok: true, janela_dias: dias, km_medio_dia: kmDia, hodometro: vehicle?.hodometro || null,
        eventos: eventos.map((e: any) => ({
          o_que: e.label, tipo: e.kind, data: e.due_date, dias_restantes: e.dias,
          valor: e.amount || undefined, vencido: e.status === "vencido" || e.dias < 0,
          projetado_por_uso: !!e.projected, ...(e.projected && e.meta?.km_restante != null ? { km_restante: e.meta.km_restante } : {}),
        })),
        orientacao: eventos.length
          ? "Apresente em ordem de data com os dias restantes ('IPVA em 12 dias'). Revisões projetadas: deixe claro que é projeção pelo ritmo DELE ('mantendo seus ~X km/dia'). Vencido = alerta com cuidado, sem bronca."
          : "Nada nos próximos dias — diga isso de forma leve ('tudo em dia por aqui 🙌') e, se fizer sentido, 1 cuidado preventivo curto.",
      };
    }

    if (name === "relatorio_fiscal") {
      // gera na edge fiscal-report (cálculo 100% em código) e manda o PDF AQUI na conversa
      const kind = args?.kind === "anual" ? "anual" : "mensal";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/fiscal-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
        body: JSON.stringify({ user_id: user.id, periodo: args?.periodo || undefined, kind }),
      });
      const r = await res.json().catch(() => ({}));
      if (!r?.ok) {
        if (r?.error === "sem_movimento") return { ok: false, error: "sem_movimento", periodo: r.periodo, message: "Não há receitas/gastos registrados nesse período. Diga isso com naturalidade e lembre que é só mandar os prints de ganhos e cupons que você organiza tudo." };
        return { ok: false, error: String(r?.error || "falha_geracao") };
      }
      let pdf_enviado = false;
      if (r.pdf_url) {
        pdf_enviado = await waSendDocument(await getSettings(), String(user.phone || ""),
          r.pdf_url, `relatorio-${kind}-${r.periodo}.pdf`, `📄 Relatório ${kind} — ${r.label}`);
      }
      return {
        ok: true, periodo: r.periodo, label: r.label, kind, totais: r.totals,
        pdf_enviado, csv_url: r.csv_url,
        orientacao: "Resuma em 2 linhas: lucro do período + R$/km. O PDF já foi enviado na conversa (se pdf_enviado=true). Diga que serve de base pro contador/carnê-leão, mas NUNCA dê conselho fiscal definitivo ('sou seu copiloto, não seu contador'). Se mei_pct >= 70, avise com cuidado que está se aproximando do limite MEI — é proteção, não bronca. Ofereça o CSV (link) só se ele pedir 'pra planilha/contador'.",
      };
    }

    if (name === "custo_por_km") {
      const hasDe = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.de));
      const hasAte = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.ate));
      let q = supabase.from("transactions")
        .select("amount, odometer, transaction_date, created_at, categories(name)")
        .eq("user_id", user.id).eq("type", "expense");
      if (hasDe) q = q.gte("transaction_date", args.de);
      if (hasAte) q = q.lte("transaction_date", args.ate);
      const { data: tx } = await q;
      const exp = (tx || []).filter((t: any) => Math.abs(Number(t.amount)) > 0);
      if (exp.length < 2) return { ok: true, suficiente: false, message: "Ainda não tenho gastos suficientes (com km do hodômetro) pra calcular o custo por km. Peça pra registrar os gastos com a foto do hodômetro." };
      const total = exp.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
      // km: soma incrementos plausíveis entre leituras (descarta salto/typo de odômetro)
      const leituras = exp.filter((t: any) => Number(t.odometer) > 0).map((t: any) => Number(t.odometer)).sort((a: number, b: number) => a - b);
      let km = 0;
      for (let i = 1; i < leituras.length; i++) { const d = leituras[i] - leituras[i - 1]; if (d > 0 && d <= 15000) km += d; }
      const datas = exp.map((t: any) => t.transaction_date || t.created_at).filter(Boolean).sort();
      const dias = datas.length >= 2 ? Math.max(1, (new Date(datas[datas.length - 1]).getTime() - new Date(datas[0]).getTime()) / 86400000) : 30;
      const meses = Math.max(0.5, dias / 30.44);
      const byBucket: Record<string, number> = {};
      exp.forEach((t: any) => { const b = bucketOf(t.categories?.name || ""); byBucket[b] = (byBucket[b] || 0) + Math.abs(Number(t.amount)); });
      return {
        ok: true, suficiente: true, desde: datas[0], ate: datas[datas.length - 1],
        total_gasto: Number(total.toFixed(2)),
        km_rodados: km,
        custo_por_km: km > 0 ? Number((total / km).toFixed(2)) : null,
        custo_mensal: Number((total / meses).toFixed(2)),
        meses: Number(meses.toFixed(1)),
        por_categoria: byBucket,
        obs: "Custo de dinheiro real gasto; ainda não inclui depreciação do carro.",
      };
    }

    if (name === "boleto_parcela") {
      const { data: fins } = await supabase.from("financiamentos")
        .select("banco, valor_parcela, num_parcelas, parcelas_pagas, primeira_parcela, boleto_linha, boletos")
        .eq("user_id", user.id).eq("ativo", true);
      if (!fins?.length) return { ok: false, message: "Nenhum financiamento ativo. Oriente a cadastrar em Financiamento no app." };
      const addM = (dateStr: string, months: number) => {
        const [y, m, d] = String(dateStr).split("-").map(Number);
        const base = new Date(y, (m - 1) + months, 1);
        const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        base.setDate(Math.min(d, last));
        return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
      };
      return {
        ok: true,
        financiamentos: fins.map((f: any) => {
          const prox = Number(f.parcelas_pagas) + 1;
          return {
            banco: f.banco,
            proxima_parcela: `${prox}/${f.num_parcelas}`,
            valor: Number(f.valor_parcela),
            vencimento: f.primeira_parcela ? addM(f.primeira_parcela, Number(f.parcelas_pagas)) : null,
            linha_digitavel: (f.boletos || {})[String(prox)] || f.boleto_linha || null,
            carne_completo: !!f.boletos && Object.keys(f.boletos).length > 1,
          };
        }),
        obs: "Cada parcela tem boleto PRÓPRIO emitido pelo banco — não é possível gerar o código da próxima automaticamente. Se a linha salva for de parcela anterior, peça o boleto novo (foto) e use salvar_boleto.",
      };
    }

    if (name === "salvar_boleto") {
      const linha = String(args?.linha_digitavel || "").replace(/\D/g, "");
      if (![44, 47, 48].includes(linha.length)) return { ok: false, error: "linha_invalida", message: "A linha digitável deve ter 44, 47 ou 48 dígitos. Peça uma foto nítida do boleto ou o número completo." };
      const { data: fins } = await supabase.from("financiamentos").select("id, banco").eq("user_id", user.id).eq("ativo", true).order("created_at", { ascending: false });
      if (!fins?.length) return { ok: false, error: "sem_financiamento", message: "Nenhum financiamento ativo cadastrado no app." };
      let alvo = fins[0];
      const banco = String(args?.banco || "").toLowerCase();
      if (banco && fins.length > 1) {
        const m = fins.find((f: any) => String(f.banco || "").toLowerCase().includes(banco));
        if (m) alvo = m;
      }
      await supabase.from("financiamentos").update({ boleto_linha: linha }).eq("id", alvo.id);
      return { ok: true, banco: alvo.banco, message: "Boleto salvo — a linha digitável vai junto nos lembretes de vencimento desta parcela." };
    }

    if (name === "salvar_carne") {
      const arr = Array.isArray(args?.parcelas) ? args.parcelas : [];
      const validas: Record<string, string> = {};
      let invalidas = 0;
      for (const p of arr) {
        const linha = String(p?.linha_digitavel || "").replace(/\D/g, "");
        const n = Number(p?.numero);
        if (n > 0 && [44, 47, 48].includes(linha.length)) validas[String(n)] = linha;
        else invalidas++;
      }
      if (!Object.keys(validas).length) return { ok: false, error: "nenhuma_linha_valida", message: "Nenhuma linha digitável válida (precisam ter 44, 47 ou 48 dígitos). Confira a leitura do PDF/foto." };
      const { data: fins } = await supabase.from("financiamentos")
        .select("id, banco, parcelas_pagas, boletos")
        .eq("user_id", user.id).eq("ativo", true).order("created_at", { ascending: false });
      if (!fins?.length) return { ok: false, error: "sem_financiamento", message: "Nenhum financiamento ativo. Oriente a cadastrar em Financiamento no app." };
      let alvo: any = fins[0];
      const banco = String(args?.banco || "").toLowerCase();
      if (banco && fins.length > 1) {
        const m = fins.find((f: any) => String(f.banco || "").toLowerCase().includes(banco));
        if (m) alvo = m;
      }
      const boletos = { ...(alvo.boletos || {}), ...validas };
      const prox = String(Number(alvo.parcelas_pagas) + 1);
      const upd: any = { boletos };
      if (boletos[prox]) upd.boleto_linha = boletos[prox]; // boleto da próxima parcela já fica pronto
      await supabase.from("financiamentos").update(upd).eq("id", alvo.id);
      return {
        ok: true, banco: alvo.banco, parcelas_salvas: Object.keys(validas).length, linhas_invalidas: invalidas,
        message: "Carnê salvo! Cada lembrete de vencimento vai sair com a linha digitável da parcela certa, automaticamente.",
      };
    }

    if (name === "abrir_chamado") {
      const { data: t, error } = await supabase.from("support_tickets").insert({
        user_id: user.id, name: user.name || null, email: user.email || null, phone: user.phone || null,
        channel: "whatsapp",
        subject: String(args?.assunto || "Chamado"),
        description: String(args?.resumo || ""),
        status: "escalado",
      }).select("id").single();
      if (error) return { ok: false, error: error.message };
      const s = await getSettings();
      const ownerPhone = String(s.support_owner_phone || "").replace(/\D/g, "");
      if (ownerPhone) {
        const urg = String(args?.urgencia || "media").toUpperCase();
        // notificação ao dono = iniciada pelo negócio → TEMPLATE na API oficial
        await waSendTemplate(s, ownerPhone, "chamado_suporte", [
          urg,
          `${user.name || "?"} · ${user.email || "?"} · ${user.phone || "s/ tel"}`,
          `${user.plan || "?"} (${user.subscription_status || "?"})${user.dealership ? ` · Loja: ${user.dealership}` : ""}`,
          String(args?.assunto || ""),
          String(args?.resumo || ""),
          String(t.id),
        ]);
      }
      return { ok: true, ticket_id: t.id, message: "Chamado aberto; responsável notificado no WhatsApp." };
    }

    if (name === "link_acesso") {
      // Link mágico de uso único (sem senha) — a conta da cortesia tem senha aleatória, então o acesso web é por aqui.
      const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
      const base = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
      const email = user.email || `${String(user.phone || "").replace(/\D/g, "")}@totexcarfinance.app`;
      try {
        const { data: gen, error } = await supabase.auth.admin.generateLink({
          type: "magiclink", email, options: { redirectTo: base },
        });
        const link = (gen as any)?.properties?.action_link;
        if (error || !link) return { ok: false, error: "link_falhou", message: `Não consegui gerar o link agora. Diga ao usuário pra abrir ${base} e, se precisar, você tenta de novo.` };
        // Encurta: código de uso único que a página /a/{code} troca pelo link real (via edge `go`).
        // Além de curto, protege o token do bot de preview do WhatsApp (que faria GET e consumiria o link mágico).
        let shortUrl = link;
        try {
          const alfa = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
          const code = [...crypto.getRandomValues(new Uint8Array(10))].map((b) => alfa[b % alfa.length]).join("");
          const { error: insErr } = await supabase.from("access_links").insert({
            code, action_link: link, user_id: user.id,
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          });
          if (!insErr) shortUrl = `${base}/a/${code}`;
        } catch { /* fallback: manda o link longo mesmo */ }
        // Envia direto pra garantir o token intacto (o modelo não deve reescrever o link).
        await sendText(String(user.phone), `🔐 Aqui está seu acesso ao painel do TotexCar Co-pilot — link seguro, de uso único, válido por ~1 hora:\n${shortUrl}\n\nÉ só tocar pra entrar (não precisa de senha). Dica: no navegador, use "Adicionar à tela inicial" pra deixar como um atalho de app. 📲`);
        return { ok: true, enviado: true, message: "Link de acesso enviado ao usuário. Apenas confirme em 1 frase que o link foi enviado e que é de uso único/expira em ~1h. NÃO repita o link." };
      } catch (e) {
        return { ok: false, error: "link_falhou", message: `Falha ao gerar o link: ${String((e as any)?.message || e)}. Oriente abrir ${base}.` };
      }
    }

    if (name === "status_transferencia") {
      const js = await findJourneysByPhone(String(user.phone || ""));
      const j = js?.[0];
      if (!j) return { ok: false, error: "sem_jornada", message: "Não há jornada de pós-venda registrada pela loja para este cliente. Explique que a transferência é conduzida pela loja onde ele comprou o carro e sugira falar direto com ela." };
      const T = j.transfer || {};
      return {
        ok: true, loja: j.dealership, carro: j.car_desc, status_transferencia: j.transfer_status,
        checklist: {
          "Vistoria (se exigida)": !!T.vistoria,
          "ATPV-e (autorização) assinada": !!T.atpv,
          "Taxas do DETRAN pagas": !!T.taxas,
          "Débitos quitados (IPVA/multas)": !!T.debitos,
          "Comunicação de venda": !!T.comunicacao,
          "Novo documento (CRLV-e) em nome do comprador": !!T.crlv_novo,
        },
        garantia_ate: j.warranty_until || null, proxima_revisao: j.revisao_proxima || null,
        orientacao: "Apresente como checklist claro (✅ feito / ⬜ pendente) com o status geral. Quem conduz a transferência é a loja; dúvidas específicas → falar com a loja.",
      };
    }

    return { error: "ferramenta_desconhecida" };
  } catch (e) {
    return { error: String((e as any)?.message || e) };
  }
}

// ---------- loop agêntico (tool use) por provedor ----------
const MAX_TURNS = 5;

function openaiTools() {
  return TOOL_SPECS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
function anthropicTools() {
  return TOOL_SPECS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}
function geminiTools() {
  return [{ functionDeclarations: TOOL_SPECS.map((t) => ({ name: t.name, description: t.description, ...(Object.keys(t.parameters.properties).length ? { parameters: t.parameters } : {}) })) }];
}

async function runOpenAI(cfg: any, system: string, parts: any[], ctx: ToolCtx): Promise<string> {
  const userContent = parts.map((p) =>
    p.kind === "image" ? { type: "image_url", image_url: { url: `data:${p.media_type};base64,${p.data}` } }
    : p.kind === "pdf" ? { type: "file", file: { filename: "documento.pdf", file_data: `data:application/pdf;base64,${p.data}` } }
    : { type: "text", text: p.text });
  const messages: any[] = [{ role: "system", content: system }, { role: "user", content: userContent }];
  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1500, messages, tools: openaiTools(), tool_choice: "auto" }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const m = j.choices[0].message;
    messages.push(m);
    if (m.tool_calls && m.tool_calls.length) {
      for (const tc of m.tool_calls) {
        let a: any = {};
        try { a = JSON.parse(tc.function.arguments || "{}"); } catch { /* */ }
        const r = await dispatchTool(tc.function.name, a, ctx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(r) });
      }
      continue;
    }
    return m.content || "";
  }
  return "";
}

async function runAnthropic(cfg: any, system: string, parts: any[], ctx: ToolCtx): Promise<string> {
  const content = parts.map((p) =>
    p.kind === "image" ? { type: "image", source: { type: "base64", media_type: p.media_type, data: p.data } }
    : p.kind === "pdf" ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } }
    : { type: "text", text: p.text });
  const messages: any[] = [{ role: "user", content }];
  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1500, system, tools: anthropicTools(), messages }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const j = await res.json();
    messages.push({ role: "assistant", content: j.content });
    if (j.stop_reason === "tool_use") {
      const results: any[] = [];
      for (const b of (j.content || [])) {
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

async function runGemini(cfg: any, system: string, parts: any[], ctx: ToolCtx): Promise<string> {
  const userParts = parts.map((p) =>
    p.kind === "image" ? { inline_data: { mime_type: p.media_type, data: p.data } }
    : p.kind === "pdf" ? { inline_data: { mime_type: "application/pdf", data: p.data } }
    : { text: p.text });
  const contents: any[] = [{ role: "user", parts: userParts }];
  for (let i = 0; i < MAX_TURNS; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents, tools: geminiTools(), tool_config: { function_calling_config: { mode: "AUTO" } } }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const partsOut = j.candidates?.[0]?.content?.parts || [];
    contents.push({ role: "model", parts: partsOut });
    const calls = partsOut.filter((p: any) => p.functionCall);
    if (calls.length) {
      const fr: any[] = [];
      for (const c of calls) {
        const r = await dispatchTool(c.functionCall.name, c.functionCall.args || {}, ctx);
        fr.push({ functionResponse: { name: c.functionCall.name, response: { result: r } } });
      }
      contents.push({ role: "user", parts: fr });
      continue;
    }
    return partsOut.map((p: any) => p.text).filter(Boolean).join("\n").trim();
  }
  return "";
}

async function runAgent(cfg: { provider: string; model: string; key: string }, system: string, parts: any[], ctx: ToolCtx): Promise<string> {
  if (!cfg.key) throw new Error(`Chave de API não configurada para o provedor ${cfg.provider}`);
  if (cfg.provider === "openai") return runOpenAI(cfg, system, parts, ctx);
  if (cfg.provider === "gemini") return runGemini(cfg, system, parts, ctx);
  return runAnthropic(cfg, system, parts, ctx);
}

// ---------- handler ----------
// CTWA (Click-to-WhatsApp): quando a mensagem vem de um anúncio, o payload traz um
// `referral` com o id do anúncio. O resolvedor `stand.ctwa_lead` mapeia esse id para
// campanha → carro → vendedor, REGISTRA o lead (stand.lead, source=ctwa) e devolve tudo.
// Assim o lead do anúncio fica na mão da Totex, já identificado. O fluxo normal da IA
// segue respondendo o comprador; aqui só registramos/identificamos o lead.
async function handleCtwaReferral(msg: any) {
  try {
    const ref = msg?.referral;
    if (!ref?.source_id) return;
    const { data, error } = await supabase.schema("stand").rpc("ctwa_lead", {
      p_source_id: String(ref.source_id),
      p_phone: msg.phone || null,
      p_name: msg.contactName || null,
      p_message: msg.text || null,
    });
    if (error) { console.error("ctwa_lead rpc:", error.message); return; }
    if (data?.found) {
      console.log("CTWA lead:", JSON.stringify({ car: data.car, seller: data.seller?.name, lead_id: data.lead_id }));
      // TODO(roteamento): notificar o vendedor (data.seller.phone) e/ou abrir o card do carro.
    } else {
      console.log("CTWA referral sem correspondência no stand:", ref.source_id);
    }
  } catch (e) { console.error("handleCtwaReferral:", e); }
}

// ---------- STAND FÍSICO (shopping): QR do totem → wa.me com código #stand ----------
// O QR pré-preenche a mensagem com "#stand <loja|geral> <promotor> [<idDoCarro>]" na última linha.
// Funciona ANTES do cadastro (visitante de shopping raramente é usuário): grava o lead com a
// atribuição (loja/promotor/carro) em whatsapp_events kind=stand_lead e responde NA HORA com a
// vitrine em carrossel. Métricas do dia de stand:
//   SELECT parsed->>'promotor', count(*) FROM whatsapp_events WHERE kind='stand_lead' GROUP BY 1;
const STAND_RE = /#stand\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?(?:\s+([a-z0-9]{16,}))?/i;

// escopo do stand: "geral" = marketplace inteiro; senão casa com o slug da loja (ex.: "cardoso")
async function standScopeId(loja: string): Promise<string | undefined> {
  if (!loja || loja === "geral") return undefined;
  try {
    const res = await fetch(`${MARKETPLACE_URL}/api/dealerships`, { headers: { Accept: "application/json" } });
    const d = await res.json();
    const list = Array.isArray(d) ? d : (d?.data || []);
    return list.find((x: any) => String(x.slug || "").toLowerCase().includes(loja))?.id;
  } catch { return undefined; }
}

// slug da loja → NOME (users.dealership usa nome; buyback_requests e o aviso da loja também)
async function dealerNameBySlug(slug: string): Promise<string | null> {
  if (!slug || slug === "geral") return null;
  try {
    const res = await fetch(`${MARKETPLACE_URL}/api/dealerships`, { headers: { Accept: "application/json" } });
    const d = await res.json();
    const list = Array.isArray(d) ? d : (d?.data || []);
    return list.find((x: any) => String(x.slug || "").toLowerCase() === slug)?.name || null;
  } catch { return null; }
}

// VENDER NO STAND: QR "#vender <loja|geral> <promotor>" → abre o Flow de avaliação FIPE (marca/modelo/
// ano → REFERÊNCIA da tabela). Depois, no chat, o vendedor escolhe a MODALIDADE e o Co-pilot mostra
// QUANTO ELE RECEBE, calculado por MARGEM (não % cru da FIPE):
//   • Venda Express ⚡ — à vista pelo grupo de repasse (até 48h, carro de boa demanda); margem maior.
//   • Venda Vitrine 🏆 — a loja anuncia; o vendedor escolhe o PRAZO (20/45/90 dias) e quanto mais tempo
//     ele topa esperar, MENOR a margem → ele recebe mais. Tática de ancoragem/urgência.
// Config editável em app_settings (buyback_express, buyback_prazos). A atribuição (loja/promotor) fica
// no stand_sell; o estado do fechamento vive num evento sell_pending. Roda ANTES do cadastro.
const VENDER_RE = /#vender\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?/i;
const fmtReais = (v: number) => `R$ ${(Math.round(Number(v) || 0)).toLocaleString("pt-BR")}`;

// margem = max(% da FIPE, piso em R$); valor recebido = FIPE − margem, arredondado pra R$ 100.
function calcOffer(fipe: number, pct: number, piso: number): { margem: number; valor: number } {
  const margem = Math.max(Math.round(fipe * (Number(pct) || 0) / 100), Number(piso) || 0);
  const valor = Math.max(0, Math.round((fipe - margem) / 100) * 100);
  return { margem, valor };
}

// Cenários da Venda Vitrine (do curto ao longo prazo). Nomes com viés de neuromarketing:
// o curto prazo soa como a escolha ativa/competitiva; o longo, como aposta que espera.
const VITRINE_TIERS = [
  { nome: "Venda Competitiva", prazo: "curto prazo", emoji: "⚡" },
  { nome: "Venda Equilibrada", prazo: "médio prazo", emoji: "⚖️" },
  { nome: "Venda Otimista", prazo: "longo prazo", emoji: "🎯" },
];
// mapeia o índice ordenado (curto→longo) pro cenário; degrada bem se houver ≠ 3 prazos
const tierFor = (i: number, total: number) => (total <= 1 || i === 0) ? VITRINE_TIERS[0] : (i >= total - 1 ? VITRINE_TIERS[2] : VITRINE_TIERS[1]);
// Config de margem: padrão da REDE (app_settings) com override POR LOJA (dealer_sell_config).
// A loja do lead que tiver margem própria usa a dela; senão, cai no padrão da rede.
async function sellConfig(dealership?: string | null): Promise<{ prazos: any[]; express: { pct: number; piso: number } }> {
  const { data } = await supabase.from("app_settings").select("buyback_prazos, buyback_express").eq("id", 1).single();
  let prazos = Array.isArray(data?.buyback_prazos) && data!.buyback_prazos.length
    ? data!.buyback_prazos
    : [{ dias: 20, pct: 14, piso: 3500 }, { dias: 45, pct: 10, piso: 2800 }, { dias: 90, pct: 7, piso: 2000 }];
  let express = (data?.buyback_express && typeof data.buyback_express === "object")
    ? data.buyback_express : { pct: 20, piso: 10000 };
  if (dealership) {
    const { data: d } = await supabase.from("dealer_sell_config")
      .select("buyback_prazos, buyback_express").eq("dealership", dealership).maybeSingle();
    if (Array.isArray(d?.buyback_prazos) && d!.buyback_prazos.length) prazos = d!.buyback_prazos;
    if (d?.buyback_express && typeof d.buyback_express === "object") express = d.buyback_express;
  }
  return { prazos, express };
}

// abre o Flow de avaliação FIPE (marca/modelo/ano → referência)
async function abrirAvaliacaoFlow(phone: string) {
  const s = await getSettings();
  await waSendFlow(s, phone, {
    header: "Avalie seu carro 🚗",
    body: "Me diga a marca, o modelo e o ano que eu já pego a referência de tabela — depois você escolhe como quer vender e eu mostro quanto recebe.",
    cta: "Avaliar meu carro", flowId: RECOMPRA_FLOW_ID, token: "recompra",
    fallbackText: "Pra avaliar seu carro, me diga a marca, o modelo e o ano. 🚗",
  });
}

// resolve a atribuição do vendedor: usuário do app > jornada de pós-venda > lead do stand (#vender)
async function resolveSellAttribution(phone: string): Promise<{ dealership: string | null; nome: string | null; loja: string | null; promotor: string | null; ownerId: string | null }> {
  const user = await findUserByPhone(phone);
  const js = user ? [] : await findJourneysByPhone(phone);
  const j = js?.[0] || null;
  let dealership = user?.dealership || j?.dealership || null;
  let nome = user?.name || j?.customer_name || null;
  let loja: string | null = null, promotor: string | null = null;
  if (!dealership) {
    const desde = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    const { data: sell } = await supabase.from("whatsapp_events")
      .select("parsed").eq("from_phone", phone).eq("kind", "stand_sell")
      .gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
    if (sell?.length) {
      const ps = sell[0].parsed as any;
      loja = ps?.loja || null; promotor = ps?.promotor || null;
      if (!nome) nome = ps?.nome || null;
      if (loja && loja !== "geral") dealership = await dealerNameBySlug(loja);
    }
  }
  return { dealership, nome, loja, promotor, ownerId: user?.id || null };
}

// pega o fechamento em andamento (evento sell_pending) — no passo pedido
async function findSellPending(phone: string, step?: string): Promise<{ id: string; parsed: any } | null> {
  const desde = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data } = await supabase.from("whatsapp_events")
    .select("id, parsed").eq("from_phone", phone).eq("kind", "sell_pending")
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
  const ev = data?.[0];
  if (!ev) return null;
  const p = ev.parsed as any;
  if (step && p?.step !== step) return null;
  return { id: ev.id, parsed: p };
}

// Envia o lead pro CRM (TotexGest) — endpoint + api-key ficam em app_settings (fora do git).
// Best-effort com retry curto; nunca trava o webhook (chamado via EdgeRuntime.waitUntil).
async function pushToTotexgest(lead: {
  name?: string | null; phone: string; email?: string | null; city?: string | null; state?: string | null;
  utm_campaign?: string | null; subject?: string | null; notes?: string | null; custom?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const { data } = await supabase.from("app_settings").select("crm_lead_url, crm_lead_key").eq("id", 1).single();
    const url = data?.crm_lead_url; const key = data?.crm_lead_key;
    if (!url || !key) return; // integração desligada
    const body: Record<string, unknown> = {
      name: lead.name || "Lead WhatsApp",
      phone: onlyDigits(lead.phone),
      source: "totexcar-copilot",
      utm_source: "whatsapp",
      utm_campaign: lead.utm_campaign || "captacao",
    };
    if (lead.email) body.email = lead.email;
    if (lead.city) body.city = lead.city;
    if (lead.state) body.state = lead.state;
    // dados ricos da tratativa (o CRM deve registrar como nota/atividade na timeline do lead,
    // inclusive quando o telefone já existe — reconversão)
    if (lead.subject) body.subject = lead.subject;
    if (lead.notes) { body.notes = lead.notes; body.message = lead.notes; body.description = lead.notes; }
    if (lead.custom) body.custom = lead.custom;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "x-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (res.ok) { console.log("totexgest ok", body.phone, body.utm_campaign); return; }
        if (res.status < 500) { console.error("totexgest reject", res.status, await res.text().catch(() => "")); return; } // 4xx: não adianta repetir
        console.error("totexgest 5xx", res.status);
      } catch (e) { console.error("totexgest attempt", i, e); }
      if (i < 2) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
    console.error("totexgest gave up after retries", body.phone);
  } catch (e) { console.error("pushToTotexgest:", e); }
}

// grava o lead final em buyback_requests, avisa a loja e dá os 30 dias. Marca o pending como done.
async function finalizeSellLead(phone: string, pending: { id: string; parsed: any }, res: { modalidade: "express" | "vitrine"; valor: number; margem: number; prazo_dias?: number }) {
  const p = pending.parsed || {};
  await supabase.from("whatsapp_events").update({ parsed: { ...p, step: "done" } }).eq("id", pending.id);

  const carro = p.carro || "veículo";
  const fipe = Number(p.fipe_value) || 0;
  const dealership = p.dealership || null;
  const nome = p.nome || null;

  await supabase.from("buyback_requests").insert({
    owner_id: p.ownerId || null,
    dealership, owner_name: nome, owner_phone: phone,
    brand: p.marca_nome || null, model: p.modelo_nome || carro, year: p.ano_nome || null,
    fuel: p.combustivel || null, fipe_code: p.fipe_code || null, fipe_value: fipe || null,
    offer_value: res.valor || null, modalidade: res.modalidade,
    qualificacao: {
      canal: res.modalidade === "express" ? "repasse_48h" : "vitrine",
      prazo_dias: res.prazo_dias ?? null, margem: res.margem, fipe_value: fipe,
    },
    status: "new",
  });

  // manda o lead pro CRM (TotexGest). Awaited de propósito: o usuário já recebeu a proposta
  // antes daqui, e fire-and-forget via waitUntil era cortado quando o isolate é reciclado.
  {
    const modTxt = res.modalidade === "express" ? "Venda Express (à vista, repasse até 48h)" : `Venda Vitrine (até ${res.prazo_dias} dias)`;
    const notes = `Vendedor quer vender *${carro}* via *${modTxt}*.\n`
      + `Proposta: ${fmtReais(res.valor)} · FIPE ${fmtReais(fipe)} · margem ${fmtReais(res.margem)}.`
      + (dealership ? `\nLoja: ${dealership}.` : "");
    await pushToTotexgest({
      name: nome, phone,
      utm_campaign: res.modalidade === "express" ? "venda-express" : "venda-vitrine",
      subject: `${res.modalidade === "express" ? "Venda Express" : "Venda Vitrine"} — ${carro}`,
      notes,
      custom: {
        carro, modalidade: res.modalidade, valor_proposto: res.valor,
        fipe: fipe, margem: res.margem, prazo_dias: res.prazo_dias ?? null,
        loja: dealership || null,
        marca: p.marca_nome || null, modelo: p.modelo_nome || null, ano: p.ano_nome || null, combustivel: p.combustivel || null,
      },
    });
  }

  const s = await getSettings();
  const modLabel = res.modalidade === "express"
    ? "Venda Express — à vista (repasse até 48h)"
    : `Venda Vitrine — até ${res.prazo_dias} dias`;
  const linhaValor = `${fmtReais(res.valor)} (margem ${fmtReais(res.margem)} · FIPE ${fmtReais(fipe)})`;
  const { data: dealers } = dealership
    ? await supabase.from("users").select("phone").eq("role", "dealer").eq("dealership", dealership).not("phone", "is", null).limit(3)
    : { data: [] as any[] };
  const alvos = (dealers || []).map((d: any) => onlyDigits(d.phone || "")).filter(Boolean);
  if (!alvos.length && s.support_owner_phone) alvos.push(onlyDigits(s.support_owner_phone));
  for (const dp of alvos) {
    await waSendTemplate(s, dp, "pedido_recompra_loja", [
      dealership || "Totex (lead sem loja)", `${nome || phone} · ${modLabel}`, carro, linhaValor, phone,
    ]);
  }

  // 30 dias grátis (quem vende, quer comprar depois)
  const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
  await sendStandGift(phone, (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, ""));
}

async function handleStandSell(phone: string, text: string, contactName?: string): Promise<boolean> {
  const m = String(text || "").match(VENDER_RE);
  if (!m) return false;
  const loja = (m[1] || "geral").toLowerCase();
  const promotor = (m[2] || "").toLowerCase() || null;
  try {
    await supabase.from("whatsapp_events").insert({
      from_phone: phone, kind: "stand_sell", status: "processed",
      raw: { text }, parsed: { loja, promotor, nome: contactName || null },
    });
    const nome = contactName ? `, ${contactName.split(" ")[0]}` : "";
    await sendText(phone, `Boa${nome}! Vender seu carro com a gente é rápido e sem dor de cabeça. 🚗\n\nPrimeiro me diga qual é o carro (marca, modelo e ano) que eu já pego a referência de tabela — depois você escolhe como prefere vender. 👇`);
    await abrirAvaliacaoFlow(phone);
    return true;
  } catch (e) { console.error("handleStandSell:", e); return true; }
}

// Escolha da MODALIDADE depois da avaliação FIPE (Express / Vitrine / Me ajuda).
async function handleSellModalidade(phone: string, text: string): Promise<boolean> {
  const pend = await findSellPending(phone, "modalidade");
  if (!pend) return false;
  const t = String(text || "").toLowerCase().trim();
  const isExpress = /venda express|^express|à vista|a vista|repasse|48/.test(t);
  const isVitrine = /venda vitrine|^vitrine|anunci|ganhar mais|prazo/.test(t);
  const isHelp = /me ajuda|ajuda a escolher|n[aã]o sei/.test(t);
  if (!isExpress && !isVitrine && !isHelp) return false;

  const s = await getSettings();
  const fipe = Number(pend.parsed?.fipe_value) || 0;
  const carro = pend.parsed?.carro || "seu carro";
  const cfg = await sellConfig(pend.parsed?.dealership); // margem da LOJA do lead (ou padrão da rede)
  const quemContata = pend.parsed?.dealership ? `A ${pend.parsed.dealership}` : "Nossa equipe";

  if (isHelp) {
    await sendText(phone, `Rapidinho pra te indicar o melhor 👇\n\n⚡ *Venda Express* — pra carro de *boa demanda*: nosso grupo de repasse compra *à vista, em até 48h*. Zero trabalho, recebe rápido.\n\n🏆 *Venda Vitrine* — a loja *anuncia e vende* o seu. Você escolhe o prazo e, *quanto mais tempo topa esperar, mais recebe*. Usa o carro até vender.`);
    await waSendMenu(s, phone, "Qual combina mais com você?", ["Venda Express", "Venda Vitrine"]);
    return true;
  }

  if (isExpress) {
    const { margem, valor } = calcOffer(fipe, cfg.express.pct, cfg.express.piso);
    await sendText(phone, `⚡ *Venda Express* — pra carro de boa demanda, nosso grupo de repasse fecha *à vista, em até 48h*.\n\nSua proposta pro ${carro} é de até *${fmtReais(valor)}* (valor final na vistoria). Aceita até carro com dívida ou IPVA atrasado.\n\n${quemContata} já vai entrar em contato pra fechar. 🚗`);
    await finalizeSellLead(phone, pend, { modalidade: "express", valor, margem });
    await offerAgendamento(phone, { carro, dealership: pend.parsed?.dealership || null, nome: pend.parsed?.nome || null, source: "sell" });
    return true;
  }

  // Vitrine → apresenta os 3 cenários (curto/médio/longo prazo) com os nomes de neuromarketing
  const prazos = cfg.prazos.map((p: any) => ({ dias: Number(p.dias), ...calcOffer(fipe, p.pct, p.piso) }))
    .sort((a: any, b: any) => a.dias - b.dias);
  await supabase.from("whatsapp_events").update({ parsed: { ...pend.parsed, step: "prazo", prazos } }).eq("id", pend.id);
  const linhas = prazos.map((p: any, i: number) => {
    const t = tierFor(i, prazos.length);
    return `${t.emoji} *${t.nome}* = ${t.prazo} *${fmtReais(p.valor)}*`;
  }).join("\n");
  await sendText(phone, `✅ Avaliei seu ${carro}! Com base na análise de mercado através das fontes de dados do nosso *motor de estudo*, essas são as opções de venda na *Vitrine*:\n\n${linhas}\n\nQual faz mais sentido pra você?\n\n_Estimativa: a avaliação e os valores serão validados mediante avaliação formal do veículo._`);
  await waSendMenu(s, phone, "Escolha o cenário:", prazos.map((_p: any, i: number) => tierFor(i, prazos.length).nome));
  return true;
}

// Escolha do CENÁRIO da Venda Vitrine (Competitiva/Equilibrada/Otimista) → fecha o lead com o valor.
async function handleSellPrazo(phone: string, text: string): Promise<boolean> {
  const pend = await findSellPending(phone, "prazo");
  if (!pend) return false;
  const prazos: any[] = Array.isArray(pend.parsed?.prazos) ? pend.parsed.prazos : [];
  if (!prazos.length) return false;
  const t = String(text || "").toLowerCase();
  let idx = -1;
  if (/competitiv/.test(t)) idx = 0;
  else if (/otimist/.test(t)) idx = prazos.length - 1;
  else if (/equilibrad/.test(t)) idx = Math.min(1, prazos.length - 1);
  else {
    // compat: "até 45 dias" / "45 dias" → casa pelo número
    const mDias = t.match(/(\d{2,3})\s*dias?/) || t.match(/at[ée]\s*(\d{2,3})/);
    if (!mDias) return false;
    const dias = Number(mDias[1]);
    const near = prazos.reduce((best, p) => Math.abs(p.dias - dias) < Math.abs(best.dias - dias) ? p : best, prazos[0]);
    idx = prazos.indexOf(near);
  }
  const escolhido = prazos[idx];
  const tier = tierFor(idx, prazos.length);
  const carro = pend.parsed?.carro || "seu carro";
  const quemContata = pend.parsed?.dealership ? `A ${pend.parsed.dealership}` : "Nossa equipe";
  await sendText(phone, `✅ Fechado! Você escolheu a *${tier.nome}* (${tier.prazo}) pro seu ${carro}: recebe até *${fmtReais(escolhido.valor)}* — valor final na vistoria.\n\nEnquanto isso, o carro continua com você. 🚗`);
  await finalizeSellLead(phone, pend, { modalidade: "vitrine", valor: escolhido.valor, margem: escolhido.margem, prazo_dias: escolhido.dias });
  await offerAgendamento(phone, { carro, dealership: pend.parsed?.dealership || null, nome: pend.parsed?.nome || null, source: "sell" });
  return true;
}

// PRESENTE DO STAND: avisa o visitante que ele ganhou 30 dias grátis do Co-pilot e como ATIVAR
// (criar conta no app com este mesmo WhatsApp → o trigger handle_new_user concede 30 dias porque
// há um stand_lead deste telefone nos últimos 90 dias). Dedup por telefone (1x), grava ANTES de
// enviar pra retry do webhook não mandar 2x.
async function sendStandGift(phone: string, appUrl: string): Promise<void> {
  try {
    const { count } = await supabase.from("whatsapp_events")
      .select("id", { count: "exact", head: true })
      .eq("from_phone", onlyDigits(phone)).eq("kind", "stand_gift");
    if (count) return;
    await supabase.from("whatsapp_events").insert({ from_phone: onlyDigits(phone), kind: "stand_gift", status: "sent", raw: {}, parsed: {} });
    const s = await getSettings();
    // 1º o CARD explicativo (a pessoa entende O QUE é antes de ver o "grátis" — mata o "o que é isso?")
    await waSendImage(s, phone, `${appUrl}/copiloto-explica.jpg`, "Esse é o *TotexCar Co-pilot* — seu assistente de carro aqui no WhatsApp. 🚗");
    // 2º o presente + CTA, agora que já entende o valor
    const texto = `Oi! 👋 Dá uma olhada no que eu faço por você (aqui em cima 👆).\n\nE por você ter passado no nosso stand, os *primeiros 30 dias são por nossa conta* 🎁\n\nQuer experimentar? É só tocar 👇`;
    // botão (zero fricção): toque → provisiona a conta e inicia os 30 dias na hora
    const ok = await waSendMenu(s, phone, texto, ["Ativar 30 dias grátis"]);
    if (!ok) await sendText(phone, `${texto}\n\nOu responda *ATIVAR* que eu libero na hora. (Também dá pra criar conta em ${appUrl}/auth?tab=register)`);
  } catch (e) { console.error("sendStandGift:", e); }
}

// ===================== AGENDAMENTO (avaliação presencial + sessão de fotos no estúdio) =====================
// Fluxo por menu no próprio webhook (sem Flow do Meta): oferta → unidade → dia → horário → confirma.
// O estado vive num evento `agenda_pending` (mesmo padrão do sell_pending). Na confirmação, envia a
// foto da fachada da unidade escolhida + endereço + link do Maps. Fotos são best-effort (se o arquivo
// ainda não existir em /public, a imagem falha em silêncio e o texto com endereço vai do mesmo jeito).
const AGENDA_UNITS: Record<string, { key: string; nome: string; curto: string; endereco: string; foto: string; maps: string }> = {
  carapicuiba: {
    key: "carapicuiba",
    nome: "Cardoso Veículos — Carapicuíba",
    curto: "Carapicuíba",
    endereco: "Av. Desembargador Dr. Eduardo Cunha de Abreu, 131 — Carapicuíba/SP (abaixo do Poupatempo)",
    foto: "loja-carapicuiba.jpg",
    maps: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Cardoso Veículos, Av. Desembargador Dr. Eduardo Cunha de Abreu 131, Carapicuíba SP"),
  },
  alphaville: {
    key: "alphaville",
    nome: "Cardoso Prime — Alphaville",
    curto: "Alphaville",
    endereco: "Alameda Rio Negro, 229 — Alphaville, Barueri/SP (dentro do Posto, ao lado do Shopping Iguatemi)",
    foto: "loja-alphaville.jpg",
    maps: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Cardoso Prime, Alameda Rio Negro 229, Alphaville Barueri SP"),
  },
};
// horários do estúdio: seg–sáb, manhã 9–12 / tarde 14–18
const AGENDA_SLOTS = [
  { h: "09:00", periodo: "manha" }, { h: "10:00", periodo: "manha" }, { h: "11:00", periodo: "manha" },
  { h: "14:00", periodo: "tarde" }, { h: "15:00", periodo: "tarde" }, { h: "16:00", periodo: "tarde" }, { h: "17:00", periodo: "tarde" },
];
// próximos N dias úteis (seg–sáb, pula domingo) no fuso BRT (UTC-3)
function agendaDays(count = 6): { label: string; iso: string }[] {
  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const out: { label: string; iso: string }[] = [];
  const baseBrt = new Date(Date.now() - 3 * 3600_000);
  let d = 1;
  while (out.length < count && d < 20) {
    const day = new Date(baseBrt.getTime() + d * 24 * 3600_000);
    const dow = day.getUTCDay();
    if (dow !== 0) {
      const dd = String(day.getUTCDate()).padStart(2, "0");
      const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
      out.push({ label: `${WD[dow]} ${dd}/${mm}`, iso: `${day.getUTCFullYear()}-${mm}-${dd}` });
    }
    d++;
  }
  return out;
}
function agendaAppUrl(row?: { app_url?: string | null } | null): string {
  return (row?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
}

// OFERTA de agendamento — mostra o estúdio (gera desejo real: foto boa vende mais rápido) e o CTA.
async function offerAgendamento(phone: string, ctx: { carro?: string | null; dealership?: string | null; nome?: string | null; source?: string }): Promise<void> {
  try {
    const s = await getSettings();
    const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
    const appUrl = agendaAppUrl(cfg);
    await supabase.from("whatsapp_events").insert({
      from_phone: onlyDigits(phone), kind: "agenda_pending", status: "processed",
      raw: {}, parsed: { step: "offer", carro: ctx.carro || null, dealership: ctx.dealership || null, nome: ctx.nome || null, source: ctx.source || "sell" },
    });
    await waSendImage(s, phone, `${appUrl}/estudio-totex.jpg`, "Nosso *estúdio profissional* de fotos 📸");
    const txt = `Pra fechar o valor com segurança, o próximo passo é uma *avaliação presencial rápida* — e de quebra seu carro ganha uma *sessão de fotos no nosso estúdio profissional*. Foto boa vende mais rápido e por mais. 🚗✨\n\nQuer já deixar agendado? Eu marco o melhor dia e horário com você.`;
    const ok = await waSendMenu(s, phone, txt, ["📸 Quero agendar", "A loja me chama"]);
    if (!ok) await sendText(phone, `${txt}\n\nResponda *AGENDAR* que eu marco com você.`);
  } catch (e) { console.error("offerAgendamento:", e); }
}

async function findAgendaPending(phone: string): Promise<{ id: string; parsed: any } | null> {
  const desde = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data } = await supabase.from("whatsapp_events")
    .select("id, parsed").eq("from_phone", onlyDigits(phone)).eq("kind", "agenda_pending")
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
  const ev = data?.[0];
  if (!ev) return null;
  const p = ev.parsed as any;
  if (p?.step === "done") return null;
  return { id: ev.id, parsed: p };
}

// Máquina de estados do agendamento. Retorna true se tratou a mensagem.
async function handleAgenda(phone: string, text: string): Promise<boolean> {
  const t = String(text || "").toLowerCase().trim();
  const wantsStart = /#agendar|^agendar\b|quero agendar|agendar (a |uma )?(avalia|foto|vistoria|sess)/.test(t);
  let pend = await findAgendaPending(phone);

  if (!pend && wantsStart) { await offerAgendamento(phone, { source: "hashtag" }); return true; }
  if (!pend) return false;
  const p = pend.parsed || {};
  const s = await getSettings();

  // OFERTA: aceita ou recusa
  if (p.step === "offer") {
    const no = /loja me chama|agora n[aã]o|depois|mais tarde|n[aã]o quero|nao quero|n[aã]o obrig/.test(t);
    const yes = /agendar|avalia|foto|est[uú]dio|marcar|^sim|bora|quero|vamos/.test(t);
    if (no) {
      await supabase.from("whatsapp_events").update({ parsed: { ...p, step: "done", declined: true } }).eq("id", pend.id);
      await sendText(phone, "Tranquilo! 👍 A loja vai te chamar pra combinar a avaliação e as fotos. Se mudar de ideia, é só me mandar *AGENDAR*. 🚗");
      return true;
    }
    if (!yes) return false;
    await supabase.from("whatsapp_events").update({ parsed: { ...p, step: "unidade" } }).eq("id", pend.id);
    await waSendMenu(s, phone, "Show! 📍 Em qual das nossas lojas fica melhor pra você?", [AGENDA_UNITS.carapicuiba.curto, AGENDA_UNITS.alphaville.curto]);
    return true;
  }

  // UNIDADE
  if (p.step === "unidade") {
    let unit = null as (typeof AGENDA_UNITS)[string] | null;
    if (/carapicu/.test(t)) unit = AGENDA_UNITS.carapicuiba;
    else if (/alphav|prime|iguatemi|rio negro/.test(t)) unit = AGENDA_UNITS.alphaville;
    if (!unit) return false;
    const dias = agendaDays(6);
    await supabase.from("whatsapp_events").update({ parsed: { ...p, step: "dia", unidade: unit.key, dias } }).eq("id", pend.id);
    await waSendMenu(s, phone, `Perfeito — *${unit.curto}*. 📅 Qual dia fica melhor?`, dias.map((d) => d.label));
    return true;
  }

  // DIA
  if (p.step === "dia") {
    const dias: any[] = Array.isArray(p.dias) ? p.dias : [];
    const pick = dias.find((d) => t.includes(String(d.label).toLowerCase()))
      || dias.find((d) => { const mm = t.match(/(\d{2})\/(\d{2})/); return mm && String(d.iso).endsWith(`-${mm[2]}-${mm[1]}`); });
    if (!pick) return false;
    await supabase.from("whatsapp_events").update({ parsed: { ...p, step: "horario", data_iso: pick.iso, data_label: pick.label } }).eq("id", pend.id);
    await waSendMenu(s, phone, `📆 *${pick.label}*. Que horário? (manhã ou tarde)`, AGENDA_SLOTS.map((sl) => `${sl.h} — ${sl.periodo === "manha" ? "Manhã" : "Tarde"}`));
    return true;
  }

  // HORÁRIO → finaliza e confirma
  if (p.step === "horario") {
    let slot = AGENDA_SLOTS.find((sl) => t.includes(sl.h));
    if (!slot) { const mh = t.match(/(\d{1,2})[:h]/); if (mh) { const hh = String(mh[1]).padStart(2, "0"); slot = AGENDA_SLOTS.find((sl) => sl.h.startsWith(hh)); } }
    if (!slot) return false;
    const unit = AGENDA_UNITS[p.unidade] || AGENDA_UNITS.carapicuiba;
    const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
    const appUrl = agendaAppUrl(cfg);
    const { data: bb } = await supabase.from("buyback_requests").select("id")
      .eq("owner_phone", onlyDigits(phone)).order("created_at", { ascending: false }).limit(1);
    await supabase.from("agendamentos").insert({
      phone: onlyDigits(phone), nome: p.nome || null, dealership: p.dealership || null,
      unidade: unit.key, unidade_nome: unit.nome, carro: p.carro || null,
      buyback_id: bb?.[0]?.id || null, data: p.data_iso, periodo: slot.periodo, horario: slot.h,
      status: "agendado", source: p.source || "sell",
    });
    await supabase.from("whatsapp_events").update({ parsed: { ...p, step: "done", horario: slot.h } }).eq("id", pend.id);

    await waSendImage(s, phone, `${appUrl}/${unit.foto}`, `📍 ${unit.nome}`);
    const carroTxt = p.carro ? ` do seu ${p.carro}` : "";
    await sendText(phone, `✅ *Agendamento confirmado!*\n\n📅 ${p.data_label} às *${slot.h}*\n📍 *${unit.nome}*\n${unit.endereco}\n🗺️ ${unit.maps}\n\nÉ rapidinho: fazemos a avaliação presencial${carroTxt} e já aproveitamos pra tirar as fotos no estúdio. Se puder, chega uns 10 min antes. 🚗✨\n\nPrecisa remarcar? Só me mandar *AGENDAR*.`);

    // registra o agendamento no CRM (nota/atividade na timeline do lead)
    await pushToTotexgest({
      name: p.nome, phone, utm_campaign: "agendamento",
      subject: `Agendamento — ${unit.curto}`,
      notes: `Agendou avaliação presencial + sessão de fotos.\n📅 ${p.data_label} às ${slot.h}\n📍 ${unit.nome}\n${unit.endereco}` + (p.carro ? `\nVeículo: ${p.carro}` : ""),
      custom: { tipo: "agendamento", unidade: unit.key, unidade_nome: unit.nome, data: p.data_iso, horario: slot.h, periodo: slot.periodo, carro: p.carro || null, loja: p.dealership || null },
    });

    // avisa a loja (best-effort, free-form — só entra se a loja estiver na janela de 24h)
    try {
      if (p.dealership) {
        const { data: dealers } = await supabase.from("users").select("phone")
          .eq("role", "dealer").eq("dealership", p.dealership).not("phone", "is", null).limit(3);
        for (const dp of (dealers || [])) {
          const num = onlyDigits(dp.phone || "");
          if (num) await sendText(num, `📸 *Novo agendamento* — ${unit.curto}\n${p.nome || phone} · ${p.carro || "veículo"}\n📅 ${p.data_label} às ${slot.h}\nContato: ${phone}`);
        }
      }
    } catch { /* fora da janela: aparece só no painel */ }
    return true;
  }
  return false;
}

// ATIVAÇÃO SEM FRICÇÃO: provisiona a conta do visitante do stand (email sintético, SEM senha —
// mesmo padrão da cortesia) e inicia os 30 dias na hora. O trigger handle_new_user já concede 30
// dias (há stand_lead deste telefone); reforçamos explicitamente. Idempotente por email sintético.
async function activateStandTrial(phone: string, name?: string | null): Promise<{ ok: boolean; already?: boolean }> {
  const digits = onlyDigits(phone);
  if (!digits) return { ok: false };
  const email = `${digits}@totexcarfinance.app`;
  try {
    const { data: exist } = await supabase.from("users").select("id").ilike("email", email).limit(1);
    if (exist && exist.length) return { ok: true, already: true };
    const password = crypto.randomUUID().slice(0, 12);
    const { data: created, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: name || "Motorista", phone: digits, email },
    });
    if (error || !created?.user) { console.error("activateStandTrial createUser:", error?.message); return { ok: false }; }
    const trialEnds = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
    await supabase.from("users").update({
      role: "owner", trial_started_at: new Date().toISOString(), trial_ends_at: trialEnds,
      subscription_status: "trial", plan: "free",
    }).eq("id", created.user.id);
    return { ok: true };
  } catch (e) { console.error("activateStandTrial:", e); return { ok: false }; }
}

// ATIVAÇÃO DO BRINDE (botão "Ativar 30 dias" / "sim/ativar") pra QUALQUER visitante que recebeu a
// oferta — inclusive quem veio por #vender (que gera stand_sell, não stand_lead). Antes o único
// caminho de ativação vivia dentro de handleStandFollowup, gated em stand_lead → o botão do #vender
// não fazia nada. Aqui o gate é o próprio stand_gift (criado nos DOIS fluxos ao enviar o presente).
async function handleStandActivate(phone: string, text: string): Promise<boolean> {
  // roda cedo (antes do lookup de usuário), então exige a palavra "ativar" explícita (o botão
  // "Ativar 30 dias grátis" sempre tem) — NÃO captura "sim" solto, pra não sequestrar resposta a
  // outra pergunta. O "sim/quero" mais frouxo continua só no handleStandFollowup (contexto sem agente).
  if (!/\bativar\b/i.test(String(text || ""))) return false;
  const digits = onlyDigits(phone);
  const { count } = await supabase.from("whatsapp_events")
    .select("id", { count: "exact", head: true }).eq("from_phone", digits).eq("kind", "stand_gift");
  if (!count) return false; // só ativa quem realmente recebeu a oferta do presente
  // nome best-effort: pega do stand_sell/stand_lead mais recente
  const { data: ctx } = await supabase.from("whatsapp_events")
    .select("parsed").eq("from_phone", digits).in("kind", ["stand_sell", "stand_lead"])
    .order("created_at", { ascending: false }).limit(1);
  const nome = (ctx?.[0]?.parsed as any)?.nome || null;
  const r = await activateStandTrial(phone, nome);
  await sendText(phone, r.ok
    ? (r.already
      ? `Você já tem seu Co-pilot ativo por aqui 👍 É só me pedir o que precisa: ver carros, avaliar o seu, ou *"quero o painel"* pra cuidar do seu carro. 🚗`
      : `🎉 Pronto! Seus *30 dias grátis* já estão ativos.\n\nAgora é só usar — me pede *"quero o painel"* que eu te mando o acesso pra cadastrar seu carro (sem senha), ou me diz o que procura. 🚗`)
    : "Tive um probleminha pra ativar agora 😕 Tenta de novo em instantes, por favor.");
  return true;
}

// intenção de ATIVAR (botão "Ativar 30 dias" ou texto) — sem confundir com busca de carro
function querAtivar(t: string): boolean {
  const s = String(t || "").toLowerCase().trim();
  if (/ativar/.test(s) && (/\b30\b|dias|gr[aá]tis|copilot|co-pilot/.test(s) || s.length <= 16)) return true;
  if (/^(sim,?\s*quero|quero sim|bora|pode ativar|quero ativar|quero meus?\s*30|quero os?\s*30)[\s!.]*$/.test(s)) return true;
  if (s.replace(/[\s!.]/g, "") === "sim") return true;
  return false;
}

// Detecta "ver mais carros / mais opções" (texto ou toque na lista) pra paginar a vitrine do visitante.
const VER_MAIS_RE = /ver mais|mais carros|mais op[çc][õo]es|mais ve[íi]culos|continuar vendo|mostrar mais/i;

// CONVITE CONTEXTUAL pra COMUNIDADE do WhatsApp (a "escada": grupo pra quem topa; busca 1:1 pra
// quem não). Dispara SÓ nos becos sem saída da vitrine (não achou o carro / acabou o estoque) — o
// momento em que "ver primeiro quando chegar" tem valor real. 1x por telefone (dedup por evento),
// promessa honesta (mudo, 2 posts/dia, sai quando quiser). Link em app_settings.comunidade_link
// (trocável sem deploy; vazio = convite desligado).
async function offerComunidade(phone: string): Promise<void> {
  try {
    const digits = onlyDigits(phone);
    const { data } = await supabase.from("app_settings").select("comunidade_link").eq("id", 1).single();
    const link = String((data as any)?.comunidade_link || "").trim();
    if (!link) return;
    const { count } = await supabase.from("whatsapp_events")
      .select("id", { count: "exact", head: true })
      .eq("from_phone", digits).eq("kind", "comunidade_invite");
    if (count) return;
    await supabase.from("whatsapp_events").insert({ from_phone: digits, kind: "comunidade_invite", status: "sent", raw: {}, parsed: {} });
    await sendText(phone, `👀 Dica: carro bom some em dias — e as ofertas saem *primeiro* na nossa comunidade, antes do anúncio.\n\nSem bagunça: só posts de oportunidade, 2 por dia, e você sai quando quiser 👉 ${link}`);
  } catch (e) { console.error("offerComunidade:", e); }
}

// VITRINE PAGINADA do visitante do stand: mostra 10 carros por vez e oferece "🔎 Ver mais carros"
// enquanto sobrar estoque. O critério (categoria/preço) e o offset ficam no evento stand_lead
// (parsed.vitrine), então o "ver mais" continua exatamente a última busca. Ordenação fixa
// (year_desc) mantém as páginas estáveis entre uma mensagem e outra.
async function standVitrine(
  phone: string, loja: string, leadId: string | null, prevParsed: any,
  opts: { categoria?: string | null; precoMax?: number | null; search?: string | null; more?: boolean; termo?: string | null; _fallback?: boolean },
): Promise<void> {
  const prev = prevParsed?.vitrine || {};
  const categoria = opts.more ? (prev.categoria ?? null) : (opts.categoria ?? null);
  const precoMax = opts.more ? (prev.precoMax ?? null) : (opts.precoMax ?? null);
  const search = opts.more ? (prev.search ?? null) : (opts.search ?? null);
  const offset = opts.more ? Number(prev.offset || 0) : 0;

  const dealershipId = await standScopeId(loja);
  let cars = await mktVehicles({ maxPrice: precoMax || undefined, dealershipId, limit: 60, sort: "year_desc" }).catch(() => [] as any[]);
  if (categoria) cars = cars.filter((c: any) => carClass(c) === categoria);
  if (search) {
    // busca por modelo TOLERANTE a erro de digitação/acento, sobre o estoque da loja
    let matched = cars.filter((c: any) => carMatchesQuery(c, search));
    if (!matched.length) {
      // nada local (pode estar além dos 60) → tenta a busca exata do marketplace como reforço
      const server = await mktVehicles({ search, maxPrice: precoMax || undefined, dealershipId, limit: 60, sort: "year_desc" }).catch(() => [] as any[]);
      matched = categoria ? server.filter((c: any) => carClass(c) === categoria) : server;
    }
    cars = matched;
  }
  const pagina = cars.slice(offset, offset + 10);

  if (!pagina.length) {
    if (offset > 0) {
      await sendText(phone, "Esses são todos que tenho com esse perfil por enquanto 🙂 Me diz outro tipo, modelo ou faixa de preço (ex.: \"SUV até 80 mil\") que eu procuro de novo.");
      await offerComunidade(phone); // "ver primeiro quando chegar" — o momento em que o grupo tem valor
      return;
    }
    // busca específica (modelo/tipo/preço) sem resultado → NÃO deixa no vácuo: avisa e já mostra o que tem
    const termo = opts.termo || search || categoria || (precoMax ? `até ${fmtReais(precoMax)}` : null);
    if (termo && !opts._fallback) {
      await sendText(phone, `Não tenho *${termo}* no estoque agora 😕 Mas dá uma olhada no que tenho disponível 👇`);
      await standVitrine(phone, loja, leadId, { ...(prevParsed || {}), vitrine: {} }, { _fallback: true });
      return;
    }
    await sendText(phone, "Estoque sem novidades nesse momento 😕 Me fala um tipo, modelo ou faixa de preço que eu procuro pra você. 🚗");
    await offerComunidade(phone);
    return;
  }

  // ENTREGA a vitrine PRIMEIRO e só segue se ela realmente saiu — o "ver mais" nunca aparece
  // antes/sem os cards (senão o vendedor vê "ver mais" com a vitrine cortada).
  const enviados = await sendCarShowcase(phone, pagina, null);
  if (!enviados) {
    await sendText(phone, "Deixa eu buscar do jeito certo pra você 🙌 Me diz o que procura — ex.: \"SUV até 80 mil\", \"sedan automático\", \"picape\" — que eu filtro na hora. 🚗");
    return;
  }

  const novoOffset = offset + pagina.length;
  const temMais = cars.length > novoOffset;
  if (leadId) {
    await supabase.from("whatsapp_events")
      .update({ parsed: { ...(prevParsed || {}), vitrine: { categoria, precoMax, search, offset: novoOffset } } })
      .eq("id", leadId);
  }
  // sinalizador de busca: continua vendo ou refina — só oferece "ver mais" se ainda houver estoque
  const s = await getSettings();
  const rows = temMais ? ["🔎 Ver mais carros", "🎯 Nova busca"] : ["🎯 Nova busca"];
  await waSendMenu(
    s, phone,
    temMais ? "Quer ver mais opções? É só tocar 👇 (ou me diga o que procura, ex.: \"sedan até 100 mil\")"
            : "Quer procurar outro perfil? Toque em *Nova busca* ou me diga o tipo/faixa de preço. 🚗",
    rows,
  );
}

// CANAL do WhatsApp: link "#oferta" (geral) ou "#oferta <carroId>" (carro do post). Abre a vitrine
// da rede inteira e RASTREIA a origem (parsed.origem='canal') pro funil do piloto. Reaproveita a
// máquina da vitrine (registra como stand_lead → paginação/"ver mais"/re-engajamento funcionam).
// NÃO dá o brinde de 30 dias (canal ≠ stand físico) — o brinde continua no fechamento do #vender.
const OFERTA_RE = /#oferta(?:\s+([a-z0-9][a-z0-9-]{5,}))?/i;
async function handleCanalOferta(phone: string, text: string, contactName?: string): Promise<boolean> {
  const m = String(text || "").match(OFERTA_RE);
  if (!m) return false;
  let carroId = (m[1] || "").trim().toLowerCase() || null;
  // token curto do link bonito (/o/<code>) → resolve pro id real do carro (ids do marketplace têm 20+ chars)
  if (carroId && carroId.length <= 10) {
    const { data: ln } = await supabase.from("oferta_links").select("car_id").eq("code", carroId).maybeSingle();
    if (ln?.car_id) carroId = ln.car_id;
  }
  try {
    const parsed = { loja: "geral", promotor: "canal", origem: "canal", carro: carroId, nome: contactName || null };
    const { data: leadRow } = await supabase.from("whatsapp_events").insert({
      from_phone: phone, kind: "stand_lead", status: "processed", raw: { text }, parsed,
    }).select("id").single();
    const leadId = (leadRow as any)?.id || null;
    const nome = contactName ? `, ${contactName.split(" ")[0]}` : "";
    await sendText(phone, `Opa${nome}! 👋 Que bom que veio do nosso canal. Já te mostro os carros — desliza pro lado e toca em *Ver carro* no que curtir. Ou me diz o que procura (ex.: "SUV até 80 mil", "Strada"). 🚗`);
    if (carroId) {
      try {
        const res = await fetch(`${MARKETPLACE_URL}/api/vehicles/${encodeURIComponent(carroId)}`, { headers: { Accept: "application/json" } });
        if (res.ok) {
          const v = await res.json();
          const img = carImg(v);
          if (img) {
            const sHl = await getSettings();
            const mediaId = (await imageMediaId(sHl, img)) || undefined;
            const titulo = [v.brand, v.model, v.version].filter(Boolean).join(" ");
            const preco = v.price != null ? `R$ ${Number(v.price).toLocaleString("pt-BR")}` : "consulte";
            if (mediaId) await waSendImage(sHl, phone, img, `⭐ *${titulo}* ${v.year || ""}\n${preco}\n\nEste é o do canal — fotos e ficha completa: ${MARKETPLACE_URL}/veiculo/${v.id}`, mediaId);
          }
        }
      } catch { /* segue pra vitrine */ }
    }
    await standVitrine(phone, "geral", leadId, parsed, {});
    return true;
  } catch (e) { console.error("handleCanalOferta:", e); return true; }
}

async function handleStandLead(phone: string, text: string, contactName?: string): Promise<boolean> {
  const m = String(text || "").match(STAND_RE);
  if (!m) return false;
  const loja = (m[1] || "geral").toLowerCase();
  let promotor = (m[2] || "").toLowerCase() || null;
  let carroId = m[3] || null;
  // QR por carro sem promotor ("#stand geral <id>"): o id cai no 2º token — desambigua pelo tamanho
  if (!carroId && promotor && promotor.length >= 16) { carroId = promotor; promotor = null; }
  try {
    // o lead é gravado ANTES de responder — mesmo se o envio falhar, a atribuição fica
    const { data: leadRow } = await supabase.from("whatsapp_events").insert({
      from_phone: phone, kind: "stand_lead", status: "processed",
      raw: { text }, parsed: { loja, promotor, carro: carroId, nome: contactName || null },
    }).select("id").single();
    const leadId = (leadRow as any)?.id || null;
    await sendText(phone, `Que bom te ver por aqui${contactName ? `, ${contactName.split(" ")[0]}` : ""}! 👋 Sou o Co-pilot da Totex Motors. Já te mostro a vitrine — desliza pro lado e toca em *Ver carro* no que curtir.\n\nMe diz o que você procura (ex.: "SUV até 80 mil", "picape automática") que eu filtro na hora. 🚗`);
    // o carro do QR (exposto no stand) vai primeiro, com destaque
    if (carroId) {
      try {
        const res = await fetch(`${MARKETPLACE_URL}/api/vehicles/${encodeURIComponent(carroId)}`, { headers: { Accept: "application/json" } });
        if (res.ok) {
          const v = await res.json();
          const img = carImg(v);
          if (img) {
            const sHl = await getSettings();
            const mediaId = (await imageMediaId(sHl, img)) || undefined; // sempre via media id (MIME correto)
            const titulo = [v.brand, v.model, v.version].filter(Boolean).join(" ");
            const preco = v.price != null ? `R$ ${Number(v.price).toLocaleString("pt-BR")}` : "consulte";
            if (mediaId) await waSendImage(sHl, phone, img,
              `⭐ *${titulo}* ${v.year || ""}\n${preco}\n\nEste é o que você viu no stand — fotos e ficha completa: ${MARKETPLACE_URL}/veiculo/${v.id}`, mediaId);
          }
        }
      } catch { /* segue pra vitrine */ }
    }
    // vitrine paginada (mostra 10 + "🔎 Ver mais carros" enquanto sobrar estoque)
    await standVitrine(phone, loja, leadId, { loja, promotor, carro: carroId, nome: contactName || null }, {});
    // presente: 30 dias grátis + como ativar (logo depois da vitrine)
    const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
    const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
    await sendStandGift(phone, appUrl);
    return true;
  } catch (e) { console.error("handleStandLead:", e); return true; } // código presente = já tratamos
}

// Visitante do stand SEM cadastro continuando a conversa: o agente completo exige usuário, mas
// matar o papo com "cadastre-se" no meio do shopping perde a venda. Busca leve por categoria e
// faixa de preço mantém a vitrine viva; o convite pro app vai junto, sem bloquear.
// ---- BUSCA TOLERANTE (nomenclatura/erro de digitação) ----
// normaliza p/ comparar: minúsculas, sem acento, só alfanumérico
function normCar(s: string): string {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
// distância de edição (Levenshtein) — tolera erro de digitação ("mustange" ~ "mustang")
function levDist(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
// o carro casa a busca? por token, tolerando acento e erro de digitação (limiar cresce com o tamanho)
function carMatchesQuery(car: any, term: string): boolean {
  const hay = normCar([car?.brand, car?.model, car?.version].filter(Boolean).join(" ")).split(" ").filter(Boolean);
  const qs = normCar(term).split(" ").filter(Boolean);
  if (!qs.length) return true;
  return qs.every((q) => {
    if (q.length < 3) return hay.includes(q);
    return hay.some((h) => {
      if (h.includes(q) || q.includes(h)) return true;
      const thr = q.length >= 6 ? 2 : 1; // "mustang"(7) tolera 2; palavras curtas, 1
      return levDist(h, q) <= thr;
    });
  });
}

// interpreta uma busca livre de carro: tipo (SUV/sedan/…), faixa de preço e MODELO/marca (texto livre).
function parseCarQuery(text: string): { categoria: string | null; precoMax: number | null; search: string | null; termo: string } {
  const raw = String(text || "").trim();
  const t = raw.toLowerCase();
  const categoria = normCategoria(t);
  let precoMax: number | null = null;
  const mMil = t.match(/(\d{1,3})\s*mil/);
  const mNum = t.replace(/\./g, "").match(/\b(\d{5,7})\b/);
  if (mMil) precoMax = Number(mMil[1]) * 1000;
  else if (mNum) precoMax = Number(mNum[1]);
  // termo de busca livre (modelo/marca) = texto sem tipo, preço e conectores
  let search: string | null = raw
    .replace(/at[ée]\s*r?\$?\s*\d[\d.\s]*mil?/gi, " ")
    .replace(/\d[\d.]*\s*mil/gi, " ")
    .replace(/\br?\$?\s*\d{4,7}\b/gi, " ")
    .replace(/\b(suv|sedan|sed[aã]|hatch|picape|pick-?up|caminhonete|utilit[aá]rio)s?\b/gi, " ")
    .replace(/\b(at[ée]|de|com|carro|carros|autom[aá]tico|manual|quero|ver|um|uma|uns|por favor|tem|tenho|voc[eê]s?)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (search && search.length < 2) search = null;
  return { categoria, precoMax, search, termo: raw.replace(/\s+/g, " ").trim() };
}

// "Ver mais carros" / "Nova busca" da vitrine do stand — funciona pra QUALQUER um (usuário ou não).
// Antes a paginação só existia dentro de handleStandFollowup (só p/ não-cadastrado), então quem já
// virou usuário tocava "Ver mais carros" e caía no agente em vez de vir a próxima página.
async function handleStandVerMais(phone: string, text: string): Promise<boolean> {
  const t = String(text || "").toLowerCase();
  const verMais = VER_MAIS_RE.test(t);
  const novaBusca = /nova busca|🎯/.test(t);
  if (!verMais && !novaBusca) return false;
  const desde = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const { data } = await supabase.from("whatsapp_events")
    .select("id, parsed").eq("from_phone", onlyDigits(phone))
    .in("kind", ["stand_lead", "stand_sell", "stand_gift"])
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(5);
  // pega o evento mais recente que tenha uma vitrine em andamento (offset); senão o mais recente
  const ev = (data || []).find((e) => (e.parsed as any)?.vitrine) || (data || [])[0];
  if (!ev) return false; // sem contexto de stand → deixa outro handler tratar
  const parsed = (ev.parsed as any) || {};
  const loja = String(parsed?.loja || "geral").toLowerCase();
  if (novaBusca && !verMais) {
    // arma o PRÓXIMO texto como busca (modelo/tipo/preço) — assim "Mustang" vira busca direta, não agente
    await supabase.from("whatsapp_events")
      .update({ parsed: { ...parsed, vitrine: { ...(parsed.vitrine || {}), awaiting: true, offset: 0 } } }).eq("id", ev.id);
    await sendText(phone, 'Fechou! Me diz o *tipo*, o *modelo* ou a *faixa de preço* — ex.: "SUV até 80 mil", "Mustang", "picape". 🚗');
    return true;
  }
  await standVitrine(phone, loja, ev.id, parsed, { more: true });
  return true;
}

// Busca direta na vitrine do stand: dispara quando o visitante acabou de tocar "Nova busca" (flag
// awaiting) e mandou o critério. Entende MODELO ("Mustang"), tipo e preço, busca no estoque da loja
// e já manda os cards — se não tiver o específico, avisa e mostra o que tem. Vale p/ usuário E não.
async function handleStandSearch(phone: string, text: string): Promise<boolean> {
  const digits = onlyDigits(phone);
  const desde = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const { data } = await supabase.from("whatsapp_events")
    .select("id, parsed").eq("from_phone", digits)
    .in("kind", ["stand_lead", "stand_sell", "stand_gift"])
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(5);
  const ev = (data || []).find((e) => (e.parsed as any)?.vitrine?.awaiting);
  if (!ev) return false; // ninguém esperando critério → deixa o fluxo normal (agente/followup)
  const parsed = (ev.parsed as any) || {};
  const loja = String(parsed?.loja || "geral").toLowerCase();
  // consome o one-shot antes de buscar (evita loop se a busca falhar)
  await supabase.from("whatsapp_events")
    .update({ parsed: { ...parsed, vitrine: { ...(parsed.vitrine || {}), awaiting: false } } }).eq("id", ev.id);
  const q = parseCarQuery(text);
  await standVitrine(phone, loja, ev.id, parsed, { categoria: q.categoria, precoMax: q.precoMax, search: q.search, termo: q.termo });
  return true;
}

async function handleStandFollowup(phone: string, text: string): Promise<boolean> {
  // reconhece o visitante que VOLTA: além do #stand (stand_lead), também #vender (stand_sell) e quem
  // recebeu o brinde (stand_gift). Janela de 30 dias. Isso resolve o re-scan: o WhatsApp muitas vezes
  // NÃO repõe o texto pré-preenchido (#vender/#stand) numa conversa que já existe, então a pessoa
  // manda qualquer coisa — aqui a gente re-engaja (vitrine / vender / ativar) em vez de dar "cadastre-se".
  const desde = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  const { data: lead } = await supabase.from("whatsapp_events")
    .select("id, parsed").eq("from_phone", phone).in("kind", ["stand_lead", "stand_sell", "stand_gift"])
    .gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
  if (!lead?.length) return false;
  const leadId = (lead[0] as any)?.id || null;
  const leadParsed = (lead[0].parsed as any) || {};
  const loja = String(leadParsed?.loja || "geral").toLowerCase();
  const t = String(text || "").toLowerCase();

  // "Ver mais carros" (toque na lista ou texto) → próxima página da última busca
  if (VER_MAIS_RE.test(t)) {
    await standVitrine(phone, loja, leadId, leadParsed, { more: true });
    return true;
  }

  // re-entra no fluxo de VENDER se a pessoa voltou querendo vender (o QR #vender não repôs o texto)
  if (isRecompraQuery(t)) {
    await sendText(phone, "Boa! Vender seu carro com a gente é rápido. 🚗 Me diz a marca, o modelo e o ano que eu já pego a referência de tabela.");
    await abrirAvaliacaoFlow(phone);
    return true;
  }

  // ATIVAR OS 30 DIAS na hora (botão "Ativar 30 dias" ou "sim/ativar"): provisiona a conta e libera
  if (querAtivar(t)) {
    const nome = (lead[0].parsed as any)?.nome || null;
    const r = await activateStandTrial(phone, nome);
    if (r.ok) {
      await sendText(phone, r.already
        ? `Você já tem seu Co-pilot ativo por aqui 👍 Me diz o que precisa: ver mais carros, ou cuidar do SEU carro (é só pedir *"quero o painel"* que eu te mando o acesso). 🚗`
        : `🎉 Pronto! Seus *30 dias grátis* já estão ativos.\n\nAgora é só usar:\n• Quer ver mais carros? Me diz o que procura (ex.: "SUV até 100 mil").\n• Quer que eu cuide do SEU carro — gasto, revisão, IPVA, quanto vale? Me pede *"quero o painel"* que eu te mando o acesso pra cadastrar ele (sem senha). 🚗`);
    } else {
      await sendText(phone, "Tive um probleminha pra ativar agora 😕 Tenta de novo em instantes, por favor.");
    }
    return true;
  }

  const q = parseCarQuery(text); // entende tipo, preço E modelo/marca ("Mustang")
  const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
  const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
  // rede de segurança: garante que o visitante saiba do presente de 30 dias (dedup 1x)
  await sendStandGift(phone, appUrl);
  if (!q.categoria && !q.precoMax && !q.search) {
    await sendText(phone, `Posso te mostrar carros por tipo, modelo ou faixa de preço — ex.: "SUV até 80 mil", "Mustang", "picape". 🚗\n\nPra atendimento completo (avaliar seu carro na troca, financiamento, test drive), toca em *Ver carro* num card que a loja te atende.`);
    return true;
  }
  // vitrine paginada com o critério informado (reseta o offset e guarda a busca pro "ver mais")
  await standVitrine(phone, loja, leadId, leadParsed, { categoria: q.categoria, precoMax: q.precoMax, search: q.search, termo: q.termo });
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  _settings = null; // recarrega configs a cada requisição

  const url = new URL(req.url);

  // API OFICIAL (Meta): ao cadastrar a URL do webhook no BM, o Meta manda um GET com hub.challenge
  if (req.method === "GET") {
    const s = await getSettings();
    const verify = metaVerifyChallenge(url, s);
    if (verify) return verify;
    return new Response("ok", { status: 200, headers: cors });
  }

  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401, headers: cors });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  // Detecta o formato: Cloud API oficial (object=whatsapp_business_account) ou Uazapi
  const metaMsg = parseMetaInbound(body);
  if (metaMsg?.statusOnly) {
    // eventos de status (sent/delivered/read/FAILED) da API oficial — loga falha de entrega com o motivo
    try {
      const st = body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
      if (st && (st.status === "failed" || st.errors)) {
        console.error("META DELIVERY FAIL:", JSON.stringify({ to: st.recipient_id, status: st.status, errors: st.errors }));
        await supabase.from("whatsapp_events").insert({
          from_phone: String(st.recipient_id || ""), kind: "status_fail", raw: st,
          status: "error", error: JSON.stringify(st.errors || []).slice(0, 900),
        });
      }
    } catch { /* */ }
    return new Response(JSON.stringify({ ok: true, status_event: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
  // Guarda de número: se o evento for de OUTRO número da mesma WABA (ex.: o do CRM TotexGest),
  // ignora — este webhook só atende o número do Co-pilot (meta_wa_phone_id do /admin).
  if (metaMsg && metaMsg.phoneNumberId) {
    const s = await getSettings();
    if (s.meta_wa_phone_id && metaMsg.phoneNumberId !== String(s.meta_wa_phone_id)) {
      return new Response(JSON.stringify({ ok: true, ignored: "outro_numero" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
  const msg: any = metaMsg ?? parseInbound(body);

  if (msg.fromMe || !msg.phone) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  // DEDUP por wamid: o Meta REENVIA o webhook se a resposta demorar — sem isso, a mesma mensagem
  // era processada 2x e o usuário recebia respostas repetidas.
  const { data: evt, error: insErr } = await supabase
    .from("whatsapp_events")
    .insert({ from_phone: msg.phone, kind: msg.kind, raw: body, status: "received", wa_message_id: msg.messageid || null })
    .select("id, created_at")
    .single();
  if (insErr) {
    if ((insErr as any).code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    console.error("insert whatsapp_events:", insErr.message);
  }
  const eventId = evt?.id;
  const eventAt = evt?.created_at || new Date().toISOString();

  // CTWA: se a mensagem veio de um anúncio (referral), registra o lead e identifica o carro.
  // Roda uma vez por mensagem (depois do dedup), sem bloquear a resposta 200.
  if (metaMsg?.referral) {
    const ctwaWork = handleCtwaReferral(msg);
    const wu2 = (globalThis as any).EdgeRuntime?.waitUntil;
    if (wu2) wu2(ctwaWork.catch((e: any) => console.error("ctwa bg:", e)));
    else await ctwaWork;
  }

  // Responde 200 JÁ e processa em BACKGROUND (IA leva 5-20s; com o debounce, mais) —
  // segura o Meta sem timeout/retry. Fora do EdgeRuntime (testes locais), processa inline.
  const work = processInbound(msg, eventId, eventAt);
  const wu = (globalThis as any).EdgeRuntime?.waitUntil;
  if (wu) wu(work.catch((e: any) => console.error("bg:", e)));
  else await work;
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
});

async function processInbound(msg: any, eventId: any, eventAt: string) {
  try {
    // DEBOUNCE de mensagens picadas: texto digitado (não botão/menu/flow) espera um instante;
    // se chegar mensagem mais nova do mesmo número, esta fica guardada e é AGRUPADA na resposta
    // da última — em vez de responder 2x "Como posso ajudar?" pra frases quebradas em várias linhas.
    let earlierTexts = "";
    if (msg.kind === "text" && !msg.flowReply && !msg.isMenuReply && eventId) {
      await new Promise((r) => setTimeout(r, 8000));
      const { data: newer } = await supabase.from("whatsapp_events")
        .select("id").eq("from_phone", msg.phone).gt("created_at", eventAt)
        .not("kind", "in", "(status_evt,status_fail)").limit(1);
      if (newer && newer.length) {
        await supabase.from("whatsapp_events").update({ status: "superseded", parsed: { input: msg.text } }).eq("id", eventId);
        return; // a mensagem mais nova responde por todas
      }
      const { data: prev } = await supabase.from("whatsapp_events")
        .select("id, parsed").eq("from_phone", msg.phone).eq("status", "superseded")
        .gte("created_at", new Date(Date.now() - 120000).toISOString())
        .order("created_at", { ascending: true }).limit(5);
      const partsPrev = (prev || []).map((p: any) => String(p.parsed?.input || "")).filter(Boolean);
      if (partsPrev.length) {
        earlierTexts = partsPrev.join("\n");
        await supabase.from("whatsapp_events").update({ status: "aggregated" })
          .in("id", (prev || []).map((p: any) => p.id));
      }
    }

    // Respostas de FORMULÁRIO (WhatsApp Flows) — antes de tudo, funcionam p/ não-usuário
    if (msg.flowReply) {
      // Garagem Totex (interesse num carro do estoque)
      if (await handleGaragemFlowReply(msg.phone, msg.flowReply)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "garagem_flow", carro: msg.flowReply.titulo } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, garagem_flow: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Radar de Serviços (escolheu um estabelecimento → manda os contatos no chat)
      if (await handleRadarFlowReply(msg.phone, msg.flowReply)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "radar_flow", lugar: msg.flowReply.titulo } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, radar_flow: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Modo Viagem (formulário preenchido → plano montado e enviado no chat)
      if (await handleViagemFlowReply(msg.phone, msg.flowReply)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "viagem_flow", destino: msg.flowReply.destino } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, viagem_flow: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Recompra FIPE ao vivo (endpoint dinâmico)
      if (await handleRecompraFlowReply(msg.phone, msg.flowReply)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "recompra_flow", carro: `${msg.flowReply.marca_nome || ""} ${msg.flowReply.modelo_nome || ""}` } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, recompra_flow: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Pesquisa NPS
      if (await handleNpsFlowReply(msg.phone, msg.flowReply)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "nps_flow", nota: msg.flowReply.nota } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, nps_flow: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    // Pós-venda (antes do cadastro, funciona p/ quem ainda não é usuário):
    if (msg.kind !== "image") {
      const psText = msg.text || msg.transcription || "";
      // QR "#vender" do stand — vendedor quer vender: abre a avaliação FIPE
      if (await handleStandSell(msg.phone, psText, msg.contactName)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "stand_sell" } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, stand_sell: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // escolha da MODALIDADE (Express/Vitrine/Me ajuda) depois da avaliação FIPE
      if (await handleSellModalidade(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "sell_modalidade", input: psText } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, sell_modalidade: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // escolha do PRAZO (Venda Vitrine — até 20/45/90 dias)
      if (await handleSellPrazo(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "sell_prazo", input: psText } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, sell_prazo: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // AGENDAMENTO da avaliação presencial + sessão de fotos (oferta → unidade → dia → horário)
      if (await handleAgenda(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "agenda", input: psText } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, agenda: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // ATIVAR o brinde de 30 dias (botão/"sim") — funciona pra quem veio por #stand OU #vender
      // (gate = stand_gift). Antes só ativava quem tinha stand_lead, então o #vender ficava sem brinde.
      if (await handleStandActivate(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "stand_activate" } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, stand_activate: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // "Ver mais carros" / "Nova busca" da vitrine do stand — vale p/ usuário E não-usuário
      if (await handleStandVerMais(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "stand_vermais" } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, stand_vermais: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // critério de busca logo após "Nova busca" (modelo/tipo/preço) → cards diretos, sem passar pelo agente
      if (await handleStandSearch(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "stand_search", input: psText } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, stand_search: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // CANAL do WhatsApp — link "#oferta" nos posts (rastreado como origem=canal)
      if (await handleCanalOferta(msg.phone, psText, msg.contactName)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "canal_oferta", input: psText } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, canal_oferta: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // QR do stand físico (shopping) — código #stand na mensagem pré-preenchida
      if (await handleStandLead(msg.phone, psText, msg.contactName)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "stand_qr" } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, stand: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // resposta de NPS (número 0–10)
      if (await handlePostsaleNps(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "nps" } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, nps: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // consulta de transferência/documentação
      if (await handlePostsaleTransfer(msg.phone, psText)) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "transferencia" } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, transfer: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    const user = await findUserByPhone(msg.phone);
    if (!user) {
      // Visitante do STAND (shopping) sem cadastro: mantém a conversa viva com busca leve
      // por categoria/preço em vez do "cadastre-se" seco (o lead #stand tem até 7 dias).
      if (msg.kind !== "image" && await handleStandFollowup(msg.phone, msg.text || msg.transcription || "")) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "stand_followup", input: msg.text } }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true, stand_followup: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // Mesma proteção do aviso de paywall (abaixo): sem cooldown, um número
      // desconhecido com auto-resposta vira ping-pong infinito e queima o
      // número na Meta. Aqui não dá pra usar notification_log (não há user_id),
      // então a janela é medida pelos próprios eventos: se já respondemos a
      // este telefone nas últimas 24h, não respondemos de novo.
      const desde24h = new Date(Date.now() - 24 * 3600_000).toISOString();
      const { count: jaRespondido } = await supabase
        .from("whatsapp_events")
        .select("id", { count: "exact", head: true })
        .eq("from_phone", msg.phone).eq("status", "ignored").gte("created_at", desde24h);

      if (!jaRespondido) {
        await sendText(msg.phone, "Olá! 👋 Sou o TotexCar Co-pilot. Não encontrei seu cadastro — cadastre-se no app e use o mesmo número de WhatsApp para cuidar do seu carro por aqui.");
      }
      if (eventId) {
        await supabase.from("whatsapp_events").update({
          status: "ignored",
          error: jaRespondido ? "user_not_found (ja respondido nas ultimas 24h)" : "user_not_found",
        }).eq("id", eventId);
      }
      return new Response(JSON.stringify({ ok: true, respondido: !jaRespondido }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // PROATIVO: qualquer resposta do usuário zera o contador de proativas sem resposta
    // (alimenta o throttling do compositor — MODULO-PROATIVO §7). Fire-and-forget.
    if (Number((user as any).proactive_unanswered) > 0) {
      const rst = supabase.from("users").update({ proactive_unanswered: 0 }).eq("id", user.id);
      (globalThis as any).EdgeRuntime?.waitUntil?.(rst) ?? rst.then(() => {}, () => {});
    }

    if (accessBlocked(user)) {
      // COOLDOWN DO AVISO DE PAYWALL — no máximo 1x por dia por usuário.
      // Antes, TODA mensagem de quem está inativo disparava uma resposta. Com
      // auto-respondedor do outro lado isso vira ping-pong infinito: em
      // 2026-07-18 um número gerou 2.524 mensagens em 20h (124/hora), e nós
      // respondemos todas — caminho curto pra Meta sinalizar/banir o número.
      // A dedup é ATÔMICA: grava primeiro no notification_log (índice único
      // user_id+kind+due_date); só envia se a gravação passou. Se o insert der
      // conflito, alguém já avisou hoje e a gente cala a boca.
      const hoje = new Date().toISOString().slice(0, 10);
      const { error: dedupErr } = await supabase.from("notification_log").insert({
        user_id: user.id, kind: "paywall_aviso", due_date: hoje,
        channel: "whatsapp", sent_at: new Date().toISOString(),
      });
      const jaAvisadoHoje = !!dedupErr; // conflito no índice único = já mandamos

      if (!jaAvisadoHoje) {
        const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
        const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
        await sendText(msg.phone, `🔒 Seu acesso ao TotexCar Co-pilot está inativo.\n\nPra voltar a cuidar do seu carro por aqui, é só assinar (a partir de R$ 10,99/mês):\n${appUrl}/plans\n\nAssim que o pagamento for confirmado, eu volto a funcionar automaticamente. 🚗`);
      }

      if (eventId) {
        await supabase.from("whatsapp_events").update({
          status: "blocked",
          error: jaAvisadoHoje ? "subscription_inactive (aviso ja enviado hoje)" : "subscription_inactive",
          user_id: user.id,
        }).eq("id", eventId);
      }
      return new Response(JSON.stringify({ ok: true, blocked: true, avisado: !jaAvisadoHoje }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // "🖥️ Quero o painel" no menu SÓ para conta provisionada pela loja (cortesia/bônus: email
    // sintético, sem senha própria — o link mágico é o único jeito de entrar). Quem se cadastrou
    // sozinho tem senha e não vê a opção (pode pedir por texto se quiser).
    const provisioned = String(user.email || "").toLowerCase().endsWith("@totexcarfinance.app");
    const quickActions = provisioned ? QUICK_ACTIONS : QUICK_ACTIONS.filter((a) => a !== PAINEL_LABEL);

    // KIT DE BOAS-VINDAS (PDF): cliente com cortesia da loja que ainda não recebeu o guia recebe
    // na 1ª resposta — aqui a janela de 24h está aberta, então vai como documento livre (sem
    // template). Cobre o caso do template boas_vindas_cortesia_pdf ainda não aprovado na Meta.
    // Fire-and-forget: não atrasa a resposta do agente.
    if (provisioned) {
      const kitJob = (async () => {
        try {
          const { count: jaTem } = await supabase.from("whatsapp_events")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id).eq("kind", "kit_pdf");
          if (jaTem) return;
          const { count: patrocinado } = await supabase.from("postsale_journeys")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id).eq("sponsored", true);
          if (!patrocinado) return;
          // grava ANTES de enviar (dedup: retry do webhook não manda 2x)
          await supabase.from("whatsapp_events").insert({
            from_phone: msg.phone, user_id: user.id, kind: "kit_pdf", status: "sent",
            raw: { via: "webhook_primeira_resposta" }, parsed: {},
          });
          const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
          const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
          await waSendDocument(await getSettings(), msg.phone,
            await kitUrlFor(appUrl, user.dealership), KIT_FILENAME,
            "🎁 Seu guia de boas-vindas: tudo o que eu faço pelo seu carro, em 7 páginas rápidas.");
        } catch (e) { console.error("kit boas-vindas:", e); }
      })();
      (globalThis as any).EdgeRuntime?.waitUntil?.(kitJob) ?? kitJob.catch(() => {});
    }

    const { data: vehicles } = await supabase
      .from("accounts").select("*").eq("user_id", user.id).eq("is_active", true).limit(1);
    const vehicle = vehicles && vehicles.length ? vehicles[0] : null;

    // Ficha técnica do carro (concierge): usa se já existe; se não, gera em background p/ a próxima vez
    let fichaStr = "";
    if (vehicle?.ficha_tecnica) {
      fichaStr = JSON.stringify(vehicle.ficha_tecnica);
    } else if (vehicle && (vehicle.marca || vehicle.modelo)) {
      try {
        const gen = supabase.functions.invoke("car-spec", { body: { account_id: vehicle.id } });
        (globalThis as any).EdgeRuntime?.waitUntil?.(gen) ?? gen.catch(() => {});
      } catch { /* melhor esforço; o app também gera no cadastro */ }
    }

    // Consumo oficial (INMETRO/PBE via Auto Data): mesmo padrão — usa cache ou gera em background
    let consumoOficialStr = "";
    const co = (vehicle as any)?.consumo_oficial;
    if (co && !co.nao_encontrado) {
      consumoOficialStr = JSON.stringify(co);
    } else if (!co && vehicle && (vehicle.marca || vehicle.modelo)) {
      try {
        const gen = supabase.functions.invoke("car-consumo", { body: { account_id: vehicle.id } });
        (globalThis as any).EdgeRuntime?.waitUntil?.(gen) ?? gen.catch(() => {});
      } catch { /* melhor esforço */ }
    }

    const snapshot = await buildSnapshot(user.id, vehicle);
    const { data: cats } = await supabase.from("categories").select("name, type");
    const despesas = (cats || []).filter((c: any) => c.type === "expense").map((c: any) => c.name);
    const receitas = (cats || []).filter((c: any) => c.type === "income").map((c: any) => c.name);

    // memória curta: últimas trocas desta conversa (p/ correções tipo "o valor exato é 101")
    let historico = "";
    try {
      const { data: hist } = await supabase.from("whatsapp_events")
        .select("kind, raw, parsed, created_at")
        .eq("user_id", user.id).eq("status", "processed")
        .order("created_at", { ascending: false }).limit(4);
      historico = (hist || []).reverse().map((h: any) => {
        // parsed.input inclui a TRANSCRIÇÃO de áudios (senão o valor dito por voz some da memória)
        const um = h.parsed?.input || h.raw?.message?.text || h.raw?.message?.caption ||
          (h.kind === "image" ? "[enviou uma foto]" : h.kind === "audio" ? "[enviou um áudio]" : "");
        const resp = h.parsed?.reply || "";
        return `Usuário: ${String(um).slice(0, 150)}\nVocê: ${String(resp).slice(0, 200)}`;
      }).join("\n");
    } catch { /* */ }

    // memória LONGA: dossiê do dono (user_memory) + open loops — o "ele me conhece" do agente
    let dossie = "";
    try {
      const d = await loadDossier(supabase, user.id);
      const temMem = d.memorias && d.memorias !== "(vazio)";
      const temLoops = d.loopsRaw.length > 0;
      if (temMem || temLoops) {
        dossie = `DOSSIÊ DO DONO (fatos/padrões/preferências aprendidos — use com naturalidade, no máx. 1 referência por resposta; NUNCA recite a lista):\n${temMem ? d.memorias : "(vazio)"}\n` +
          (temLoops ? `PENDÊNCIAS EM ABERTO do dono (se ele tocar no assunto ou disser que resolveu, reconheça — ex.: "boa, tirou essa da lista!"):\n${d.loops}\n` : "");
      }
    } catch { /* dossiê é opcional — nunca trava a resposta */ }

    // SELO TOTEX (Fase 4): a seção só entra no prompt pra cliente de loja parceira ADERIDA —
    // os demais nem ficam sabendo do programa (regra do dono; o score deles acumula em silêncio).
    let seloPrompt = "";
    try {
      if (await seloElegivel(supabase, user)) {
        seloPrompt = `\nSELO TOTEX (seu histórico vale dinheiro — benefício da loja parceira dele): o usuário participa do programa. Cada cupom com hodômetro, revisão e cuidado comprovado vira ponto; o Score define o Selo (Bronze/Prata/Ouro) e o Selo define a garantia MÍNIMA de recompra na loja dele (82%/85%/87% da FIPE, teto 90% — a oferta final é da loja, após vistoria presencial). Regras de copy: NUNCA prometa 90% fixo ("até 90%, conforme seu Selo e a vistoria"); ao registrar abastecimento com foto+km, quando fizer sentido mencione em 1 linha que isso constrói o Selo (sem repetir toda hora — vira ruído). "Quanto vale meu cuidado/meu selo/pontos?" → use care_statement e responda em FAIXA/R$, nunca só pontos. Selo atual do usuário: ${String(user.care_tier || "none")}.\n`;
      }
    } catch { /* sem selo no prompt em caso de erro */ }

    const today = new Date().toISOString().split("T")[0];
    const { data: appCfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
    const appUrl = (appCfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
    const system = `Você é o **TotexCar Co-pilot**, o assistente de IA do carro do usuário (ecossistema Totexmotors). Responda SEMPRE em português do Brasil, curto e amigável, no máximo 1 emoji.

ESCOPO (regra INVIOLÁVEL): você é o copiloto do CARRO — só conversa sobre o mundo do carro e do ecossistema Totexmotors: gastos/receitas do carro, combustível e consumo, manutenção e revisões, multas e CNH, financiamento/boletos, documentos (IPVA, licenciamento, seguro), viagem DE CARRO (rota, pedágio, e dentro do plano também hospedagem/restaurantes do destino), Garagem/troca/recompra/Selo, Radar de Serviços, Indique e Ganhe, planos e suporte do produto. FORA DISSO (receitas de cozinha, dever de casa, política, futebol, saúde, textos genéricos, qualquer pedido sem relação com carro/ecossistema): NÃO atenda — recuse com simpatia em 1 frase e traga o papo de volta ("Aí você me pegou 😄 sou copiloto de CARRO! Mas se precisar de algo do seu carro, tô aqui — quer ver seus gastos do mês?"). Sem sermão, sem se desculpar demais, UMA recusa curta. Cumprimentos e conversa social breve ("bom dia", "tudo bem?") são bem-vindos — responda com calor humano e naturalidade, sem virar assistente de assuntos gerais.

CONTINUIDADE E TOM (regra de ouro do papo): a conversa é CONTÍNUA — olhe a CONVERSA RECENTE antes de responder. NUNCA se reapresente nem repita "Como posso te ajudar hoje?" se já houve troca recente; isso soa robótico. Mensagem curta de continuação ("ok", "valeu", "boa noite", "👍") merece resposta curta e natural no mesmo tom ("Tamo junto! 🚗", "Boa noite! Qualquer coisa é só chamar"), sem relançar ofertas de ajuda. Se vier a MESMA pergunta/botão de novo, não repita a resposta igual: confirme em 1 linha ("Como te falei, está tudo em dia 😉") ou acrescente algo novo. Se a mensagem tiver várias frases picadas, responda TUDO numa resposta só. Fale como um parceiro de verdade: leve, direto, gente como a gente — nunca formal demais, nunca script de telemarketing.

TIPOS DE MENSAGEM (identifique pela foto/texto):
- GASTO/RECEITA do carro (texto, foto de cupom/nota, áudio) → use registrar_gasto. Em COMBUSTÍVEL, leia e informe os LITROS.
- Foto do HODÔMETRO (painel mostrando a quilometragem) → use atualizar_hodometro com o km lido. ⚠️ LEIA TODOS OS DÍGITOS do odômetro (geralmente 5 ou 6 dígitos, ex.: 87452). Se houver um dígito decimal/décimos destacado, ignore só ele. NUNCA leia apenas os primeiros dígitos.
- CORREÇÃO logo após um registro (ex.: "o valor exato é 101", "foram 30 litros") → use corrigir_ultimo_gasto. NUNCA registre de novo.
- Foto de MULTA / auto de infração → siga o fluxo de MULTAS abaixo.
- PRINT da tela de GANHOS de aplicativo (Uber/99/inDriver mostram "Ganhos" com período e valor) → use registrar_receita (leia o app, o período e o VALOR TOTAL do print).
- Foto de BOLETO de parcela do financiamento → leia a LINHA DIGITÁVEL COMPLETA (todos os dígitos) e use salvar_boleto. NÃO registre boleto de financiamento como gasto.
- PDF de CARNÊ do financiamento (os bancos enviam o carnê digital com TODOS os boletos) → extraia o número e a LINHA DIGITÁVEL COMPLETA de CADA parcela e use salvar_carne (todas de uma vez). Confirme quantas parcelas salvou e explique que os lembretes de vencimento sairão com o boleto certo de cada mês, automaticamente.
- ARQUIVOZAP (cofre de documentos): SEMPRE que a foto/PDF for um DOCUMENTO que vale guardar (multa, IPVA, boleto, CRLV/CRV documento do carro, CNH, nota fiscal, apólice de seguro, manual, comprovante), chame TAMBÉM arquivar_documento — ALÉM da ação principal (ex.: registrar_multa + arquivar_documento). É automático pro usuário: nunca peça pra ele "guardar". NÃO arquive hodômetro, print de ganhos de app, foto de carro à venda, selfie ou paisagem. Quando ele pedir "cadê meu X / me manda o boleto/CRLV / meus documentos", use buscar_documento (eu envio os arquivos).

FINANCIAMENTO/BOLETO: cada parcela tem um boleto PRÓPRIO emitido pelo banco — NUNCA invente, derive ou "calcule" código de barras/linha digitável (seria um boleto inválido). Pedirem o boleto/código de barras → use boleto_parcela e envie a linha digitável salva em bloco copiável, dizendo de qual parcela é. Se não houver linha salva (ou for de parcela anterior), explique com naturalidade e peça a FOTO do boleto do mês (ou o número), que você salva com salvar_boleto — e avise que a linha vai junto no lembrete de vencimento.

REGRA DE OURO DO REGISTRO: se a mensagem JÁ TEM o valor em R$ (ex.: "500 de diesel no posto Shell"), chame registrar_gasto IMEDIATAMENTE com esse valor — NUNCA pergunte litros/km antes de registrar. Litros e km que faltarem: peça DEPOIS e complete com corrigir_ultimo_gasto quando o usuário responder. NUNCA chame registrar_gasto com amount=0 — se não souber o valor, pergunte primeiro. Recupere valores ditos em mensagens anteriores pela CONVERSA RECENTE.

CONSUMO (regra importante): para medir o consumo eu preciso do km a cada abastecimento. SEMPRE que registrar um COMBUSTÍVEL sem o km (a ferramenta retorna pedir_hodometro=true), PEÇA uma FOTO DO HODÔMETRO (ou o km digitado) e explique que é assim que eu meço o consumo. Faça o mesmo em manutenções/revisões (ex.: troca de óleo).
APRESENTAÇÃO DO CONSUMO (sempre simples, litros vs km): "Você rodou X km e usou Y litros → Z km/L". Se houver média e custo: acrescente "Média: W km/L · combustível custa R$ V por km rodado". Nada de jargão.
CUSTO DO CARRO: para "quanto meu carro custa?", "custo por km", "quanto gasto por mês" → use custo_por_km (retorna custo/km, custo/mês e pra onde vai o dinheiro). Pro MOTORISTA DE APP, deixe claro que esse é o custo que come o ganho — cruze com lucro_periodo quando fizer sentido. É custo real gasto; ainda não inclui depreciação.
CONSUMO OFICIAL (INMETRO/PBE): ${consumoOficialStr ? `dados oficiais do carro do dono: ${consumoOficialStr}. Quando fizer sentido, COMPARE o consumo REAL dele (consumo_medio) com o oficial: se o real estiver bem abaixo do oficial, sugira causas (calibragem dos pneus, filtro de ar, trânsito, ar-condicionado, pé pesado); se estiver em linha ou acima, elogie. Se o carro for FLEX e ele abastecer com etanol, lembre que é normal render menos km/L que a referência de gasolina. Cite que é dado oficial (INMETRO), com naturalidade.` : "ainda não disponível para este carro (buscando)."}

MULTAS: se a foto for um auto de infração/notificação:
1) EXTRAIA: órgão autuador, nº do auto, data/hora, local, enquadramento (art. do CTB/código), valor, pontos, placa, prazo de defesa/recurso e, se for radar, nº do equipamento e data de aferição.
2) CRUZE com o CHECKLIST LEGAL de vícios processuais (falhas padronizadas na lei brasileira):
   a. PRAZO DA NOTIFICAÇÃO — Art. 281, parágrafo único, II do CTB: a notificação da AUTUAÇÃO deve ser expedida em até 30 DIAS da infração; fora disso o auto deve ser ARQUIVADO (insubsistente). PERGUNTE quando o usuário recebeu a notificação e compare com a data da infração.
   b. DADOS OBRIGATÓRIOS — Resolução CONTRAN 918/2022: divergência ou ausência de placa/marca/modelo/cor, local, data/hora, enquadramento, identificação do órgão/agente = vício formal do auto.
   c. DUPLA NOTIFICAÇÃO — Arts. 280 a 282 do CTB: são obrigatórias DUAS notificações (a da autuação e depois a da penalidade). Se o usuário recebeu só a cobrança/penalidade direto, é vício. PERGUNTE se recebeu as duas.
   d. RADAR/EQUIPAMENTO — Resolução CONTRAN 798/2020 + INMETRO: o medidor de velocidade precisa de aferição válida do INMETRO (verificação anual) e o auto deve identificar o equipamento. Se não consta, aponte e oriente a exigir o certificado de aferição na defesa.
   e. SINALIZAÇÃO IRREGULAR: fiscalização de velocidade exige sinalização visível ANTES do equipamento; ausência/insuficiência é defesa. PERGUNTE se havia placa de velocidade no trecho.
   f. Também: competência do órgão para a via (municipal/estadual/federal), erro de enquadramento e dupla penalização pela mesma infração.
3) Se faltar informação-chave pro checklist (data de recebimento da notificação, se recebeu as duas, radar fixo/móvel, sinalização), FAÇA 2–3 perguntas curtas ao usuário ANTES de fechar a análise — as respostas fortalecem o recurso. Se ele não souber, siga com o que tem.
4) Estime a chance (baixa/media/alta) com HONESTIDADE — NUNCA prometa que a multa "vai cair". Gere a MINUTA de recurso (defesa prévia) citando os artigos/resoluções do checklist que se aplicarem e chame registrar_multa (com recurso_texto, prazo_recurso e chance). Envie um resumo + o texto do recurso, deixando claro que é um MODELO e a decisão é do órgão. Avise o prazo.
PONTOS DA CNH: para "quantos pontos eu tenho?", "vou perder a CNH?", "tô perto de suspender?" → use pontos_cnh (soma dos últimos 12 meses das multas + limite de suspensão do CTB). Depois de registrar uma multa nova COM pontos, vale mencionar o total atualizado e, se estiver perto do limite, alertar com cuidado (sem alarmismo). Deixe claro que conta só as multas registradas aqui.

Categorias de gasto: ${despesas.join(", ")}. Categorias de receita: ${receitas.join(", ")}. Use is_new_category=true só se nenhuma existente servir.

CALENDÁRIO DO CARRO: para "o que vence?", "tá tudo em dia?", "próxima revisão", "o que tenho pra pagar?" → use meu_calendario. Apresente em ordem de data, com dias restantes ("IPVA em 12 dias — R$ 1.850"). Revisões projetadas por km: deixe claro que é projeção pelo ritmo de uso DELE ("mantendo seus ~40 km/dia, o óleo vence ~12/09"). Se estiver tudo em dia por 60+ dias, diga isso de forma leve e ofereça no máximo 1 cuidado preventivo. NUNCA invente data nem valor — veio da ferramenta ou não existe.

${seloPrompt}
MODO INDICADOR (motorista PRO como indicador da loja): se o motorista pedir carro/estoque PARA OUTRA PESSOA — "meu passageiro quer um Argo", "tem SUV até 80 mil? é pra um cliente", "manda o Onix pra eu mostrar pra um amigo" — use buscar_carros normalmente (por voz ou texto). As fotos que você envia JÁ saem com o link rastreado DELE (Indique e Ganhe). Depois de enviar, oriente em 1 linha: "é só tocar em ENCAMINHAR na foto e mandar pro seu passageiro — se rolar negócio pelo link, sua indicação fica registrada e você ganha a comissão". Se ele pedir pra VOCÊ mandar mensagem direto pro número do passageiro, explique com naturalidade que não fazemos contato com quem não falou com a gente primeiro (proteção do canal) — encaminhar a foto é mais rápido e, vindo dele, o passageiro confia mais. Incentive sem exagero: motorista PRO é um parceiro de vendas das lojas do ecossistema.

RELATÓRIO FISCAL (PRO): para "relatório", "IR", "imposto de renda", "MEI", "carnê-leão", "extrato pra contador" → use relatorio_fiscal (default: mês anterior fechado; "do ano"/"declaração" → anual). O PDF é enviado automaticamente na conversa; você só resume (lucro + R$/km) e diz que serve de base pro contador. NUNCA dê conselho fiscal definitivo — "sou seu copiloto, não seu contador; ele confirma os enquadramentos".

MOTORISTA PRO (TotexCar Co-pilot PRO): MODO PRO do usuário: ${user.driver_mode ? "ATIVO" : "inativo"}. Se ativo, trate o carro como NEGÓCIO: registre ganhos (registrar_receita) além dos gastos, e responda "quanto sobrou?" com lucro_periodo (receita − despesa, lucro por km). Na PRIMEIRA receita registrada, dê boas-vindas ao Modo PRO e explique o resumo semanal. Se alguém sem Modo PRO mandar print de ganhos, registre normalmente (o modo ativa sozinho).

SEU CARRO — CONCIERGE TÉCNICO DO DONO: você é o concierge automotivo PESSOAL deste dono e conhece o carro DELE a fundo. ${fichaStr ? `FICHA TÉCNICA do carro (use como FONTE DA VERDADE): ${fichaStr}` : "A ficha técnica deste carro ainda está sendo montada — se perguntarem especificação, dê uma faixa honesta e diga que vai confirmar."} Cruze a ficha com os DADOS REAIS do dono (hodômetro, consumo calculado, gastos, próximas manutenções por km) pra dar dicas ESPECÍFICAS: qual óleo/pneu/vela e quando trocar, intervalo de revisão, o que fazer neste km, economia de combustível, e compare o consumo REAL com o esperado da ficha (ex.: "seu consumo tá abaixo do normal desse motor — pode ser calibragem/filtro"). Para elétrico/híbrido: cuidados de bateria (carga 20–80%), regeneração, autonomia. ⚠️ REGRA DE OURO: NUNCA invente número exato de óleo/pneu/torque/intervalo — use a ficha; se o dado não estiver nela, dê uma FAIXA e mande confirmar no manual do proprietário ou concessionária. Segurança e o bolso do dono em 1º lugar; seja proativo e didático.

GARAGEM TOTEX (concierge automotivo): você TAMBÉM é o concierge de carros do ecossistema Totexmotors — entende profundamente de carros (versões, motores, consumo, confiabilidade, custo de manutenção, revenda) e tem acesso ao ESTOQUE REAL das lojas via ferramentas. FILOSOFIA: a recomendação é guiada pelo DESEJO do dono, NÃO pelo preço do carro atual. O carro dele pode já ser ótimo — então NUNCA empurre "upgrade" só porque dá. Fluxo quando falar em comprar/trocar/procurar carro:
(1) ENTENDA O DESEJO PRIMEIRO — MAS SÓ SE ELE NÃO DEU CRITÉRIO. Se ele NOMEOU um modelo/marca ou perguntou "tem X?" ("tem Mustang?", "quero um Onix", "tem picape até 90 mil?"), NÃO pergunte NADA — chame buscar_carros JÁ (modelo no campo busca, tipo no campo categoria) e responda com o resultado. No WhatsApp a pessoa quer velocidade. Só faça 1–2 perguntas curtas quando ele NÃO deu nenhum critério ("quero trocar de carro", "me ajuda a escolher"). Se a busca voltar VAZIA, seja direto: "não tenho <o que ele pediu> no estoque agora" — NUNCA mostre outros carros como se fossem a resposta (no máximo ofereça um radar ou pergunte se topa ver algo parecido).
(2) Só DEPOIS de entender, use buscar_carros com os critérios DELE e recomende 2–3 opções explicando o PORQUÊ de cada uma pro que ELE pediu, sempre com o link. ⚠️ Se ele pedir por TIPO de carroceria ("um SUV", "uma picape", "um sedan", "um hatch"), passe no campo "categoria" da ferramenta — NUNCA escreva SUV/sedan no campo "busca" (a categoria é filtrada pela nossa classificação; texto livre traria carro errado).
(3) oportunidades_carros é só um EXTRA opcional ("se quiser, tenho umas ideias na sua faixa também") — nunca a resposta principal, nunca sozinha, e nunca enquadrada como "você deveria trocar".
(4) se o desejo dele não estiver no estoque, ofereça criar_radar ("te aviso quando aparecer").
Se o dono disser que está satisfeito com o carro, respeite: elogie a escolha e só ajude a comprar se ELE quiser. Perguntas gerais de carro ("Corolla ou Civic?", "esse motor é bom?") responda como especialista honesto sobre prós e contras, conectando ao estoque quando fizer sentido.
FOTOS: quando você usa buscar_carros/oportunidades_carros, as FOTOS dos carros são enviadas AUTOMATICAMENTE ao usuário aqui no WhatsApp (retorno fotos_enviadas). Ao comentar, soe como GENTE num papo de WhatsApp, não como catálogo: texto corrido e curto (2-3 linhas), SEM lista numerada, SEM negrito de título, SEM adjetivo de propaganda ("ótimo custo-benefício", "muito confiável", "completo") — em vez disso, um detalhe REAL e honesto ligado ao uso da pessoa. Comente 1 ou 2 que mais combinam, não todos. Sem repetir preço/link (já estão nos cards). NUNCA mande o usuário "ir no app/site ver as opções": tudo acontece aqui no WhatsApp.
VENDER/AVALIAR O CARRO DO DONO: se ele quiser vender/avaliar/saber quanto vale o carro DELE, isso abre um formulário de Recompra FIPE aqui mesmo (já é automático) — NUNCA responda "vá até a Garagem no app". Se precisar, é só dizer que ele pode avaliar por aqui.

RADAR DE SERVIÇOS (achar oficina/borracharia/guincho/chaveiro/bateria): a busca leva ~8 segundos, então SEMPRE avise antes ("Deixa eu procurar aqui pra você, 1 minutinho…") na MESMA mensagem em que decide buscar — nunca deixe o motorista no vácuo achando que travou. Use quando ele precisar de um serviço no carro — "preciso trocar a bateria", "onde conserto o freio", "furei o pneu", "meu carro não pega", "quanto custa revisão" — use buscar_servico. REGRAS: (1) PESQUISAR é livre — NUNCA peça autorização pra procurar ou pra mostrar dado público; só faça. (2) Se não souber onde ele está, pergunte a cidade/bairro em UMA linha e só então busque. (3) Apresente 3 a 6 opções curtas com o porquê de cada uma; marque quem é PARCEIRO TOTEX e deixe claro que o resto é resultado público (a confirmar direto com o estabelecimento — a Totex não credencia nem garante). (4) NUNCA invente preço, disponibilidade, garantia, distância ou tempo de chegada: o que não veio na busca é "não informado" — e diga isso sem rodeio. (5) Não ordene por interesse comercial; parceiro ganha selo, não posição. (6) Só chame pedir_orcamento DEPOIS de listar quais dados serão compartilhados e ele autorizar explicitamente. Se ele disser "pesquisa mas não passa meu telefone", pesquise e ofereça só os links pra ELE iniciar o contato.
SEGURANÇA (vem antes de preço, sempre): se o carro estiver parado na via, em acostamento, com fumaça, cheiro de combustível, superaquecendo, sem freio ou após colisão — PRIMEIRO confirme se há feridos e se ele está em local seguro (fora da pista, atrás da barreira, triângulo posto). Só depois procure serviço, com emergency=true. NUNCA diga que é seguro seguir viagem sem inspeção; NUNCA oriente mexer em bateria de alta tensão ou cabo laranja (híbrido/elétrico); NUNCA ensine a desativar item de segurança. Não dê diagnóstico definitivo sem inspeção — trabalhe com hipóteses e diga o grau de incerteza.
MODO VIAGEM (parceiro de estrada): quando o assunto for viagem, road trip, feriado, férias, "quanto gasto pra ir até X" ou o botão "🏖️ Planejar viagem" → use planejar_viagem. Se ele só tocou no botão (sem destino), pergunte em 1 linha pra onde pensa em ir (ou ofereça sugerir destinos) ANTES de chamar a ferramenta e monte o plano com os DADOS REAIS do carro dele: combustível calculado com o consumo/custo por km REAL (mostre a conta de forma simples, ida e volta), estimativa honesta de pedágio, roteiro com paradas, e — MUITO importante — se houver manutenção vencendo, recomende resolver ANTES de pegar estrada (sugira a loja dele, se tiver; isso é cuidado, não venda). Sem destino definido? Sugira 2-3 destinos em alta conforme o perfil (família/casal/EV). Hospedagem e comida: a ferramenta traz PESQUISA AO VIVO (onde_ficar_e_comer) — indique só o que veio nela, nunca invente estabelecimento ou preço. Esse é um DIFERENCIAL nosso: nenhum app de viagem conhece o carro da pessoa — nós conhecemos.

SUPORTE: você TAMBÉM é o suporte oficial. Dúvidas de uso, planos e pagamento, responda com esta base: teste grátis 7 dias (sem cartão); plano Totex Care R$ 109,90/mês; membro do ecossistema (cupom da loja) R$ 10,99/mês; plano ANUAL R$ 109,90 à vista — 12 meses pelo preço de 10 (~17% off); pagamento PIX/cartão (Asaas) em /plans; acesso bloqueado = assinar em /plans (libera na hora); consumo só aparece a partir do 2º abastecimento com foto do hodômetro; recurso de multa é MODELO (decisão é do órgão). ⚠️ NUNCA diga "sem fidelidade" ou "cancele quando quiser". O que você NÃO resolver (pagamento não liberado, reembolso/cancelamento, bug, reclamação séria, pedido de humano) → use abrir_chamado (o dono é notificado e retorna). Sugestões de melhoria → abrir_chamado com assunto "Sugestão".

TRANSFERÊNCIA / DOCUMENTAÇÃO DO CARRO: se perguntarem da transferência de propriedade, documentação, CRLV, "meu documento", garantia da loja ou revisão agendada → use status_transferencia (dados REAIS do pós-venda da loja). NUNCA responda com passo a passo genérico de DETRAN sem consultar a ferramenta — a loja é quem conduz o processo do cliente.

ACESSO / COMO USAR (ancore-se AQUI — nunca invente): o jeito PRINCIPAL de usar o TotexCar Co-pilot é AQUI no WhatsApp — o dono te manda foto de cupom, áudio ou pergunta, e você resolve. A conta dele JÁ está ativa; ele NÃO precisa criar login nem senha pra usar por aqui. Existe TAMBÉM um painel web em ${appUrl} — abre no NAVEGADOR (celular ou computador) e pode ser "adicionado à tela inicial" pra virar um atalho parecido com app (é um PWA). ⚠️ NÃO EXISTE aplicativo na Play Store nem na App Store, e "Totexmotors" é o MARKETPLACE de carros (site diferente) — NUNCA mande o dono baixar/procurar app em loja de aplicativos, nem procurar "Totexmotors". Se ele perguntar como acessar/entrar no painel/app/site, ou pedir pra logar, chame link_acesso (gera e envia um link SEGURO de uso único que já loga, sem senha). Se tiver dúvida sobre acesso, NÃO invente: mande o link ${appUrl} ou use abrir_chamado.

Regras: depois de registrar algo, confirme em 1 frase. Se faltar o valor, peça. Não invente dados nem funcionalidades — use as ferramentas; se não souber, diga que vai verificar (abrir_chamado) em vez de chutar. Rastreamento por GPS NÃO é um recurso do produto — se pedirem localização do carro, explique com naturalidade que o Co-pilot não rastreia o veículo.

Hoje é ${today}.
${historico ? `CONVERSA RECENTE (para contexto e correções):\n${historico}\n` : ""}
${dossie}RESUMO DO USUÁRIO (respostas rápidas; use ferramentas p/ o resto):
${JSON.stringify(snapshot)}`;

    // monta as partes normalizadas (texto/imagem)
    const parts: any[] = [];
    let inputText = msg.text || msg.transcription || "";
    // mensagens picadas agrupadas pelo debounce viram UMA entrada só (uma resposta única e natural)
    if (earlierTexts) inputText = `${earlierTexts}\n${inputText}`.trim();
    // COMANDOS "/" (recurso nativo do WhatsApp) → frase natural que a IA/atalhos entendem
    const CMD_MAP: Record<string, string> = {
      "/gastos": "Quais foram meus gastos do mês?",
      "/consumo": "Qual o consumo e o custo por km do meu carro?",
      "/manutencao": "Quais as próximas manutenções por km?",
      "/garagem": GARAGEM_LABEL,
      "/radar": RADAR_LABEL,
      "/oficina": RADAR_LABEL,
      "/viagem": VIAGEM_LABEL,
      "/multas": "Quais minhas multas e recursos?",
      "/painel": PAINEL_LABEL,
      "/suporte": "Preciso falar com o suporte",
    };
    const cmdKey = inputText.trim().toLowerCase().split(/\s/)[0];
    if (CMD_MAP[cmdKey]) inputText = CMD_MAP[cmdKey];

    // BOTÕES DAS PROATIVAS (quick replies dos templates copilot_msg*): o rótulo é fixo
    // ("Sim, quero" etc.) e sozinho não diz do que se trata — embrulha com o contexto da
    // última proativa enviada (≤72h) pra IA saber o que o usuário está aceitando/recusando.
    const PROATIVE_BTNS = ["sim, quero", "agora não", "já resolvi", "me ajuda", "ver agora", "depois"];
    if (PROATIVE_BTNS.includes(inputText.trim().toLowerCase())) {
      try {
        const desde = new Date(Date.now() - 72 * 3600_000).toISOString();
        const { data: pro } = await supabase.from("whatsapp_events")
          .select("parsed").eq("user_id", user.id).eq("kind", "proativo")
          .gte("created_at", desde).order("created_at", { ascending: false }).limit(1);
        const ptxt = pro?.[0]?.parsed?.texto;
        if (ptxt) inputText = `[O usuário tocou no botão "${inputText.trim()}" respondendo à sua mensagem proativa: "${String(ptxt).slice(0, 300)}"] — aja de acordo (se aceitou, execute; se recusou/adiou, confirme em 1 linha sem insistir).`;
      } catch { /* sem contexto, segue como texto normal */ }
    }
    if (msg.kind === "image") {
      let img: { data: string; media_type: string } | null = null;
      if (msg.provider === "meta") {
        img = await metaDownloadMedia(await getSettings(), msg.mediaId);
      } else if (msg.base64) {
        img = { data: msg.base64, media_type: msg.mimetype || "image/jpeg" };
      } else {
        const creds = await uazapiCreds();
        img = await downloadUazapiMedia(msg.baseUrl || creds.url, msg.token || creds.token, msg.content, msg.messageid);
        if (!img && msg.mediaUrl) img = await fetchImageBase64(msg.mediaUrl); // fallback
      }
      if (img) parts.push({ kind: "image", media_type: img.media_type, data: img.data });
      else {
        await sendText(msg.phone, "Recebi sua imagem 📷 mas não consegui abrir. Pode reenviar ou me mandar por texto?");
        if (eventId) await supabase.from("whatsapp_events").update({ status: "need_info", error: "download_falhou" }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!inputText) inputText = "Analise esta foto: pode ser um cupom/nota de gasto, uma multa (auto de infração), o hodômetro do painel, um print da tela de ganhos de aplicativo (Uber/99) ou um DOCUMENTO pra guardar (CRLV/documento do carro, CNH, boleto, IPVA, nota fiscal, apólice de seguro, manual). Aja conforme o tipo — e se for um documento que vale guardar, chame arquivar_documento.";
    }
    if (msg.kind === "audio" && !inputText) {
      let audio: { data: string; media_type: string } | null = null;
      if (msg.provider === "meta") {
        audio = await metaDownloadMedia(await getSettings(), msg.mediaId);
      } else if (msg.base64) {
        audio = { data: msg.base64, media_type: msg.mimetype || "audio/ogg" };
      } else {
        const creds = await uazapiCreds();
        audio = await downloadUazapiMedia(msg.baseUrl || creds.url, msg.token || creds.token, msg.content, msg.messageid, "audio");
      }
      if (audio?.data) {
        try { inputText = await transcribeAudio(audio.data, audio.media_type); } catch (e) { console.error("Transcrição de áudio falhou:", e); }
      }
      if (!inputText) {
        await sendText(msg.phone, "Recebi seu áudio 🎙️ mas não consegui transcrever. Pode mandar como texto ou foto?");
        if (eventId) await supabase.from("whatsapp_events").update({ status: "need_info", error: "transcricao_falhou" }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
    }

    if (msg.kind === "pdf") {
      // PDF (ex.: carnê digital do banco com todos os boletos) — vai direto pra IA (os 3 provedores aceitam PDF)
      let pdf: { data: string; media_type: string } | null = null;
      if (msg.provider === "meta") {
        pdf = await metaDownloadMedia(await getSettings(), msg.mediaId);
      } else if (msg.base64) {
        pdf = { data: msg.base64, media_type: "application/pdf" };
      } else {
        const creds = await uazapiCreds();
        pdf = await downloadUazapiMedia(msg.baseUrl || creds.url, msg.token || creds.token, msg.content, msg.messageid, "document");
      }
      if (!pdf?.data) {
        await sendText(msg.phone, "Recebi seu PDF 📄 mas não consegui abri-lo. Pode reenviar? Se preferir, mande fotos das páginas.");
        if (eventId) await supabase.from("whatsapp_events").update({ status: "need_info", error: "pdf_download_falhou" }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (pdf.data.length > 8_000_000) { // ~6MB de PDF
        await sendText(msg.phone, "Esse PDF é grande demais pra eu processar 😅 Pode mandar fotos das páginas, ou um PDF menor?");
        if (eventId) await supabase.from("whatsapp_events").update({ status: "need_info", error: "pdf_grande" }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      parts.push({ kind: "pdf", data: pdf.data });
      if (!inputText) inputText = "Analise este PDF. Se for um carnê/boletos de financiamento, extraia TODAS as parcelas (número e linha digitável completa de cada) e salve com salvar_carne. Se for um DOCUMENTO pra guardar (boleto avulso, IPVA, apólice de seguro, nota fiscal, CRLV, manual), chame arquivar_documento.";
    }

    // MENU INTELIGENTE: a lista de ações só acompanha a resposta na 1ª conversa em 12h+ ou quando
    // o usuário pede ("menu"/"ajuda"/"opções"). No meio do papo, resposta limpa (menos robótico) —
    // os atalhos permanentes ficam nos comandos de barra e nos ice breakers do número.
    let showMenu = /\b(menu|ajuda|op[çc][õo]es)\b/i.test(inputText);
    if (!showMenu && eventId) {
      const { data: prevEvt } = await supabase.from("whatsapp_events")
        .select("created_at").eq("from_phone", msg.phone)
        .lt("created_at", eventAt)
        .not("kind", "in", "(status_evt,status_fail)")
        .order("created_at", { ascending: false }).limit(1);
      const lastAt = prevEvt?.[0]?.created_at ? Date.parse(prevEvt[0].created_at) : 0;
      showMenu = !lastAt || (Date.now() - lastAt) > 12 * 3600 * 1000;
    }
    const reply = (text: string) =>
      showMenu ? sendMenu(msg.phone, text, quickActions, "Toque numa ação ou mande um gasto 🚗") : sendText(msg.phone, text);

    // "/" sozinho (comando nativo sem escolha): mostra o menu como ajuda
    if (inputText.trim() === "/") {
      await sendMenu(msg.phone, "É só escolher uma opção 👇 ou me mandar sua dúvida/um gasto que eu resolvo. 🚗", quickActions, "Toque numa ação");
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "menu_barra" }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Atalho: avaliar/vender o próprio carro → FLOW da Recompra FIPE (avalia dentro do WhatsApp)
    if (msg.kind !== "image" && isRecompraQuery(inputText)) {
      const sR = await getSettings();
      await waSendFlow(sR, msg.phone, {
        header: "Avalie seu carro 🚗",
        body: "Receba uma proposta de compra da loja parceira pro seu carro em segundos — tudo aqui no WhatsApp, sem compromisso.",
        cta: "Avaliar meu carro",
        flowId: RECOMPRA_FLOW_ID,
        token: "recompra",
        fallbackText: "Pra avaliar seu carro, me diga a marca, o modelo e o ano que eu já preparo a proposta da loja. 🚗",
      });
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "recompra_flow_cta" }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Atalho: opção "Garagem Totex" (menu ou pedido direto) → FLOW com o ESTOQUE AO VIVO.
    // Cliente de loja vê só o estoque da loja dele (token garagem:{dealershipId}); demais veem tudo.
    if (msg.kind !== "image" && isGaragemQuery(inputText)) {
      const sGar = await getSettings();
      let token = "garagem";
      try {
        const did = await garagemDealerId(user.dealership);
        if (did) token = `garagem:${did}`;
      } catch { /* estoque geral */ }
      await waSendFlow(sGar, msg.phone, {
        header: "Garagem Totex 🚗",
        body: "Seu próximo carro te espera! Busque no estoque ao vivo, veja preço e detalhes sem sair do WhatsApp. Curtiu algum? Toque em Tenho interesse que a loja te chama.",
        cta: "Ver carros",
        flowId: GARAGEM_FLOW_ID,
        token,
        fallbackText: `${GARAGEM_LABEL} — veja os carros disponíveis:\n${GARAGEM_URL}`,
      });
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "garagem" }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Atalho: precisa de SERVIÇO no carro → FLOW do Radar (busca dentro do WhatsApp).
    // Sem RADAR_FLOW_ID publicado, NÃO manda formulário quebrado: deixa a IA usar a
    // tool buscar_servico e responder em texto (mesmo resultado, sem a tela bonita).
    if (msg.kind !== "image" && RADAR_FLOW_ID && isRadarQuery(inputText)) {
      const sRad = await getSettings();
      const fallbackRadar = "Me diga qual serviço você precisa (oficina, pneu, bateria, guincho…) e em que cidade/bairro você está, que eu procuro pra você. 🔎";
      const okFlow = await waSendFlow(sRad, msg.phone, {
        header: "Radar de Serviços 🔎",
        body: "Me diga o que seu carro precisa e onde você está. Eu procuro oficina, borracharia, guincho ou chaveiro perto de você, comparo avaliação e distância, e você escolhe.",
        cta: "Procurar serviço",
        flowId: RADAR_FLOW_ID,
        token: `radar:${user.id}`,
        fallbackText: fallbackRadar,
      });
      // NUNCA silêncio: se a Meta rejeitar o flow, responde em texto (a IA assume dali)
      if (!okFlow) await waSendText(sRad, msg.phone, fallbackRadar);
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "radar_flow_cta", flow_ok: okFlow }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Atalho: planejar viagem → FLOW do Modo Viagem (formulário; o PLANO volta no chat,
    // porque a pesquisa de rota + composição pela IA passa MUITO do timeout do endpoint).
    if (msg.kind !== "image" && VIAGEM_FLOW_ID && isViagemQuery(inputText)) {
      const sVia = await getSettings();
      const fallbackViagem = "Pra onde você quer viajar? Me diga o destino que eu monto o plano com o consumo real do seu carro. 🏖️";
      // ⚠️ modo_viagem é formulário PURO (sem endpoint): precisa de flow_action NAVIGATE com a
      // tela inicial ("VIAGEM"). Sem o screen, o waSendFlow manda data_exchange e a Meta REJEITA
      // (foi a causa do silêncio nos testes de 23-24/07).
      // dados dinâmicos do formulário (o flow JSON lê ${data.*}): opções dos dropdowns +
      // carro do usuário no topo + cidade como origem pré-preenchida
      const { data: vVia } = await supabase.from("accounts")
        .select("marca, modelo, cidade, uf").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      const carroLabel = vVia?.marca || vVia?.modelo
        ? `🚗 Seu ${[vVia.marca, vVia.modelo].filter(Boolean).join(" ")} — vou usar o consumo REAL dele no cálculo.`
        : "🚗 Vou usar o consumo real do seu carro no cálculo.";
      const okFlow = await waSendFlow(sVia, msg.phone, {
        header: "Modo Viagem 🏖️",
        body: "Vou montar seu plano de viagem com o consumo REAL do seu carro: combustível, pedágio, balsa, onde ficar e onde comer. Só me diga pra onde você vai.",
        cta: "Planejar viagem",
        flowId: VIAGEM_FLOW_ID,
        token: `viagem:${user.id}`,
        screen: "VIAGEM",
        data: {
          carro: carroLabel,
          origem_padrao: vVia?.cidade ? [vVia.cidade, vVia.uf].filter(Boolean).join(" - ") : "",
          duracoes: [
            { id: "2", title: "Bate e volta / 2 dias" },
            { id: "3", title: "Fim de semana (3 dias)" },
            { id: "5", title: "Até 5 dias" },
            { id: "7", title: "1 semana" },
            { id: "10", title: "Mais de 1 semana" },
          ],
          perfis: [
            { id: "familia", title: "👨‍👩‍👧 Família" },
            { id: "casal", title: "💑 Casal" },
            { id: "amigos", title: "🎉 Amigos" },
            { id: "sozinho", title: "🧳 Sozinho(a)" },
            { id: "pet", title: "🐶 Com pet" },
            { id: "carro_novo", title: "✨ Primeira viagem com o carro novo" },
          ],
        },
        fallbackText: fallbackViagem,
      });
      if (!okFlow) await waSendText(sVia, msg.phone, fallbackViagem);
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "viagem_flow_cta", flow_ok: okFlow }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Atalho (pós-transcrição): transferência/documentação por ÁUDIO também cai no checklist REAL —
    // a checagem lá do topo usa msg.text e roda ANTES da transcrição, então áudio passava reto e a IA respondia genérico.
    if (msg.kind !== "image" && await handlePostsaleTransfer(msg.phone, inputText)) {
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "transferencia", input: inputText }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true, transfer: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Atalho: opção "Quero o painel" do menu (ou pedido direto) → link mágico de acesso, SEM IA.
    // Fica DEPOIS do accessBlocked: premium vencido (fim do ano cortesia) não recebe link, recebe a cobrança.
    if (msg.kind !== "image" && /quero (o )?painel|link de acesso|acessar o painel|entrar no painel/i.test(inputText)) {
      const r: any = await dispatchTool("link_acesso", {}, { user, vehicle, today, inputText });
      if (r?.ok) {
        if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "link_acesso", input: inputText, reply: "[link de acesso enviado]" }, user_id: user.id }).eq("id", eventId);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }
      // se falhar, deixa cair no fluxo da IA (que explica/tenta pela tool)
    }

    parts.push({ kind: "text", text: inputText || "(sem conteúdo)" });

    const aiConfig = await getAIConfig();
    // ctx nomeado: os handlers marcam ctx.shownCars quando mostram a vitrine, e o motor de
    // intenção lê isso depois pra não mandar oferta repetida.
    const ctx: ToolCtx = { user, vehicle, today, inputText };
    let replyText = "";
    try {
      replyText = await runAgent(aiConfig, system, parts, ctx);
    } catch (e) {
      console.error("runAgent erro:", e);
    }
    if (!replyText) replyText = "Recebi sua mensagem! Pode detalhar um pouco mais pra eu te ajudar? 🙂";

    await reply(replyText);
    // guarda também o input (inclui transcrição de áudio) — a memória da conversa depende disso
    if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { reply: replyText, input: inputText }, user_id: user.id }).eq("id", eventId);

    // ARQUIVOZAP: se a IA marcou a mídia como documento (arquivar_documento / registrar_multa),
    // guarda o original em background — sem atrasar a resposta que o usuário já recebeu.
    if (ctx.archive) {
      const mp: any = parts.find((p: any) => p.kind === "image" || p.kind === "pdf");
      if (mp?.data) {
        const media = { data: mp.data, mime: mp.kind === "pdf" ? "application/pdf" : (mp.media_type || "image/jpeg"), kind: mp.kind };
        const av = archiveDoc(msg.phone, user.id, media, ctx.archive);
        (globalThis as any).EdgeRuntime?.waitUntil?.(av) ?? av.catch(() => {});
      }
    }

    // EXTRATOR DE MEMÓRIA (proativo IA): atualiza dossiê + open loops em background, modelo barato.
    // Nunca bloqueia nem quebra a conversa (runExtractor engole os próprios erros).
    try {
      const ext = runExtractor(supabase, aiConfig, user.id, inputText, replyText);
      (globalThis as any).EdgeRuntime?.waitUntil?.(ext) ?? ext.catch(() => {});
    } catch { /* */ }

    // MOTOR DE INTENÇÃO: se o usuário demonstrou querer comprar/trocar por um carro específico,
    // cria em silêncio o radar (car_radar source=auto). Sem escuta ambiente: só o que ele mesmo
    // mandou pro Co-pilot. Se o carro JÁ está no estoque agora, manda a oferta na sequência
    // (momento de ouro) — MAS só se o agente não tiver acabado de mostrar carros nesta conversa
    // (senão seria oferta repetida). Se não tem no estoque, o cron avisa quando entrar.
    // Fire-and-forget: nunca bloqueia a resposta.
    try {
      const ci = (async () => {
        const intent = await detectCarIntent(supabase, aiConfig, user.id, inputText);
        if (intent && !ctx.shownCars) await maybeInstantOffer(user, intent);
      })();
      (globalThis as any).EdgeRuntime?.waitUntil?.(ci) ?? ci.catch(() => {});
    } catch { /* */ }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no processamento:", e);
    if (eventId) await supabase.from("whatsapp_events").update({ status: "error", error: String(e) }).eq("id", eventId);
    try { await sendText(msg.phone, "Ops, tive um problema para processar sua mensagem. Pode tentar de novo? 🙏"); } catch { /* */ }
  }
}
