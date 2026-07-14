// TotexCar Co-pilot — Agente de IA do carro via WhatsApp (Uazapi)
// Recebe texto/foto/áudio, identifica o usuário pelo telefone e usa a IA (OpenAI/Claude/Gemini)
// com FERRAMENTAS (function calling): registrar gasto (com litros), medir consumo pela foto do
// hodômetro, resumo financeiro, manutenção, localização (rastreador opcional) e ANTI-MULTAS
// (foto do auto de infração → vícios + minuta de recurso).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

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

async function sendText(phone: string, text: string) {
  const { url, token } = await uazapiCreds();
  if (!url || !token) { console.error("Uazapi não configurado"); return; }
  try {
    const res = await fetch(`${url}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": token },
      body: JSON.stringify({ number: phone, text }),
    });
    if (!res.ok) console.error("Uazapi send falhou:", res.status, await res.text());
  } catch (e) {
    console.error("Erro ao enviar Uazapi:", e);
  }
}

// Página "quero comprar" do marketplace Totexmotors (janela de carros da Garagem Totex)
const GARAGEM_LABEL = "🚗 Garagem Totex";
const GARAGEM_URL = "https://totexmotors.com/comprar";

// Ações rápidas exibidas após cada resposta. WhatsApp só permite 3 BOTÕES, então com 4+ opções
// usamos uma LISTA (type:"list"). A 4ª opção (Garagem Totex) abre a janela de carros do marketplace.
const QUICK_ACTIONS = ["📊 Gastos do mês", "⛽ Meu consumo", "🔧 Manutenção (km)", GARAGEM_LABEL];

// Envia a resposta com o menu de ações (endpoint /send/menu do Uazapi).
// Usa LISTA quando há >3 opções; se a lista falhar, cai pros 3 botões (sem a Garagem) + texto.
async function sendMenu(phone: string, text: string, choices: string[], footerText?: string) {
  const { url, token } = await uazapiCreds();
  if (!url || !token) { console.error("Uazapi não configurado"); return; }
  const post = (body: unknown) => fetch(`${url}/send/menu`, {
    method: "POST", headers: { "Content-Type": "application/json", "token": token }, body: JSON.stringify(body),
  });
  const asList = choices.length > 3;
  try {
    const res = await post({ number: phone, type: asList ? "list" : "button", text, choices, footerText: footerText || "" });
    if (res.ok) return;
    console.error("Uazapi /send/menu falhou:", res.status, await res.text());
  } catch (e) {
    console.error("Erro ao enviar menu Uazapi:", e);
  }
  // fallback: 3 botões (garantido) + a Garagem vira link no texto, pra não perder a opção
  try {
    const extra = choices.length > 3 ? `\n\n${GARAGEM_LABEL}: ${GARAGEM_URL}` : "";
    const res2 = await post({ number: phone, type: "button", text: text + extra, choices: choices.slice(0, 3), footerText: footerText || "" });
    if (!res2.ok) await sendText(phone, text + extra);
  } catch { await sendText(phone, text); }
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
      .limit(1);
    if (data && data.length) return data[0];
  }
  return null;
}

// Acesso bloqueado quando o dono não pagou: trial expirou e não assinou,
// ou assinatura vencida/cancelada. Admin e lojista nunca são bloqueados.
function accessBlocked(u: any): boolean {
  if (!u) return false;
  if (u.role && u.role !== "owner") return false;
  if (u.plan === "premium") return false;
  const status = (u.subscription_status || "").toLowerCase();
  if (status === "overdue" || status === "canceled") return true;
  const ends = u.trial_ends_at ? Date.parse(u.trial_ends_at) : 0;
  return !ends || ends < Date.now();
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

// ---------- SmartGPS (rastreador — recurso PREMIUM opcional) ----------
const sgNorm = (s: any) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function smartgpsLogin(base: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d?.user_api_hash) throw new Error(`smartgps_login_${res.status}`);
  await supabase.from("app_settings").update({ smartgps_hash: d.user_api_hash, smartgps_hash_at: new Date().toISOString() }).eq("id", 1);
  return d.user_api_hash;
}

async function sgAuthAndDevices(): Promise<{ base: string; hash: string; devices: any[] } | null> {
  const s = await getSettings();
  if (!s.smartgps_enabled || !s.smartgps_email || !s.smartgps_password) return null;
  const base = (s.smartgps_base_url || "https://web.smartgps.com.br").replace(/\/+$/, "");
  let hash = s.smartgps_hash;
  const fresh = hash && s.smartgps_hash_at && (Date.now() - new Date(s.smartgps_hash_at).getTime() < 12 * 3600 * 1000);
  if (!fresh) hash = await smartgpsLogin(base, s.smartgps_email, s.smartgps_password);
  const fetchDevices = async (h: string): Promise<any[] | null> => {
    const res = await fetch(`${base}/api/get_devices?user_api_hash=${encodeURIComponent(h)}`, { headers: { Accept: "application/json" } });
    if (res.status === 401 || res.status === 419) return null;
    const d = await res.json().catch(() => ({}));
    const items = d?.items ?? d?.data ?? d;
    if (Array.isArray(items)) return items;
    if (Array.isArray(items?.[0]?.items)) return items.flatMap((g: any) => g.items || []);
    return [];
  };
  let devices = await fetchDevices(hash);
  if (devices === null) { hash = await smartgpsLogin(base, s.smartgps_email, s.smartgps_password); devices = (await fetchDevices(hash)) || []; }
  return { base, hash, devices: devices || [] };
}

function sgFindDevice(vehicle: any, devices: any[]) {
  if (!vehicle) return null;
  const p = sgNorm(vehicle.placa);
  return (vehicle.smartgps_device_id != null && devices.find((x: any) => Number(x.id) === Number(vehicle.smartgps_device_id))) ||
    (vehicle.smartgps_imei && devices.find((x: any) => sgNorm(x.imei) === sgNorm(vehicle.smartgps_imei))) ||
    (p && devices.find((x: any) => sgNorm(x.name).includes(p))) || null;
}

function isLocationQuery(t: string): boolean {
  const s = (t || "").toLowerCase();
  if (/(localiza[cç][aã]o|rastrea\w*|\bgps\b)/.test(s)) return true;
  if (/(\bonde\b|\bcad[êe]\b)/.test(s) && /(carro|ve[ií]culo|\bele\b|moto)/.test(s)) return true;
  return false;
}

// Opção "Garagem Totex" do menu (ou pedido direto): manda o link da janela de carros do marketplace
function isGaragemQuery(t: string): boolean {
  return /garagem\s*totex/i.test(t || "");
}

async function getCarLocation(vehicle: any): Promise<{ address: string | null; lat: number; lng: number; speed: number; online: any; last_update: any; odometer: number | null } | null> {
  if (!vehicle) return null;
  const ctx = await sgAuthAndDevices();
  if (!ctx) return null;
  const device = sgFindDevice(vehicle, ctx.devices);
  if (!device) return null;
  if (vehicle.smartgps_device_id == null) {
    await supabase.from("accounts").update({ smartgps_device_id: Number(device.id), smartgps_imei: device.imei ?? null }).eq("id", vehicle.id);
  }
  const lat = Number(device.lat ?? device.latitude);
  const lng = Number(device.lng ?? device.lon ?? device.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let address: string | null = null;
  try {
    const a = await fetch(`${ctx.base}/api/geo_address?lat=${lat}&lon=${lng}&user_api_hash=${encodeURIComponent(ctx.hash)}`, { headers: { Accept: "application/json" } });
    const aj = await a.json().catch(() => ({}));
    address = aj?.address ?? null;
  } catch { /* */ }
  const odo = Number(device.odometer ?? device.total_distance ?? device.distance);
  if (Number.isFinite(odo) && odo > Number(vehicle.hodometro || 0)) {
    await supabase.from("accounts").update({ hodometro: odo }).eq("id", vehicle.id);
  }
  return { address, lat, lng, speed: Number(device.speed) || 0, online: device.online, last_update: device.last_update ?? null, odometer: Number.isFinite(odo) ? odo : null };
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

// resumo compacto de um carro pro chat (com link rastreável ?ref do dono → comissão do Indique)
function mktResumo(v: any, refCode?: string | null) {
  return {
    carro: [v.brand, v.model, v.version].filter(Boolean).join(" "),
    ano: v.year, km: v.mileage, preco: v.price, fipe: v.fipePrice ?? null,
    cor: v.color || null, cambio: v.transmission || null, loja: v.dealership?.name || null,
    link: `${MARKETPLACE_URL}/veiculo/${v.id}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`,
  };
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
    name: "localizar_carro",
    description: "Localização atual do carro (rastreador PREMIUM, se ativo).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "buscar_carros",
    description: "Busca carros no ESTOQUE REAL do marketplace Totexmotors (concierge de compra/troca). Use quando o usuário quiser comprar, trocar ou ver carros disponíveis.",
    parameters: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Texto livre: modelo, tipo (SUV, sedan), etc." },
        marca: { type: "string" },
        preco_max: { type: "number", description: "Preço máximo em reais" },
        ano_min: { type: "number", description: "Ano mínimo" },
        km_max: { type: "number", description: "Km máxima" },
      },
    },
  },
  {
    name: "oportunidades_carros",
    description: "Oportunidades de TROCA selecionadas com base no carro atual do usuário (valor pago, ano). Use para 'que carro você me recomenda?', 'quero trocar de carro', 'o que tem pra mim?'.",
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
];

type ToolCtx = { user: any; vehicle: any; today: string; inputText: string };

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
      return { ok: true, id: data.id };
    }

    if (name === "minhas_multas") {
      try {
        const { data } = await supabase.from("multas")
          .select("descricao, valor, pontos, prazo_recurso, status, chance, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
        return { multas: data || [] };
      } catch (e) { return { error: String((e as any)?.message || e) }; }
    }

    if (name === "localizar_carro") {
      const loc = await getCarLocation(vehicle);
      if (!loc) return { ok: false, error: "rastreador_indisponivel", message: "O rastreamento por GPS é um recurso opcional e não está ativo nesta conta." };
      return { ok: true, endereco: loc.address, lat: loc.lat, lng: loc.lng, em_movimento: loc.speed > 0, velocidade_kmh: Math.round(loc.speed), mapa: `https://maps.google.com/?q=${loc.lat},${loc.lng}` };
    }

    if (name === "buscar_carros") {
      const cars = await mktVehicles({
        search: args?.busca, brand: args?.marca,
        maxPrice: Number(args?.preco_max) > 0 ? Number(args.preco_max) : undefined,
        minYear: Number(args?.ano_min) > 0 ? Number(args.ano_min) : undefined,
        maxMileage: Number(args?.km_max) > 0 ? Number(args.km_max) : undefined,
        limit: 6,
      });
      if (!cars.length) return { ok: true, total: 0, message: "Nada no estoque com esses critérios. Ofereça criar_radar pro usuário ser avisado quando aparecer." };
      return { ok: true, total: cars.length, carros: cars.map((v: any) => mktResumo(v, user.referral_code)) };
    }

    if (name === "oportunidades_carros") {
      let cars: any[] = [];
      let criterio = "destaques do estoque";
      if (vehicle?.valor_compra && Number(vehicle.valor_compra) > 0) {
        const v = Number(vehicle.valor_compra);
        criterio = `upgrade a partir do ${vehicle.marca || ""} ${vehicle.modelo || ""} (referência R$ ${v})`;
        cars = await mktVehicles({ minPrice: Math.round(v * 0.9), maxPrice: Math.round(v * 1.9), minYear: vehicle.ano_modelo || undefined, limit: 6 });
        if (!cars.length) cars = await mktVehicles({ minPrice: Math.round(v * 0.7), limit: 6 });
      } else {
        const res = await fetch(`${MARKETPLACE_URL}/api/vehicles/featured?limit=6`);
        const d = await res.json().catch(() => []);
        cars = Array.isArray(d) ? d : (d?.data || []);
      }
      const own = `${vehicle?.marca || ""} ${vehicle?.modelo || ""}`.trim().toLowerCase();
      if (own) cars = cars.filter((c: any) => `${c.brand} ${c.model}`.toLowerCase() !== own || c.year !== vehicle?.ano_modelo);
      return { ok: true, criterio, carros: cars.slice(0, 6).map((c: any) => mktResumo(c, user.referral_code)) };
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
        await sendText(ownerPhone,
          `🆘 SUPORTE TCF — chamado ${urg}\n\n👤 ${user.name || "?"} · ${user.email || "?"} · ${user.phone || "s/ tel"}\n💼 Plano: ${user.plan || "?"} (${user.subscription_status || "?"})${user.dealership ? ` · Loja: ${user.dealership}` : ""}\n\n📌 ${args?.assunto}\n${args?.resumo}\n\nTicket: ${t.id} (canal: WhatsApp)`);
      }
      return { ok: true, ticket_id: t.id, message: "Chamado aberto; responsável notificado no WhatsApp." };
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
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  _settings = null; // recarrega configs a cada requisição

  const url = new URL(req.url);
  if (WEBHOOK_SECRET && url.searchParams.get("secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401, headers: cors });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const msg = parseInbound(body);

  if (msg.fromMe || !msg.phone) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  const { data: evt } = await supabase
    .from("whatsapp_events")
    .insert({ from_phone: msg.phone, kind: msg.kind, raw: body, status: "received" })
    .select("id")
    .single();
  const eventId = evt?.id;

  try {
    const user = await findUserByPhone(msg.phone);
    if (!user) {
      await sendText(msg.phone, "Olá! 👋 Sou o TotexCar Co-pilot. Não encontrei seu cadastro — cadastre-se no app e use o mesmo número de WhatsApp para cuidar do seu carro por aqui.");
      if (eventId) await supabase.from("whatsapp_events").update({ status: "ignored", error: "user_not_found" }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (accessBlocked(user)) {
      const { data: cfg } = await supabase.from("app_settings").select("app_url").eq("id", 1).single();
      const appUrl = (cfg?.app_url || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");
      await sendText(msg.phone, `🔒 Seu acesso ao TotexCar Co-pilot está inativo.\n\nPra voltar a cuidar do seu carro por aqui, é só assinar (a partir de R$ 10,99/mês):\n${appUrl}/plans\n\nAssim que o pagamento for confirmado, eu volto a funcionar automaticamente. 🚗`);
      if (eventId) await supabase.from("whatsapp_events").update({ status: "blocked", error: "subscription_inactive", user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true, blocked: true }), { headers: { ...cors, "Content-Type": "application/json" } });
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

    const today = new Date().toISOString().split("T")[0];
    const system = `Você é o **TotexCar Co-pilot**, o assistente de IA do carro do usuário (ecossistema Totexmotors). Responda SEMPRE em português do Brasil, curto e amigável, no máximo 1 emoji.

TIPOS DE MENSAGEM (identifique pela foto/texto):
- GASTO/RECEITA do carro (texto, foto de cupom/nota, áudio) → use registrar_gasto. Em COMBUSTÍVEL, leia e informe os LITROS.
- Foto do HODÔMETRO (painel mostrando a quilometragem) → use atualizar_hodometro com o km lido. ⚠️ LEIA TODOS OS DÍGITOS do odômetro (geralmente 5 ou 6 dígitos, ex.: 87452). Se houver um dígito decimal/décimos destacado, ignore só ele. NUNCA leia apenas os primeiros dígitos.
- CORREÇÃO logo após um registro (ex.: "o valor exato é 101", "foram 30 litros") → use corrigir_ultimo_gasto. NUNCA registre de novo.
- Foto de MULTA / auto de infração → siga o fluxo de MULTAS abaixo.
- PRINT da tela de GANHOS de aplicativo (Uber/99/inDriver mostram "Ganhos" com período e valor) → use registrar_receita (leia o app, o período e o VALOR TOTAL do print).
- Foto de BOLETO de parcela do financiamento → leia a LINHA DIGITÁVEL COMPLETA (todos os dígitos) e use salvar_boleto. NÃO registre boleto de financiamento como gasto.
- PDF de CARNÊ do financiamento (os bancos enviam o carnê digital com TODOS os boletos) → extraia o número e a LINHA DIGITÁVEL COMPLETA de CADA parcela e use salvar_carne (todas de uma vez). Confirme quantas parcelas salvou e explique que os lembretes de vencimento sairão com o boleto certo de cada mês, automaticamente.

FINANCIAMENTO/BOLETO: cada parcela tem um boleto PRÓPRIO emitido pelo banco — NUNCA invente, derive ou "calcule" código de barras/linha digitável (seria um boleto inválido). Pedirem o boleto/código de barras → use boleto_parcela e envie a linha digitável salva em bloco copiável, dizendo de qual parcela é. Se não houver linha salva (ou for de parcela anterior), explique com naturalidade e peça a FOTO do boleto do mês (ou o número), que você salva com salvar_boleto — e avise que a linha vai junto no lembrete de vencimento.

REGRA DE OURO DO REGISTRO: se a mensagem JÁ TEM o valor em R$ (ex.: "500 de diesel no posto Shell"), chame registrar_gasto IMEDIATAMENTE com esse valor — NUNCA pergunte litros/km antes de registrar. Litros e km que faltarem: peça DEPOIS e complete com corrigir_ultimo_gasto quando o usuário responder. NUNCA chame registrar_gasto com amount=0 — se não souber o valor, pergunte primeiro. Recupere valores ditos em mensagens anteriores pela CONVERSA RECENTE.

CONSUMO (regra importante): para medir o consumo eu preciso do km a cada abastecimento. SEMPRE que registrar um COMBUSTÍVEL sem o km (a ferramenta retorna pedir_hodometro=true), PEÇA uma FOTO DO HODÔMETRO (ou o km digitado) e explique que é assim que eu meço o consumo. Faça o mesmo em manutenções/revisões (ex.: troca de óleo).
APRESENTAÇÃO DO CONSUMO (sempre simples, litros vs km): "Você rodou X km e usou Y litros → Z km/L". Se houver média e custo: acrescente "Média: W km/L · combustível custa R$ V por km rodado". Nada de jargão.

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

Categorias de gasto: ${despesas.join(", ")}. Categorias de receita: ${receitas.join(", ")}. Use is_new_category=true só se nenhuma existente servir.

MOTORISTA PRO (TotexCar Co-pilot PRO): MODO PRO do usuário: ${user.driver_mode ? "ATIVO" : "inativo"}. Se ativo, trate o carro como NEGÓCIO: registre ganhos (registrar_receita) além dos gastos, e responda "quanto sobrou?" com lucro_periodo (receita − despesa, lucro por km). Na PRIMEIRA receita registrada, dê boas-vindas ao Modo PRO e explique o resumo semanal. Se alguém sem Modo PRO mandar print de ganhos, registre normalmente (o modo ativa sozinho).

SEU CARRO — CONCIERGE TÉCNICO DO DONO: você é o concierge automotivo PESSOAL deste dono e conhece o carro DELE a fundo. ${fichaStr ? `FICHA TÉCNICA do carro (use como FONTE DA VERDADE): ${fichaStr}` : "A ficha técnica deste carro ainda está sendo montada — se perguntarem especificação, dê uma faixa honesta e diga que vai confirmar."} Cruze a ficha com os DADOS REAIS do dono (hodômetro, consumo calculado, gastos, próximas manutenções por km) pra dar dicas ESPECÍFICAS: qual óleo/pneu/vela e quando trocar, intervalo de revisão, o que fazer neste km, economia de combustível, e compare o consumo REAL com o esperado da ficha (ex.: "seu consumo tá abaixo do normal desse motor — pode ser calibragem/filtro"). Para elétrico/híbrido: cuidados de bateria (carga 20–80%), regeneração, autonomia. ⚠️ REGRA DE OURO: NUNCA invente número exato de óleo/pneu/torque/intervalo — use a ficha; se o dado não estiver nela, dê uma FAIXA e mande confirmar no manual do proprietário ou concessionária. Segurança e o bolso do dono em 1º lugar; seja proativo e didático.

GARAGEM TOTEX (concierge automotivo): você TAMBÉM é o concierge de carros do ecossistema Totexmotors — entende profundamente de carros (versões, motores, consumo, confiabilidade, custo de manutenção, revenda) e tem acesso ao ESTOQUE REAL das lojas via ferramentas. Quando o usuário falar em comprar/trocar/procurar carro: (1) entenda a necessidade (uso, família, orçamento) e CRUZE com o que você já sabe dele (carro atual, km rodados, consumo, gastos — use resumo_financeiro/consumo_medio se ajudar); (2) use buscar_carros ou oportunidades_carros; (3) recomende 2–3 opções explicando O PORQUÊ de cada uma pro perfil dele, sempre com o link; (4) se não houver no estoque, ofereça criar_radar ("te aviso quando chegar"). Perguntas gerais de carro ("Corolla ou Civic?", "esse motor é bom?") responda como especialista, honesto sobre prós e contras — e, quando fizer sentido, conecte ao estoque. Para vender/avaliar o carro atual, indique a Garagem Totex no app (/garagem) ou a Recompra FIPE.

SUPORTE: você TAMBÉM é o suporte oficial. Dúvidas de uso, planos e pagamento, responda com esta base: teste grátis 7 dias (sem cartão); plano Totex Care R$ 109,90/mês; membro do ecossistema (cupom da loja) R$ 10,99/mês; plano ANUAL R$ 109,90 à vista — 12 meses pelo preço de 10 (~17% off); pagamento PIX/cartão (Asaas) em /plans; acesso bloqueado = assinar em /plans (libera na hora); consumo só aparece a partir do 2º abastecimento com foto do hodômetro; recurso de multa é MODELO (decisão é do órgão). ⚠️ NUNCA diga "sem fidelidade" ou "cancele quando quiser". O que você NÃO resolver (pagamento não liberado, reembolso/cancelamento, bug, reclamação séria, pedido de humano) → use abrir_chamado (o dono é notificado e retorna). Sugestões de melhoria → abrir_chamado com assunto "Sugestão".

Regras: depois de registrar algo, confirme em 1 frase. Se faltar o valor, peça. Não invente dados — use as ferramentas. Localização por GPS é um recurso opcional; se não estiver ativo, explique com naturalidade.

Hoje é ${today}.
${historico ? `CONVERSA RECENTE (para contexto e correções):\n${historico}\n` : ""}
RESUMO DO USUÁRIO (respostas rápidas; use ferramentas p/ o resto):
${JSON.stringify(snapshot)}`;

    // monta as partes normalizadas (texto/imagem)
    const parts: any[] = [];
    let inputText = msg.text || msg.transcription || "";
    if (msg.kind === "image") {
      let img: { data: string; media_type: string } | null = null;
      if (msg.base64) {
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
      if (!inputText) inputText = "Analise esta foto: pode ser um cupom/nota de gasto, uma multa (auto de infração), o hodômetro do painel ou um print da tela de ganhos de aplicativo (Uber/99). Aja conforme o tipo.";
    }
    if (msg.kind === "audio" && !inputText) {
      let audio: { data: string; media_type: string } | null = null;
      if (msg.base64) {
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
      if (msg.base64) {
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
      if (!inputText) inputText = "Analise este PDF. Se for um carnê/boletos de financiamento, extraia TODAS as parcelas (número e linha digitável completa de cada) e salve com salvar_carne.";
    }

    // Atalho barato: "onde está meu carro?" (rastreador premium, se ativo)
    if (msg.kind !== "image" && isLocationQuery(inputText)) {
      try {
        const loc = await getCarLocation(vehicle);
        if (loc) {
          const nome = vehicle?.name || vehicle?.modelo || "carro";
          const onde = loc.address || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
          const estado = loc.speed > 0 ? `🚗 Em movimento (${Math.round(loc.speed)} km/h)` : "🅿️ Parado";
          await sendMenu(msg.phone, `📍 Seu ${nome} está em:\n${onde}\n\n${estado}\n\nVer no mapa: https://maps.google.com/?q=${loc.lat},${loc.lng}`, QUICK_ACTIONS, "Toque numa ação ou mande um gasto 🚗");
          if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "location" }, user_id: user.id }).eq("id", eventId);
          return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      } catch (e) { console.error("getCarLocation (atalho) falhou:", e); }
    }

    // Atalho: opção "Garagem Totex" do menu (ou pedido direto) → abre a janela de carros do marketplace
    if (msg.kind !== "image" && isGaragemQuery(inputText)) {
      await sendMenu(msg.phone,
        `${GARAGEM_LABEL} — seu próximo carro te espera! 🔑\n\nVeja os carros disponíveis no marketplace Totexmotors:\n${GARAGEM_URL}\n\nAchou um que curtiu? Me chama que eu simulo o financiamento e ainda avalio seu carro atual na troca. 😉`,
        QUICK_ACTIONS, "Toque numa ação ou mande um gasto 🚗");
      if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { action: "garagem" }, user_id: user.id }).eq("id", eventId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    parts.push({ kind: "text", text: inputText || "(sem conteúdo)" });

    const aiConfig = await getAIConfig();
    let replyText = "";
    try {
      replyText = await runAgent(aiConfig, system, parts, { user, vehicle, today, inputText });
    } catch (e) {
      console.error("runAgent erro:", e);
    }
    if (!replyText) replyText = "Recebi sua mensagem! Pode detalhar um pouco mais pra eu te ajudar? 🙂";

    await sendMenu(msg.phone, replyText, QUICK_ACTIONS, "Toque numa ação ou mande um gasto 🚗");
    // guarda também o input (inclui transcrição de áudio) — a memória da conversa depende disso
    if (eventId) await supabase.from("whatsapp_events").update({ status: "processed", parsed: { reply: replyText, input: inputText }, user_id: user.id }).eq("id", eventId);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Erro no processamento:", e);
    if (eventId) await supabase.from("whatsapp_events").update({ status: "error", error: String(e) }).eq("id", eventId);
    try { await sendText(msg.phone, "Ops, tive um problema para processar sua mensagem. Pode tentar de novo? 🙏"); } catch { /* */ }
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
