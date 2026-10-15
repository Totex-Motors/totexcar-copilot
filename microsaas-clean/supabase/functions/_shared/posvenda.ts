// PÓS-VENDA — ATENDIMENTO COM HANDOFF (Fase 1). Usado pelo whatsapp-webhook (abrir caso + ponte),
// pela função posvenda (escada a cada 5 min) e pelo dealer-api (painel).
//
// Como funciona:
//  1. O Co-pilot atende primeiro. Quando precisa de gente da loja, abre um CASO (abrirCaso).
//  2. O GRUPO da equipe recebe o aviso pelo número uazapi do Canal (só posta em grupo @g.us — nunca
//     em contato) com um link wa.me "#assumir N" pro número oficial do Co-pilot.
//  3. Quem assume vira a PONTE: o que ele escreve pro Co-pilot vai pro cliente (com o nome dele) e o
//     que o cliente escreve vai pra ele. "fim" encerra (o cliente dá nota 1–5), "#sair" devolve.
//  4. Ninguém assumiu em SLA minutos (só dentro do horário) → sobe o degrau: vendedor da venda →
//     gerente de manutenção → gerente geral. Cada degrau avisa o grupo de novo.
import { loadWaSettings, waSendText, waSendMediaId, waUploadMedia, metaDownloadMedia } from "./wa.ts";

export const COPILOT_WA = Deno.env.get("COPILOT_WA_NUMBER") || "5511963786699";
const dig = (s: unknown) => String(s ?? "").replace(/\D/g, "");
// celular BR: a Meta às vezes manda o wa_id SEM o 9º dígito. Variantes com e sem o 9 (sempre com 55).
export function variantesTel(s: unknown): string[] {
  let d = dig(s);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || d.length < 12) return d ? [d] : [];
  const ddd = d.slice(2, 4), resto = d.slice(4);
  const sem9 = resto.length === 9 && resto.startsWith("9") ? resto.slice(1) : resto;
  return [...new Set([`55${ddd}${sem9}`, sem9.length === 8 ? `55${ddd}9${sem9}` : `55${ddd}${sem9}`])];
}
const chaveTel = (s: unknown) => { const v = variantesTel(s); const d = v[0] || ""; return d.length >= 12 ? `${d.slice(2, 4)}${d.slice(-8)}` : d; };

export const PAPEL: Record<string, string> = { vendedor: "vendedor", gerente_manutencao: "gerente de manutenção", gerente_geral: "gerente geral" };
export const MOTIVO: Record<string, string> = {
  garantia_defeito: "Garantia / defeito", documentacao: "Documentação / transferência", revisao: "Revisão / manutenção",
  financeiro: "Financeiro", troca_recompra: "Troca / recompra", reclamacao: "Reclamação", outro: "Outro",
};
const PRIORIDADE: Record<string, string> = { baixa: "baixa", media: "média", alta: "ALTA", urgente: "🚨 URGENTE" };

export const linkAssumir = (numero: number | string) => `https://wa.me/${COPILOT_WA}?text=${encodeURIComponent(`#assumir ${numero}`)}`;

