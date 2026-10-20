// MOTOR DO ÓLEO — quando o Co-pilot cobra a troca de óleo e qual é o km certo.
//
// Premissa (4 tempos):
//  1. ÂNCORA  — a última troca {km, data}: vem da preparação da oficina (na venda), do cliente ("troquei o
//               óleo com 52.300", foto da nota) ou de um gasto de troca de óleo. Sem âncora, o Co-pilot pergunta.
//  2. ESTIMA  — km de hoje = última leitura do hodômetro + ritmo real (km/dia medido nas leituras dos últimos
//               180 dias; poucas leituras → mistura com o padrão: 40 km/dia dono, 250 aplicativo).
//  3. CONFIRMA — quando a troca se aproxima e a leitura está velha (>20 dias), pede FOTO DO PAINEL antes de
//               cobrar; com a foto, o km deixa de ser estimado.
//  4. COBRA   — troca vence por KM ou por TEMPO, o que vier primeiro (10.000 km / 12 meses; uso severo de
//               aplicativo: metade do km / 6 meses). Escada: aviso (≤1.000 km ou ≤15 dias) → venceu →
//               atrasada (semanal, até 3x). Venceu e é cliente de loja → oportunidade pro vendedor (a loja indica
//               oficina parceira; ela não tem oficina própria).
//  E FECHA O CICLO: troca registrada (pelo cliente ou por um gasto de troca de óleo) zera o lembrete.