// ---------------- horário de atendimento (BRT, sem horário de verão) ----------------
type Horario = Record<string, [string, string]>;
const HORARIO_PADRAO: Horario = { "1": ["08:00", "18:00"], "2": ["08:00", "18:00"], "3": ["08:00", "18:00"], "4": ["08:00", "18:00"], "5": ["08:00", "18:00"], "6": ["08:00", "12:00"] };
const brt = (d: Date) => new Date(d.getTime() - 3 * 3600_000); // campos UTC desse Date = relógio de Brasília
const hm = (s: string) => { const [h, m] = String(s || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

// início do expediente de HOJE se agora estiver dentro dele; null = fora do horário
export function inicioDoExpediente(horario: Horario | null | undefined, agora = new Date()): Date | null {
  const h = horario && Object.keys(horario).length ? horario : HORARIO_PADRAO;
  const b = brt(agora);
  const faixa = h[String(b.getUTCDay())];
  if (!faixa) return null;
  const min = b.getUTCHours() * 60 + b.getUTCMinutes();
  const ini = hm(faixa[0]), fim = hm(faixa[1]);
  if (min < ini || min >= fim) return null;
  return new Date(agora.getTime() - (min - ini) * 60_000 - b.getUTCSeconds() * 1000);
}
export function textoHorario(horario: Horario | null | undefined): string {
  const h = horario && Object.keys(horario).length ? horario : HORARIO_PADRAO;
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const sem = ["1", "2", "3", "4", "5"].map((d) => h[d]?.join("–")).filter(Boolean);
  const util = sem.length === 5 && new Set(sem).size === 1 ? `seg a sex ${sem[0]}` : ["1", "2", "3", "4", "5"].filter((d) => h[d]).map((d) => `${dias[+d]} ${h[d].join("–")}`).join(", ");
  return [util, h["6"] ? `sáb ${h["6"].join("–")}` : "", h["0"] ? `dom ${h["0"].join("–")}` : ""].filter(Boolean).join(" · ");
}

// ---------------- leitura ----------------
export async function configDaLoja(sb: any, loja: string): Promise<any | null> {
  const { data } = await sb.from("posvenda_config").select("*").eq("dealership", loja).maybeSingle();
  return data || null;
}
export async function equipeDaLoja(sb: any, loja: string): Promise<any[]> {
  const { data } = await sb.from("posvenda_equipe").select("*").eq("dealership", loja).eq("ativo", true).order("nome");
  return data || [];
}
export async function membroPorTelefone(sb: any, phone: string): Promise<any | null> {
  const vs = variantesTel(phone);
  if (!vs.length) return null;
  const { data } = await sb.from("posvenda_equipe").select("*").eq("ativo", true).in("phone", vs).limit(1);
  if (data?.[0]) return data[0];
  // telefone cadastrado num formato diferente: compara DDD + 8 últimos dígitos
  const k = chaveTel(phone);
  const { data: todos } = await sb.from("posvenda_equipe").select("*").eq("ativo", true).like("phone", `%${k.slice(-8)}`).limit(10);
  return (todos || []).find((m: any) => chaveTel(m.phone) === k) || null;
}
const nomeCurto = (n?: string | null) => String(n || "").trim().split(/\s+/)[0] || "Cliente";

// janela de 24h da Meta: a pessoa escreveu pro Co-pilot nas últimas ~23h?
async function janelaAberta(sb: any, phone: string): Promise<boolean> {
  const vs = variantesTel(phone);
  if (!vs.length) return false;
  const { data } = await sb.from("whatsapp_events").select("created_at").in("from_phone", vs)
    .not("kind", "in", "(status_evt,status_fail)").order("created_at", { ascending: false }).limit(1);
  const t = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;
  return Date.now() - t < 23 * 3600_000;
}

async function logMsg(sb: any, casoId: string, de: string, autor: string | null, texto: string | null, midia?: string | null) {
  try { await sb.from("posvenda_mensagens").insert({ caso_id: casoId, de, autor, texto: texto ? String(texto).slice(0, 4000) : null, midia: midia || null }); } catch { /* */ }
}

// ---------------- GRUPO (número uazapi do Canal — SÓ grupo @g.us) ----------------
export async function avisarGrupo(sb: any, loja: string, texto: string, cfg?: any): Promise<boolean> {
  const c = cfg || await configDaLoja(sb, loja);
  const grupo = String(c?.grupo_id || "").trim();
  if (!/^[\w.-]+@g\.us$/.test(grupo)) return false;          // regra dura: só grupo
  const { data: st } = await sb.from("app_settings").select("canal_uazapi_url, canal_uazapi_token").eq("id", 1).single();
  const url = String(st?.canal_uazapi_url || "").replace(/\/+$/, ""), token = String(st?.canal_uazapi_token || "");
  if (!url || !token) return false;
  try {
    const r = await fetch(`${url}/send/text`, { method: "POST", headers: { "content-type": "application/json", token }, body: JSON.stringify({ number: grupo, text: texto }) });
    if (!r.ok) console.error("posvenda grupo:", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) { console.error("posvenda grupo:", e); return false; }
}

// lista os grupos em que o número do Canal está (pra loja escolher o do pós-venda no painel)
export async function listarGrupos(sb: any): Promise<{ id: string; nome: string }[]> {
  const { data: st } = await sb.from("app_settings").select("canal_uazapi_url, canal_uazapi_token").eq("id", 1).single();
  const url = String(st?.canal_uazapi_url || "").replace(/\/+$/, ""), token = String(st?.canal_uazapi_token || "");
  if (!url || !token) return [];
  const achados = new Map<string, string>();
  const varre = (o: any, depth = 0) => {
    if (!o || depth > 6) return;
    if (Array.isArray(o)) { o.forEach((x) => varre(x, depth + 1)); return; }
    if (typeof o !== "object") return;
    const id = [o.JID, o.jid, o.id, o.groupJid, o.wa_chatid].find((v) => typeof v === "string" && /@g\.us$/.test(v));
    if (id) achados.set(id, String(o.Name || o.name || o.subject || o.Subject || o.wa_name || achados.get(id) || id));
    for (const v of Object.values(o)) if (v && typeof v === "object") varre(v, depth + 1);
  };
  for (const [metodo, path, body] of [["GET", "/group/list"], ["POST", "/group/list", {}], ["GET", "/chats?limit=300"]] as [string, string, unknown?][]) {
    try {
      const r = await fetch(`${url}${path}`, { method: metodo, headers: { "content-type": "application/json", token }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      if (r.ok) varre(await r.json().catch(() => null));
      if (achados.size) break;
    } catch { /* tenta o próximo */ }
  }
  return [...achados.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
}

// quem está no degrau N (1 = vendedor da venda; 2 = gerente(s) de manutenção; 3 = gerente(s) geral)
function doDegrau(equipe: any[], nivel: number, vendedorId?: string | null): any[] {
  if (nivel <= 1) return equipe.filter((m) => m.id === vendedorId);
  return equipe.filter((m) => m.papel === (nivel === 2 ? "gerente_manutencao" : "gerente_geral"));
}
const nomes = (ms: any[]) => ms.map((m) => `*${m.nome}*`).join(" / ");

// avisa individualmente quem está no degrau (só chega se a pessoa falou com o Co-pilot nas últimas 24h —
// fora disso a Meta bloqueia; o grupo é o canal garantido)
async function avisarIndividual(sb: any, ms: any[], texto: string) {
  const wa = await loadWaSettings(sb);
  for (const m of ms) { try { if (await janelaAberta(sb, m.phone)) await waSendText(wa, m.phone, texto); } catch { /* */ } }
}

function fichaDoCaso(c: any, extra?: string): string {
  return [
    `👤 ${c.customer_name || "Cliente"}${c.car_desc ? ` · ${c.car_desc}` : ""}${c.placa ? ` · ${c.placa}` : ""}`,
    `📌 ${MOTIVO[c.motivo] || c.motivo} · prioridade ${PRIORIDADE[c.prioridade] || c.prioridade}`,
    c.resumo ? `📝 ${String(c.resumo).slice(0, 600)}` : "",
    extra || "",
  ].filter(Boolean).join("\n");
}

// ---------------- ABRIR CASO (chamado pela ferramenta do assistente) ----------------
export async function abrirCaso(sb: any, o: {
  phone: string; nome?: string | null; userId?: string | null; motivo?: string; resumo?: string; prioridade?: string; origem?: string;
  dealershipHint?: string | null; carro?: string | null; placa?: string | null;
}): Promise<{ ok: boolean; error?: string; caso?: any; vendedor?: string | null; foraDoHorario?: boolean; horario?: string; jaExistia?: boolean }> {
  const vs = variantesTel(o.phone);
  const phone = vs[vs.length - 1] || dig(o.phone);           // guarda sempre a forma com o 9
  // jornada de pós-venda mais recente desse telefone → loja + vendedor da venda
  let j: any = null;
  for (const c of [phone.slice(-11), phone.slice(-10), phone.slice(-8)]) {
    const { data } = await sb.from("postsale_journeys").select("id, dealership, customer_name, car_desc, vendedor_id, user_id")
      .ilike("customer_phone", `%${c}`).order("created_at", { ascending: false }).limit(1);
    if (data?.[0]) { j = data[0]; break; }
  }
  const loja = j?.dealership || o.dealershipHint || null;
  if (!loja) return { ok: false, error: "sem_loja" };
  const cfg = await configDaLoja(sb, loja);
  if (!cfg?.ativo) return { ok: false, error: "loja_sem_atendimento" };

  // já tem caso aberto? acrescenta e devolve o mesmo
  const { data: abertos } = await sb.from("posvenda_casos").select("*").in("customer_phone", variantesTel(phone))
    .in("status", ["aberto", "em_atendimento"]).order("created_at", { ascending: false }).limit(1);
  if (abertos?.[0]) {
    const c = abertos[0];
    if (o.resumo) await logMsg(sb, c.id, "copilot", "Co-pilot", `Complemento: ${o.resumo}`);
    return { ok: true, caso: c, jaExistia: true, vendedor: null, horario: textoHorario(cfg.horario) };
  }

  const equipe = await equipeDaLoja(sb, loja);
  const vendedor = equipe.find((m) => m.id === j?.vendedor_id) || null;
  const nivel = vendedor ? 1 : (equipe.some((m) => m.papel === "gerente_manutencao") ? 2 : 3);
  const motivo = MOTIVO[o.motivo || ""] ? o.motivo! : "outro";
  const prioridade = PRIORIDADE[o.prioridade || ""] ? o.prioridade! : "media";
  const { data: caso, error } = await sb.from("posvenda_casos").insert({
    dealership: loja, customer_phone: phone, customer_name: o.nome || j?.customer_name || null, user_id: o.userId || j?.user_id || null,
    journey_id: j?.id || null, car_desc: o.carro || j?.car_desc || null, placa: o.placa || null,
    motivo, resumo: o.resumo || null, prioridade, vendedor_id: vendedor?.id || null, nivel, origem: o.origem || "whatsapp",
  }).select("*").single();
  if (error || !caso) return { ok: false, error: error?.message || "falha_ao_abrir" };
  await logMsg(sb, caso.id, "copilot", "Co-pilot", `Caso aberto. ${o.resumo || ""}`.trim());

  const dentro = !!inicioDoExpediente(cfg.horario);
  const alvo = doDegrau(equipe, nivel, vendedor?.id);
  const quem = alvo.length ? nomes(alvo) : "a equipe";
  await avisarGrupo(sb, loja, [
    `🔔 *Atendimento #${caso.numero}*${nivel === 1 ? "" : " (sem vendedor ligado à venda)"}`,
    fichaDoCaso(caso),
    `🧑‍💼 Com: ${quem}${vendedor ? " (vendeu o carro)" : ""}`,
    dentro ? `⏱️ Se ninguém assumir em ${cfg.sla_min} min, passa para o próximo.` : `🌙 Fora do horário — o relógio começa no próximo expediente (${textoHorario(cfg.horario)}).`,
    ``,
    `👉 Para ASSUMIR, toque e envie: ${linkAssumir(caso.numero)}`,
  ].join("\n"), cfg);
  await avisarIndividual(sb, alvo, `🔔 Atendimento #${caso.numero} pra você:\n${fichaDoCaso(caso)}\n\nResponda *#assumir ${caso.numero}* para assumir.`);
  return { ok: true, caso, vendedor: vendedor?.nome || null, foraDoHorario: !dentro, horario: textoHorario(cfg.horario) };
}

// ---------------- ESCADA (cron a cada 5 min) ----------------
// loja com atendimento ligado (config ativa + grupo configurado)?
export async function atendimentoAtivo(sb: any, loja?: string | null): Promise<boolean> {
  if (!loja) return false;
  const c = await configDaLoja(sb, loja);
  return !!(c?.ativo && /@g\.us$/.test(String(c?.grupo_id || "")));
}

// CLIENTE ESPERANDO: caso já assumido, o cliente escreveu e quem assumiu não respondeu em
// max(30, 4×SLA) min de expediente → lembra a pessoa (se der) e avisa o grupo. Uma vez por mensagem.
async function esperaTick(sb: any, cfgs: Map<string, any>): Promise<number> {
  const { data: casos } = await sb.from("posvenda_casos").select("*").eq("status", "em_atendimento").limit(200);
  let lembrados = 0;
  for (const c of casos || []) {
    if (!cfgs.has(c.dealership)) cfgs.set(c.dealership, await configDaLoja(sb, c.dealership));
    const cfg = cfgs.get(c.dealership);
    if (!cfg?.ativo) continue;
    const ini = inicioDoExpediente(cfg.horario);
    if (!ini) continue;
    const { data: ms } = await sb.from("posvenda_mensagens").select("de, texto, created_at").eq("caso_id", c.id).order("created_at", { ascending: false }).limit(15);
    const ult = (ms || [])[0];
    if (!ult || ult.de !== "cliente") {
      // a última não é do cliente: só segue se a última for um lembrete nosso (aí já foi avisado)
      continue;
    }
    const tCli = new Date(ult.created_at).getTime();
    const espera = Math.max(30, 4 * (Number(cfg.sla_min) || 15)) * 60_000;
    if (Date.now() - Math.max(tCli, ini.getTime()) < espera) continue;
    const { data: ag } = await sb.from("posvenda_equipe").select("*").eq("id", c.agente_id).maybeSingle();
    const min = Math.round((Date.now() - tCli) / 60_000);
    await logMsg(sb, c.id, "sistema", null, `Lembrete: cliente esperando resposta há ${min} min.`);
    if (ag && await janelaAberta(sb, ag.phone)) {
      const wa = await loadWaSettings(sb);
      await waSendText(wa, ag.phone, `⏰ ${nomeCurto(c.customer_name)} (#${c.numero}) está esperando sua resposta há ${min} min:\n"${String(ult.texto || "(mídia)").slice(0, 300)}"\n\nResponda aqui mesmo. Se não for com você, envie *#sair* que eu devolvo pro grupo.`);
    }
    await avisarGrupo(sb, c.dealership, `⏰ *#${c.numero}*: ${c.customer_name || "o cliente"} está esperando resposta de *${ag?.nome || "quem assumiu"}* há ${min} min.\n"${String(ult.texto || "(mídia)").slice(0, 200)}"`, cfg);
    lembrados++;
  }
  return lembrados;
}

export async function escadaTick(sb: any): Promise<{ subiram: number; verificados: number; lembrados: number }> {
  const { data: casos } = await sb.from("posvenda_casos").select("*").eq("status", "aberto").limit(200);
  let subiram = 0;
  const cfgs = new Map<string, any>(), equipes = new Map<string, any[]>();
  for (const c of casos || []) {
    if (!cfgs.has(c.dealership)) cfgs.set(c.dealership, await configDaLoja(sb, c.dealership));
    const cfg = cfgs.get(c.dealership);
    if (!cfg?.ativo) continue;
    const ini = inicioDoExpediente(cfg.horario);
    if (!ini) continue;                                                    // fora do horário: relógio parado
    const base = Math.max(new Date(c.nivel_desde).getTime(), ini.getTime());
    const sla = Math.max(5, Number(cfg.sla_min) || 15) * 60_000;
    if (Date.now() - base < sla) continue;
    if (!equipes.has(c.dealership)) equipes.set(c.dealership, await equipeDaLoja(sb, c.dealership));
    const equipe = equipes.get(c.dealership)!;
    const min = Math.round((Date.now() - new Date(c.created_at).getTime()) / 60_000);
    let novo = c.nivel + 1;
    if (novo === 2 && !doDegrau(equipe, 2).length) novo = 3;
    if (novo > 3) {
      // já no topo: relembra o grupo a cada 2 SLAs
      if (Date.now() - base < 2 * sla) continue;
      await sb.from("posvenda_casos").update({ nivel_desde: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", c.id);
      await avisarGrupo(sb, c.dealership, `🚨 *#${c.numero} ainda sem ninguém* (${min} min) — ${c.customer_name || "cliente"} esperando.\n👉 Assumir: ${linkAssumir(c.numero)}`, cfg);
      continue;
    }
    const alvo = doDegrau(equipe, novo);
    await sb.from("posvenda_casos").update({ nivel: novo, nivel_desde: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", c.id);
    await logMsg(sb, c.id, "sistema", null, `Sem resposta em ${cfg.sla_min} min — passou para ${alvo.map((m) => m.nome).join(" / ") || PAPEL[novo === 2 ? "gerente_manutencao" : "gerente_geral"]}.`);
    await avisarGrupo(sb, c.dealership, [
      `${novo === 3 ? "🚨" : "⏰"} *#${c.numero} sem resposta há ${min} min* — passou para ${alvo.length ? nomes(alvo) : `o ${PAPEL[novo === 2 ? "gerente_manutencao" : "gerente_geral"]}`} (${PAPEL[novo === 2 ? "gerente_manutencao" : "gerente_geral"]}).`,
      fichaDoCaso(c),
      `👉 Assumir: ${linkAssumir(c.numero)}`,
    ].join("\n"), cfg);
    await avisarIndividual(sb, alvo, `⏰ Atendimento #${c.numero} sem resposta há ${min} min e passou pra você:\n${fichaDoCaso(c)}\n\nResponda *#assumir ${c.numero}* para assumir.`);
    subiram++;
  }
  const lembrados = await esperaTick(sb, cfgs);
  return { subiram, verificados: (casos || []).length, lembrados };
}

// ---------------- PONTE (chamada no início de cada mensagem recebida) ----------------
// Devolve true quando a mensagem foi tratada aqui (o assistente NÃO responde).
type MsgIn = { phone: string; kind: string; text?: string; transcription?: string; mediaId?: string; mimetype?: string; contactName?: string };

// Mídia que passa pela ponte: baixa UMA vez da Meta, GUARDA no Storage (bucket privado arquivozap,
// pasta posvenda/<caso>) pra loja ver no painel, e transcreve áudio. Volta os bytes pra repassar.
type Midia = { bytes: Uint8Array; mime: string; ext: string; tipo: "image" | "audio" | "video" | "document"; ref: string; transcricao: string };
type Transcrever = (b64: string, mime: string) => Promise<string>;
async function prepararMidia(sb: any, m: MsgIn, casoId: string, transcrever?: Transcrever): Promise<Midia | null> {
  if (!m.mediaId) return null;
  const tipo = m.kind === "image" ? "image" : m.kind === "audio" ? "audio" : /^video\//.test(m.mimetype || "") ? "video" : "document";
  try {
    const wa = await loadWaSettings(sb);
    const bin = await metaDownloadMedia(wa, m.mediaId);
    if (!bin) return null;
    const bytes = Uint8Array.from(atob(bin.data), (ch) => ch.charCodeAt(0));
    const mime = bin.media_type || m.mimetype || "application/octet-stream";
    const ext = ((mime.split("/")[1] || "bin").split(";")[0].replace("jpeg", "jpg").replace("quicktime", "mov")).slice(0, 5);
    const path = `posvenda/${casoId}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from("arquivozap").upload(path, bytes, { contentType: mime, upsert: false });
    if (up?.error) console.error("posvenda mídia:", up.error.message);
    let transcricao = "";
    if (tipo === "audio" && transcrever) { try { transcricao = (await transcrever(bin.data, mime)).trim(); } catch (e) { console.error("posvenda transcrição:", e); } }
    return { bytes, mime, ext, tipo, ref: up?.error ? tipo : `${tipo}:${path}`, transcricao };
  } catch (e) { console.error("posvenda mídia:", e); return null; }
}
const ROTULO_MIDIA: Record<string, string> = { image: "📷 foto", audio: "🎤 áudio", video: "🎬 vídeo", document: "📄 arquivo", pdf: "📄 PDF" };
export const rotuloMidia = (ref?: string | null) => ROTULO_MIDIA[String(ref || "").split(":")[0]] || "mídia";
const textoDoLog = (texto: string, md: Midia | null) => [texto, md?.transcricao ? `🎤 "${md.transcricao}"` : ""].filter(Boolean).join("\n") || null;

async function repassar(sb: any, para: string, prefixo: string, m: MsgIn, md: Midia | null): Promise<boolean> {
  const wa = await loadWaSettings(sb);
  const texto = String(m.text || "").trim();
  if (m.mediaId) {
    if (md) {
      const id = await waUploadMedia(wa, md.bytes, md.mime, `arquivo.${md.ext}`);
      if (id) {
        if (md.tipo === "audio") {
          const ok = await waSendMediaId(wa, para, "audio", id);
          if (ok) await waSendText(wa, para, `${prefixo} 🎤 (áudio acima)${md.transcricao ? `\n"${md.transcricao}"` : ""}`);
          return ok;
        }
        return await waSendMediaId(wa, para, md.tipo, id, `${prefixo}${texto ? ` ${texto}` : ""}`, `arquivo.${md.ext}`);
      }
    }
    return await waSendText(wa, para, `${prefixo} (enviou um arquivo que não consegui repassar${texto ? `: ${texto}` : ""})`);
  }
  if (!texto && !m.transcription) return false;
  return await waSendText(wa, para, `${prefixo} ${texto || `🎤 "${m.transcription}"`}`);
}

export async function pontePosvenda(sb: any, m: MsgIn, opts?: { transcrever?: Transcrever }): Promise<boolean> {
  const phone = dig(m.phone);
  if (!phone) return false;
  const texto = String(m.text || m.transcription || "").trim();
  const wa = await loadWaSettings(sb);

  // ---- 1) alguém da EQUIPE ----
  const membro = await membroPorTelefone(sb, phone);
  if (membro) {
    const cmdAssumir = texto.match(/^#?\s*assumir\s*#?\s*(\d+)/i);
    if (cmdAssumir) { await assumir(sb, membro, Number(cmdAssumir[1])); return true; }
    if (/^#casos$/i.test(texto)) {
      const { data: cs } = await sb.from("posvenda_casos").select("numero, customer_name, car_desc, status, nivel")
        .eq("dealership", membro.dealership).in("status", ["aberto", "em_atendimento"]).order("created_at").limit(15);
      await waSendText(wa, phone, cs?.length
        ? `📋 Atendimentos em andamento:\n${cs.map((c: any) => `#${c.numero} · ${c.customer_name || "cliente"}${c.car_desc ? ` (${c.car_desc})` : ""} · ${c.status === "aberto" ? "⏳ sem dono" : "🟢 em atendimento"}`).join("\n")}\n\nPara assumir: *#assumir N*`
        : "Nenhum atendimento em andamento agora. ✅");
      return true;
    }
    const { data: ativos } = await sb.from("posvenda_casos").select("*").eq("agente_id", membro.id).eq("status", "em_atendimento")
      .order("assumido_at", { ascending: false }).limit(1);
    const caso = ativos?.[0];
    if (!caso) return false;                                    // sem caso ativo: segue como usuário normal
    if (/^#?(fim|encerrar)$/i.test(texto)) { await encerrar(sb, caso, membro.nome); return true; }
    if (/^#sair$/i.test(texto)) { await devolver(sb, caso, membro); return true; }
    if (!(await janelaAberta(sb, caso.customer_phone))) {
      await waSendText(wa, phone, `⚠️ ${nomeCurto(caso.customer_name)} está há mais de 24h sem escrever, e a Meta não deixa o Co-pilot mandar mensagem livre agora. Ligue para ele: ${caso.customer_phone}. Quando ele responder, a conversa volta a passar por aqui.`);
      return true;
    }
    const md = await prepararMidia(sb, m, caso.id, opts?.transcrever);
    const ok = await repassar(sb, caso.customer_phone, `*${nomeCurto(membro.nome)} (${caso.dealership}):*`, m, md);
    await logMsg(sb, caso.id, "agente", membro.nome, textoDoLog(texto, md), md?.ref || (m.mediaId ? m.kind : null));
    if (!ok) await waSendText(wa, phone, "⚠️ Não consegui entregar essa mensagem ao cliente. Tente de novo ou ligue para ele.");
    return true;
  }

  // ---- 2) CLIENTE em atendimento → vai pra quem assumiu ----
  const { data: casos } = await sb.from("posvenda_casos").select("*").in("customer_phone", variantesTel(phone))
    .in("status", ["aberto", "em_atendimento", "encerrado"]).order("created_at", { ascending: false }).limit(1);
  const c = casos?.[0];
  if (!c) return false;
  if (c.status === "em_atendimento" && c.agente_id) {
    const { data: ag } = await sb.from("posvenda_equipe").select("*").eq("id", c.agente_id).maybeSingle();
    const md = await prepararMidia(sb, m, c.id, opts?.transcrever);
    await logMsg(sb, c.id, "cliente", c.customer_name, textoDoLog(texto, md), md?.ref || (m.mediaId ? m.kind : null));
    let ok = false;
    if (ag && await janelaAberta(sb, ag.phone)) ok = await repassar(sb, ag.phone, `💬 *${nomeCurto(c.customer_name)}* (#${c.numero}):`, m, md);
    if (!ok) await avisarGrupo(sb, c.dealership, `💬 *#${c.numero}* — ${c.customer_name || "o cliente"} mandou mensagem e não consegui avisar ${ag?.nome || "quem assumiu"} no WhatsApp:\n"${(texto || "(mídia)").slice(0, 500)}"\n${ag?.nome || "Responsável"}, mande qualquer mensagem pro Co-pilot para reabrir a conversa.`);
    return true;
  }
  if (c.status === "aberto") {
    // ainda sem dono: guarda no caso (texto, foto, áudio transcrito — a equipe vê no painel) e deixa o
    // assistente seguir ajudando
    const md = await prepararMidia(sb, m, c.id, opts?.transcrever);
    await logMsg(sb, c.id, "cliente", c.customer_name, textoDoLog(texto, md), md?.ref || (m.mediaId ? m.kind : null));
    return false;
  }
  // encerrado: captura a NOTA (1–5) pedida no fechamento
  if (c.status === "encerrado" && c.nota == null && c.nota_pedida_at && Date.now() - new Date(c.nota_pedida_at).getTime() < 48 * 3600_000) {
    const n = texto.match(/^\s*([1-5])\s*(?:estrelas?|⭐+)?\s*$/i);
    if (!n) return false;
    const nota = Number(n[1]);
    await sb.from("posvenda_casos").update({ nota, nota_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", c.id);
    await logMsg(sb, c.id, "cliente", c.customer_name, `Nota ${nota}`);
    let review = "";
    if (nota >= 4) {
      const { data: ds } = await sb.from("dealership_settings").select("google_review_url").eq("dealership", c.dealership).maybeSingle();
      if (ds?.google_review_url) review = `\n\nSe puder, deixa uma avaliação da ${c.dealership} no Google (leva 30 segundos e ajuda muito):\n${ds.google_review_url}`;
    }
    await waSendText(wa, phone, nota >= 4 ? `Valeu pela nota ${nota}! ⭐ Qualquer coisa do carro, é só me chamar aqui.${review}` : `Obrigado por avisar. Vou pedir pra gerência te dar um retorno. 🙏`);
    if (nota <= 3) await avisarGrupo(sb, c.dealership, `⚠️ *#${c.numero}* recebeu nota *${nota}* de ${c.customer_name || "cliente"}. Vale a gerência ligar: ${c.customer_phone}`);
    return true;
  }
  return false;
}

async function assumir(sb: any, membro: any, numero: number) {
  const wa = await loadWaSettings(sb);
  const { data: c } = await sb.from("posvenda_casos").select("*").eq("numero", numero).maybeSingle();
  if (!c || c.dealership !== membro.dealership) { await waSendText(wa, membro.phone, `Não achei o atendimento #${numero} da ${membro.dealership}.`); return; }
  if (c.status === "encerrado" || c.status === "cancelado") { await waSendText(wa, membro.phone, `O atendimento #${numero} já foi encerrado.`); return; }
  if (c.status === "em_atendimento" && c.agente_id && c.agente_id !== membro.id) {
    const { data: ag } = await sb.from("posvenda_equipe").select("nome").eq("id", c.agente_id).maybeSingle();
    await waSendText(wa, membro.phone, `O atendimento #${numero} já está com ${ag?.nome || "outra pessoa"}. 🙂`);
    return;
  }
  // se a pessoa estava em outro caso, ele continua dela — a ponte usa sempre o ÚLTIMO assumido
  const agora = new Date().toISOString();
  const { data: upd } = await sb.from("posvenda_casos").update({ status: "em_atendimento", agente_id: membro.id, assumido_at: agora, updated_at: agora })
    .eq("id", c.id).in("status", ["aberto", "em_atendimento"]).select("id");
  if (!upd?.length) { await waSendText(wa, membro.phone, `Não consegui assumir o #${numero} agora. Tente de novo.`); return; }
  await logMsg(sb, c.id, "sistema", null, `Assumido por ${membro.nome}.`);
  const { data: ult } = await sb.from("posvenda_mensagens").select("de, autor, texto, midia").eq("caso_id", c.id).eq("de", "cliente")
    .order("created_at", { ascending: false }).limit(3);
  const recentes = (ult || []).reverse().map((x: any) => `• ${x.texto || ""}${x.midia ? ` (${rotuloMidia(x.midia)})` : ""}`).join("\n");
  await waSendText(wa, membro.phone, [
    `✅ Você assumiu o *atendimento #${c.numero}*.`,
    fichaDoCaso(c),
    recentes ? `\nÚltimas do cliente:\n${recentes}` : "",
    `\nA partir de agora, *tudo o que você escrever aqui vai para ${nomeCurto(c.customer_name)}* (foto, áudio e PDF também), com o seu nome.`,
    `• *fim* = encerra e o cliente dá nota`,
    `• *#sair* = devolve o caso para a equipe`,
  ].filter(Boolean).join("\n"));
  if (await janelaAberta(sb, c.customer_phone)) {
    await waSendText(wa, c.customer_phone, `👤 *${nomeCurto(membro.nome)}*, da ${c.dealership}, vai continuar seu atendimento por aqui mesmo. Pode falar com ele nesta conversa. 🙂`);
  } else {
    await waSendText(wa, membro.phone, `⚠️ ${nomeCurto(c.customer_name)} está há mais de 24h sem escrever, então a Meta não deixa o Co-pilot iniciar a conversa. Ligue para ele: ${c.customer_phone}.`);
  }
  await avisarGrupo(sb, c.dealership, `✅ *#${c.numero}* assumido por *${membro.nome}*.`);
}

async function encerrar(sb: any, c: any, quem: string) {
  const wa = await loadWaSettings(sb);
  const agora = new Date().toISOString();
  await sb.from("posvenda_casos").update({ status: "encerrado", encerrado_at: agora, encerrado_por: quem, nota_pedida_at: agora, updated_at: agora }).eq("id", c.id);
  await logMsg(sb, c.id, "sistema", null, `Encerrado por ${quem}.`);
  const agenteTel = (await sb.from("posvenda_equipe").select("phone").eq("id", c.agente_id).maybeSingle()).data?.phone;
  if (agenteTel) await waSendText(wa, agenteTel, `🏁 Atendimento #${c.numero} encerrado. A partir de agora suas mensagens voltam a ser só com o Co-pilot.`);
  if (await janelaAberta(sb, c.customer_phone)) {
    await waSendText(wa, c.customer_phone, `✅ Seu atendimento com ${nomeCurto(quem)} foi encerrado.\n\nFicou resolvido? Me responda com uma nota de *1 a 5* (5 = excelente). Qualquer coisa do carro, é só chamar aqui. 🚗`);
  }
  await avisarGrupo(sb, c.dealership, `🏁 *#${c.numero}* encerrado por *${quem}*.`);
}

async function devolver(sb: any, c: any, membro: any) {
  const wa = await loadWaSettings(sb);
  const agora = new Date().toISOString();
  await sb.from("posvenda_casos").update({ status: "aberto", agente_id: null, nivel_desde: agora, updated_at: agora }).eq("id", c.id);
  await logMsg(sb, c.id, "sistema", null, `Devolvido por ${membro.nome}.`);
  await waSendText(wa, membro.phone, `↩️ Você devolveu o #${c.numero}. Suas mensagens voltam a ser só com o Co-pilot.`);
  await avisarGrupo(sb, c.dealership, `↩️ *#${c.numero}* devolvido por ${membro.nome} — precisa de alguém.\n👉 Assumir: ${linkAssumir(c.numero)}`);
}

// encerrar pelo painel
export async function encerrarPeloPainel(sb: any, casoId: string, quem: string): Promise<boolean> {
  const { data: c } = await sb.from("posvenda_casos").select("*").eq("id", casoId).maybeSingle();
  if (!c || c.status === "encerrado") return false;
  await encerrar(sb, c, quem);
  return true;
}

// ======================= FASE 3 =======================

// ---------------- OPORTUNIDADES (garantia acabando, troca por FIPE em queda, 1 ano de compra…) ----------------
export const TIPO_OPORTUNIDADE: Record<string, { titulo: string; dica: string }> = {
  garantia_vencendo: { titulo: "Garantia acabando", dica: "Ofereça a vistoria de fim de garantia (pega defeito ainda coberto) ou a garantia estendida." },
  troca_fipe: { titulo: "Troca: FIPE em queda", dica: "O carro está perdendo valor mês a mês. Bom momento pra oferecer avaliação na troca por um carro do estoque." },
  aniversario: { titulo: "1 ano de compra", dica: "Parabenize, ofereça a revisão de 1 ano e pergunte se pensa em trocar ou se tem alguém pra indicar." },
  indicacao: { titulo: "Pedir indicação", dica: "Cliente satisfeito: peça uma indicação e a avaliação no Google." },
  outro: { titulo: "Oportunidade", dica: "" },
};

// Registra a oportunidade (1 por tipo+cliente a cada 60 dias) e avisa o grupo, endereçada ao vendedor
// da venda. Só pra loja com o atendimento ligado. Devolve o número (O#) ou null.
export async function registrarOportunidade(sb: any, o: {
  phone: string; tipo: keyof typeof TIPO_OPORTUNIDADE; detalhe: string; nome?: string | null; carro?: string | null; loja?: string | null;
}): Promise<number | null> {
  try {
    const vs = variantesTel(o.phone);
    const phone = vs[vs.length - 1] || dig(o.phone);
    if (!phone) return null;
    let j: any = null;
    for (const c of [phone.slice(-11), phone.slice(-10), phone.slice(-8)]) {
      const { data } = await sb.from("postsale_journeys").select("id, dealership, customer_name, car_desc, vendedor_id")
        .ilike("customer_phone", `%${c}`).order("created_at", { ascending: false }).limit(1);
      if (data?.[0]) { j = data[0]; break; }
    }
    const loja = j?.dealership || o.loja || null;
    if (!loja || !(await atendimentoAtivo(sb, loja))) return null;
    const desde = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data: dup } = await sb.from("posvenda_oportunidades").select("id").in("customer_phone", vs.length ? vs : [phone])
      .eq("tipo", o.tipo).gte("created_at", desde).limit(1);
    if (dup?.length) return null;
    const { data: op, error } = await sb.from("posvenda_oportunidades").insert({
      dealership: loja, tipo: o.tipo, customer_phone: phone, customer_name: o.nome || j?.customer_name || null,
      car_desc: o.carro || j?.car_desc || null, journey_id: j?.id || null, vendedor_id: j?.vendedor_id || null, detalhe: o.detalhe,
    }).select("*").single();
    if (error || !op) return null;
    const vend = j?.vendedor_id ? (await sb.from("posvenda_equipe").select("nome").eq("id", j.vendedor_id).maybeSingle()).data : null;
    const t = TIPO_OPORTUNIDADE[o.tipo] || TIPO_OPORTUNIDADE.outro;
    await avisarGrupo(sb, loja, [
      `💡 *Oportunidade O${op.numero} — ${t.titulo}*`,
      `👤 ${op.customer_name || "Cliente"}${op.car_desc ? ` · ${op.car_desc}` : ""} · ${phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3")}`,
      `🧑‍💼 Para: ${vend?.nome ? `*${vend.nome}* (vendeu o carro)` : "quem puder pegar"}`,
      `📝 ${o.detalhe}`,
      t.dica ? `👉 ${t.dica}` : "",
      `Marque o andamento no painel: Atendimento → Oportunidades.`,
    ].filter(Boolean).join("\n"));
    return Number(op.numero);
  } catch (e) { console.error("oportunidade:", e); return null; }
}

// ---------------- RESPOSTAS PADRÃO DA LOJA (vão no prompt do assistente) ----------------
// Bloco de texto com as respostas oficiais da loja onde o cliente comprou. "" se não houver.
export async function respostasDaLojaPrompt(sb: any, phone: string): Promise<string> {
  try {
    const vs = variantesTel(phone);
    const d = vs[vs.length - 1] || dig(phone);
    if (!d) return "";
    let loja: string | null = null;
    for (const c of [d.slice(-11), d.slice(-10)]) {
      const { data } = await sb.from("postsale_journeys").select("dealership").ilike("customer_phone", `%${c}`).order("created_at", { ascending: false }).limit(1);
      if (data?.[0]?.dealership) { loja = data[0].dealership; break; }
    }
    if (!loja) return "";
    const { data: rs } = await sb.from("posvenda_respostas").select("pergunta, resposta").eq("dealership", loja).eq("ativo", true).order("created_at").limit(40);
    if (!rs?.length) return "";
    let bloco = `\n\nRESPOSTAS OFICIAIS DA ${loja.toUpperCase()} (a loja onde este cliente comprou o carro). Quando a pergunta dele bater com uma destas, responda com esta informação (com suas palavras, curto) em vez de abrir atendimento; se ele ainda precisar de alguém depois disso, aí sim use abrir_atendimento_loja. Não invente nada além disto sobre a loja:\n`;
    for (const r of rs) {
      const linha = `- P: ${String(r.pergunta).trim()}\n  R: ${String(r.resposta).trim()}\n`;
      if (bloco.length + linha.length > 5000) break;
      bloco += linha;
    }
    return bloco;
  } catch { return ""; }
}