export const TITULO_OLEO = "Troca de óleo e filtro";
export const RE_OLEO = /(ó|o)leo/i;
// gasto que é troca de óleo do MOTOR (não "óleo de cozinha", "óleo do câmbio" conta como óleo mas é raro)
export const RE_GASTO_TROCA_OLEO = /troca\s+de\s+(ó|o)leo|(ó|o)leo\s+(do\s+)?motor|lubrifica(ç|c)(ã|a)o|(ó|o)leo\s+e\s+filtro|filtro\s+de\s+(ó|o)leo/i;
const DIA = 86400000;
const PADRAO_KM_DIA = { dono: 40, pro: 250 };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const hojeIso = () => iso(new Date());
const addMeses = (s: string, n: number) => { const d = new Date(`${String(s).slice(0, 10)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
const addDias = (n: number) => iso(new Date(Date.now() + n * DIA));
const kmBR = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} km`;
const dataBR = (s: string) => String(s).slice(0, 10).split("-").reverse().join("/");

// ---------------- leituras do hodômetro ----------------
// Grava a leitura e sobe o hodômetro do carro (nunca desce: km menor = provável erro de digitação/leitura).
export async function registrarLeitura(sb: any, o: { userId: string; accountId?: string | null; km: number; fonte: string; quando?: string | null }): Promise<void> {
  const km = Math.round(Number(o.km) || 0);
  if (!o.userId || km <= 0 || km > 2_000_000) return;
  const quando = o.quando ? new Date(String(o.quando).length <= 10 ? `${o.quando}T12:00:00Z` : o.quando).toISOString() : new Date().toISOString();
  try { await sb.from("odometro_leituras").insert({ user_id: o.userId, account_id: o.accountId || null, km, lido_em: quando, fonte: o.fonte }); } catch { /* tabela ainda não criada */ }
  if (o.fonte !== "preparacao") await fecharPedidoKm(sb, o.userId, km, quando);
  if (!o.accountId) return;
  try {
    let { data: acc, error: e1 } = await sb.from("accounts").select("hodometro, hodometro_em").eq("id", o.accountId).maybeSingle();
    if (e1) acc = (await sb.from("accounts").select("hodometro").eq("id", o.accountId).maybeSingle()).data; // sem a coluna nova ainda
    if (!acc) return;
    const atual = Number(acc?.hodometro) || 0;
    if (km >= atual) {
      const upd: Record<string, unknown> = { hodometro: km };
      if (!acc?.hodometro_em || new Date(acc.hodometro_em).getTime() <= new Date(quando).getTime()) upd.hodometro_em = quando;
      const { error } = await sb.from("accounts").update(upd).eq("id", o.accountId);
      if (error) await sb.from("accounts").update({ hodometro: km }).eq("id", o.accountId); // sem a coluna nova ainda
    }
  } catch { /* */ }
}

// Rotina de km (km.ts): leitura que chega fecha o pedido de km pendente como RESPONDIDO.
export async function fecharPedidoKm(sb: any, userId: string, km: number, quando: string): Promise<void> {
  try {
    const { data } = await sb.from("km_pedidos").select("id, pedido_em").eq("user_id", userId).eq("status", "pendente").limit(1);
    const p = data?.[0];
    // leitura antiga lançada agora (gasto com data de semanas atrás) não conta como resposta
    if (!p || new Date(quando).getTime() < new Date(p.pedido_em).getTime() - DIA) return;
    await sb.from("km_pedidos").update({ status: "respondido", respondido_em: new Date().toISOString(), km_resposta: Math.round(km) }).eq("id", p.id);
  } catch { /* tabela ainda não criada */ }
}

// pontos (km, data) dos últimos 365 dias: leituras + km dos gastos (inclusive os lançados pelo app)
// + a última troca de óleo (km e data conhecidos = ponto confiável)
function limpar(out: { km: number; t: number }[]): { km: number; t: number }[] {
  out.sort((a, b) => a.t - b.t || a.km - b.km);
  // descarta leitura que "volta" o km (erro de digitação) — o odômetro só cresce
  const limpo: { km: number; t: number }[] = [];
  for (const p of out) if (!limpo.length || p.km >= limpo[limpo.length - 1].km) limpo.push(p);
  return limpo;
}
async function pontos(sb: any, userId: string): Promise<{ km: number; t: number }[]> {
  const desde = new Date(Date.now() - 365 * DIA);
  const out: { km: number; t: number }[] = [];
  try {
    const { data } = await sb.from("odometro_leituras").select("km, lido_em").eq("user_id", userId).gte("lido_em", desde.toISOString()).limit(500);
    for (const r of data || []) out.push({ km: Number(r.km), t: new Date(r.lido_em).getTime() });
  } catch { /* */ }
  try {
    const { data } = await sb.from("transactions").select("odometer, transaction_date").eq("user_id", userId).gt("odometer", 0)
      .gte("transaction_date", iso(desde)).limit(500);
    for (const r of data || []) out.push({ km: Number(r.odometer), t: new Date(`${r.transaction_date}T12:00:00Z`).getTime() });
  } catch { /* */ }
  return limpar(out);
}

export type Ritmo = { kmDia: number; fonte: "medido" | "misto" | "padrao"; dias: number; leituras: number };
// km/dia pelo histórico; pouco histórico (<30 dias entre a 1ª e a última leitura) mistura com o padrão
export async function ritmoKmDia(sb: any, userId: string, isPro: boolean, pts?: { km: number; t: number }[]): Promise<Ritmo> {
  const padrao = isPro ? PADRAO_KM_DIA.pro : PADRAO_KM_DIA.dono;
  const p = pts || await pontos(sb, userId);
  if (p.length < 2) return { kmDia: padrao, fonte: "padrao", dias: 0, leituras: p.length };
  const dias = (p[p.length - 1].t - p[0].t) / DIA;
  if (dias < 3) return { kmDia: padrao, fonte: "padrao", dias: Math.round(dias), leituras: p.length };
  const medido = (p[p.length - 1].km - p[0].km) / dias;
  if (!(medido > 0 && medido < 1500)) return { kmDia: padrao, fonte: "padrao", dias: Math.round(dias), leituras: p.length };
  const w = Math.min(1, dias / 30);
  return { kmDia: Math.round((w * medido + (1 - w) * padrao) * 10) / 10, fonte: w >= 1 ? "medido" : "misto", dias: Math.round(dias), leituras: p.length };
}

// última leitura confiável (maior km) e quando foi lida
async function ultimaLeitura(sb: any, accountId: string | null | undefined, pts: { km: number; t: number }[]): Promise<{ km: number; em: number | null }> {
  let acc: any = null;
  if (accountId) {
    try { acc = (await sb.from("accounts").select("hodometro, hodometro_em, created_at").eq("id", accountId).maybeSingle()).data; } catch { /* */ }
    if (!acc) { try { acc = (await sb.from("accounts").select("hodometro, created_at").eq("id", accountId).maybeSingle()).data; } catch { /* */ } }
  }
  const ultPt = pts.length ? pts[pts.length - 1] : null;
  const hod = Number(acc?.hodometro) || 0;
  const hodEm = acc?.hodometro_em ? new Date(acc.hodometro_em).getTime() : null;
  if (ultPt && ultPt.km >= hod) return { km: ultPt.km, em: ultPt.t };
  if (hod > 0) return { km: hod, em: hodEm ?? (ultPt ? ultPt.t : null) };
  return { km: ultPt?.km || 0, em: ultPt?.t ?? null };
}

// lembrete de óleo do carro: o desta conta; senão um sem conta (cadastro antigo); maior km primeiro
export function lembreteOleo(rems: any[] | null | undefined, accountId?: string | null): any | null {
  const oleo = (rems || []).filter((r: any) => RE_OLEO.test(String(r.title || "")));
  const doCarro = oleo.filter((r: any) => accountId && r.account_id === accountId);
  const pool = doCarro.length ? doCarro : oleo.filter((r: any) => !r.account_id || !accountId);
  return pool.sort((a: any, b: any) => Number(b.last_km || 0) - Number(a.last_km || 0))[0] || null;
}

export type EstadoOleo = {
  ativo: boolean;                         // existe âncora (lembrete de óleo)
  lembreteId: string | null; ciclo: string | null;
  intervaloKm: number; intervaloMeses: number; severo: boolean;
  ultimaTroca: { km: number; data: string } | null;
  leitura: { km: number; em: string | null; diasAtras: number | null };
  ritmo: Ritmo;
  kmHoje: number;                         // estimado (= leitura se for de hoje)
  proximaKm: number | null; faltamKm: number | null;
  proximaData: string | null; faltamDias: number | null; vencePor: "km" | "tempo" | null;
  status: "sem_ancora" | "em_dia" | "proxima" | "vencida" | "atrasada";
  leituraVelha: boolean; precisaConfirmarKm: boolean;
};

export async function estadoOleo(sb: any, user: any, vehicle: any): Promise<EstadoOleo> {
  const userId = String(user?.id || "");
  const severo = !!user?.driver_mode;
  let rem: any = null;
  try {
    const { data } = await sb.from("maintenance_reminders").select("*").eq("user_id", userId).eq("active", true);
    rem = lembreteOleo(data, vehicle?.id);
  } catch { /* */ }
  let pts = userId ? await pontos(sb, userId) : [];
  const remT = rem?.last_date ? new Date(`${String(rem.last_date).slice(0, 10)}T12:00:00Z`).getTime() : NaN;
  if (Number(rem?.last_km) > 0 && remT > Date.now() - 365 * DIA) pts = limpar([...pts, { km: Number(rem.last_km), t: remT }]);
  const ritmo = await ritmoKmDia(sb, userId, severo, pts);
  const leit = await ultimaLeitura(sb, vehicle?.id, pts);
  const diasAtras = leit.em != null ? Math.max(0, (Date.now() - leit.em) / DIA) : null;
  let kmHoje = Math.round(leit.km + (diasAtras ?? 0) * ritmo.kmDia);

  const base: EstadoOleo = {
    ativo: !!rem, lembreteId: rem?.id || null, ciclo: rem ? `${rem.id}:${Math.round(Number(rem.last_km) || 0)}` : null,
    intervaloKm: 10000, intervaloMeses: 12, severo, ultimaTroca: null,
    leitura: { km: leit.km, em: leit.em != null ? new Date(leit.em).toISOString() : null, diasAtras: diasAtras != null ? Math.round(diasAtras) : null },
    ritmo, kmHoje, proximaKm: null, faltamKm: null, proximaData: null, faltamDias: null, vencePor: null,
    status: "sem_ancora", leituraVelha: diasAtras == null || diasAtras > 20, precisaConfirmarKm: false,
  };
  if (!rem) return base;

  let intervaloKm = Number(rem.interval_km) || 10000;
  let intervaloMeses = Number(rem.interval_meses) || 12;
  if (severo) { intervaloKm = Math.max(3000, Math.round((intervaloKm * 0.5) / 500) * 500); intervaloMeses = Math.min(intervaloMeses, 6); }
  const ultKm = Number(rem.last_km) || 0;
  const ultData = String(rem.last_date || rem.created_at || hojeIso()).slice(0, 10);
  kmHoje = Math.max(kmHoje, ultKm);
  const proximaKm = ultKm + intervaloKm;
  const faltamKm = Math.round(proximaKm - kmHoje);
  const dataKm = addDias(Math.round(faltamKm / Math.max(1, ritmo.kmDia)));
  const dataTempo = addMeses(ultData, intervaloMeses);
  const vencePor: "km" | "tempo" = dataTempo < dataKm ? "tempo" : "km";
  const proximaData = vencePor === "tempo" ? dataTempo : dataKm;
  const faltamDias = Math.round((new Date(`${proximaData}T12:00:00Z`).getTime() - new Date(`${hojeIso()}T12:00:00Z`).getTime()) / DIA);
  const status: EstadoOleo["status"] =
    (faltamKm <= -1000 || faltamDias <= -30) ? "atrasada"
    : (faltamKm <= 0 || faltamDias <= 0) ? "vencida"
    : (faltamKm <= 1000 || faltamDias <= 15) ? "proxima" : "em_dia";
  return {
    ...base, intervaloKm, intervaloMeses, ultimaTroca: { km: ultKm, data: ultData }, kmHoje,
    proximaKm, faltamKm, proximaData, faltamDias, vencePor, status,
    // vai vencer pelo KM e a leitura é velha → confirma o km com foto do painel antes de cobrar
    // (margem de 2.000 km: quanto mais velha a leitura, maior o erro da estimativa)
    precisaConfirmarKm: base.leituraVelha && vencePor === "km" && (status !== "em_dia" || faltamKm <= 2000),
  };
}

// Troca feita (cliente, gasto de troca de óleo, oficina): zera o ciclo — novo lembrete a partir deste km.
export async function registrarTrocaOleo(sb: any, o: { userId: string; accountId?: string | null; km: number; data?: string | null; intervaloKm?: number | null; intervaloMeses?: number | null; fonte?: string }): Promise<{ ok: boolean; proximaKm?: number; proximaData?: string }> {
  const km = Math.round(Number(o.km) || 0);
  if (!o.userId || km <= 0) return { ok: false };
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(o.data || "")) && String(o.data) <= hojeIso() ? String(o.data) : hojeIso();
  const { data: rems } = await sb.from("maintenance_reminders").select("*").eq("user_id", o.userId).eq("active", true);
  const rem = lembreteOleo(rems, o.accountId);
  const intervaloKm = Math.round(Number(o.intervaloKm) || Number(rem?.interval_km) || 10000);
  const intervaloMeses = Math.round(Number(o.intervaloMeses) || Number(rem?.interval_meses) || 12);
  const row: Record<string, unknown> = { last_km: km, last_date: data, interval_km: intervaloKm, interval_meses: intervaloMeses, updated_at: new Date().toISOString() };
  let r = rem
    ? await sb.from("maintenance_reminders").update(row).eq("id", rem.id)
    : await sb.from("maintenance_reminders").insert({ user_id: o.userId, account_id: o.accountId || null, title: TITULO_OLEO, active: true, ...row });
  if (r?.error) { // banco sem a coluna interval_meses ainda
    delete row.interval_meses;
    r = rem ? await sb.from("maintenance_reminders").update(row).eq("id", rem.id)
      : await sb.from("maintenance_reminders").insert({ user_id: o.userId, account_id: o.accountId || null, title: TITULO_OLEO, active: true, ...row });
    if (r?.error) return { ok: false };
  }
  await registrarLeitura(sb, { userId: o.userId, accountId: o.accountId, km, fonte: o.fonte || "troca_oleo", quando: data });
  return { ok: true, proximaKm: km + intervaloKm, proximaData: addMeses(data, intervaloMeses) };
}

// resumo legível (ferramenta do assistente / painel)
export function resumoOleo(e: EstadoOleo): string {
  if (!e.ativo || !e.ultimaTroca) return "Sem registro da última troca de óleo.";
  const est = e.leitura.diasAtras && e.leitura.diasAtras > 1 ? `≈${kmBR(e.kmHoje)} hoje (estimado; última leitura ${kmBR(e.leitura.km)} há ${e.leitura.diasAtras} dias)` : `${kmBR(e.kmHoje)} hoje`;
  const prazo = e.vencePor === "tempo" ? `até ${dataBR(e.proximaData!)} (12 meses${e.severo ? "/uso severo" : ""})` : `aos ${kmBR(e.proximaKm!)} (≈${dataBR(e.proximaData!)})`;
  const sit = e.status === "em_dia" ? `faltam ${kmBR(e.faltamKm!)}` : e.status === "proxima" ? `faltam ${kmBR(Math.max(0, e.faltamKm!))}` : e.status === "vencida" ? "venceu" : "atrasada";
  return `Última troca: ${kmBR(e.ultimaTroca.km)} em ${dataBR(e.ultimaTroca.data)}. Km: ${est}. Próxima troca ${prazo} — ${sit}.`;
}

// ---------------- decisão diária (cron) ----------------
export type AcaoOleo = { acao: "ancora" | "confirmar_km" | "aviso" | "vencida" | "atrasada"; variante: string; estado: EstadoOleo; fallback: string };

// Decide se hoje tem mensagem de óleo pra este cliente e já grava o dedup (notification_log).
export async function oleoTick(sb: any, u: any, v: any): Promise<AcaoOleo | null> {
  if (!u?.id || !v?.id) return null;
  const e = await estadoOleo(sb, u, v);
  const dedup = async (kind: string, due: string) => {
    const { error } = await sb.from("notification_log").insert({ user_id: u.id, kind, due_date: due, channel: "whatsapp" });
    return !error;
  };
  const seg = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); })();
  const carro = v?.name || "seu carro";

  const cansado = Number(u.proactive_unanswered) >= 3; // ignorou as últimas: só fala o que é urgente
  if (!e.ativo) {
    if (cansado) return null;
    // sem âncora: pergunta a última troca (no máximo 1x a cada 3 meses; só pra carro com mais de 7 dias)
    const criado = v?.created_at ? new Date(v.created_at).getTime() : 0;
    if (criado && Date.now() - criado < 7 * DIA) return null;
    const tri = `${hojeIso().slice(0, 4)}-${String(Math.floor(new Date().getUTCMonth() / 3) * 3 + 1).padStart(2, "0")}-01`;
    if (!(await dedup("oleo:ancora", tri))) return null;
    return { acao: "ancora", variante: "copilot_msg", estado: e, fallback: `Pra eu te avisar a troca de óleo do ${carro} na hora certa: com quantos km foi a última troca (ou em que mês)? Se tiver o adesivo da oficina no para-brisa ou a nota, pode mandar a foto.` };
  }
  const due = String(e.ultimaTroca?.data || "2000-01-01");
  const c = e.ciclo!;
  // km estimado com leitura velha: pede a FOTO DO PAINEL 1x no ciclo e dá 3 dias pra ele mandar antes de cobrar
  if (e.precisaConfirmarKm) {
    if (await dedup(`oleo:confirmar:${c}`, due)) {
      const ja = e.status === "vencida" || e.status === "atrasada";
      return { acao: "confirmar_km", variante: "copilot_msg", estado: e, fallback: ja
        ? `Pela minha conta a troca de óleo do ${carro} já chegou (aos ${kmBR(e.proximaKm!)}). Me manda uma foto do painel com o km pra eu confirmar?`
        : `A troca de óleo do ${carro} está chegando (pela minha conta, faltam ~${kmBR(Math.max(0, e.faltamKm!))}). Me manda uma foto do painel com o km pra eu confirmar certinho?` };
    }
    const { data: pc } = await sb.from("notification_log").select("*").eq("user_id", u.id).eq("kind", `oleo:confirmar:${c}`).limit(1);
    const quando = pc?.[0]?.created_at || pc?.[0]?.sent_at;
    if (quando && Date.now() - new Date(quando).getTime() < 3 * DIA) return null;
  }
  if (e.status === "em_dia") return null; // a leitura de rotina é da km.ts (a cada 10 dias)
  if (e.status === "proxima") {
    if (!(await dedup(`oleo:aviso:${c}`, due))) return null;
    return { acao: "aviso", variante: "copilot_msg_sim", estado: e, fallback: `A troca de óleo do ${carro} está chegando: ${e.vencePor === "tempo" ? `vence em ${dataBR(e.proximaData!)}` : `faltam ~${kmBR(Math.max(0, e.faltamKm!))} (aos ${kmBR(e.proximaKm!)})`}. Quer ajuda pra resolver?` };
  }
  if (e.status === "vencida") {
    if (!(await dedup(`oleo:vencida:${c}`, due))) return null;
    return { acao: "vencida", variante: "copilot_msg_feito", estado: e, fallback: `Chegou a hora da troca de óleo do ${carro} (${e.vencePor === "tempo" ? `12 meses desde ${dataBR(e.ultimaTroca!.data)}` : `aos ${kmBR(e.proximaKm!)}`}). Já trocou? Se não, eu te ajudo a resolver.` };
  }
  // atrasada: 1x por semana, no máximo 3 vezes no ciclo
  const { data: ja } = await sb.from("notification_log").select("id").eq("user_id", u.id).like("kind", `oleo:atrasada:${c}%`).limit(5);
  if ((ja || []).length >= 3) return null;
  if (!(await dedup(`oleo:atrasada:${c}:${seg}`, seg))) return null;
  return { acao: "atrasada", variante: "copilot_msg_feito", estado: e, fallback: `A troca de óleo do ${carro} está atrasada (passou de ${kmBR(e.proximaKm!)}${e.vencePor === "tempo" ? ` / ${dataBR(e.proximaData!)}` : ""}). Óleo vencido desgasta o motor. Já trocou? Se não, eu te ajudo a resolver.` };
}

// insight pro compositor proativo (a IA escreve; os números vêm daqui)
export function insightOleo(a: AcaoOleo, loja?: string | null): Record<string, unknown> {
  const e = a.estado;
  const instrucao: Record<string, string> = {
    ancora: "Pergunte, numa mensagem curta, com quantos km (ou em que mês) foi a última troca de óleo. Ofereça mandar foto do adesivo da oficina ou da nota. Diga que com isso você avisa a próxima na hora certa.",
    confirmar_km: "A troca de óleo está chegando pela ESTIMATIVA. Peça uma FOTO DO PAINEL com o km pra confirmar antes de marcar. Deixe claro que o número é estimado.",
    aviso: `Avise que a troca de óleo está chegando (${e.vencePor === "tempo" ? "pelo tempo" : "pelo km"}) e ofereça ajuda pra fazer na oficina de confiança dele${loja ? ` (se ele não tiver, a ${loja} indica oficinas parceiras)` : ""}. Nunca diga que a loja faz a troca. Use a variante copilot_msg_sim.`,
    vencida: `Diga que chegou a hora da troca de óleo e pergunte se já trocou; se não, ofereça ajuda pra fazer na oficina de confiança dele${loja ? ` (sem oficina, a ${loja} indica uma parceira)` : ""}. Nunca diga que a loja faz a troca. Use a variante copilot_msg_feito.`,
    atrasada: `A troca está atrasada. Seja direto e cuidadoso (óleo vencido desgasta o motor), pergunte se já trocou e ofereça ajuda${loja ? ` (a ${loja} indica oficinas parceiras, se ele precisar)` : ""}. Nunca diga que a loja faz a troca. Use a variante copilot_msg_feito.`,
  };
  return {
    tipo: "troca_oleo", estagio: a.acao, variante_sugerida: a.variante, instrucao: instrucao[a.acao],
    ultima_troca: e.ultimaTroca, proxima_troca_km: e.proximaKm, data_prevista: e.proximaData, vence_por: e.vencePor,
    faltam_km: e.faltamKm, km_estimado_hoje: e.kmHoje, ultima_leitura: e.leitura, ritmo_km_dia: e.ritmo.kmDia, fonte_ritmo: e.ritmo.fonte,
    uso_severo: e.severo, intervalo: `${e.intervaloKm} km ou ${e.intervaloMeses} meses`, loja_indica_oficinas_parceiras: loja || null, loja_tem_oficina_propria: false,
    observacao: "Números calculados em código. Quando o km for estimado, diga 'pela minha conta'/'aproximadamente'.",
  };
}
