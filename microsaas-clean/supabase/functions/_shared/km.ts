// ROTINA DE KM — a cada 10 dias o Co-pilot pede a atualização do hodômetro e CONTROLA se o cliente registrou.
//
//  D0   PEDIDO   — sem leitura há 10+ dias: "me manda a foto do painel (ou digita o km)".
//  D+2  REFORÇO  — não registrou em 48h: peça visual "Registro de km pendente" (imagem), 1x por pedido.
//  D+10 IGNORADO — não registrou no ciclo: o pedido fecha como ignorado e o próximo ciclo começa.
//  3 ciclos ignorados seguidos → a loja é avisada (oportunidade no grupo) e o ritmo cai pra 20 dias
//  (protege o número de denúncia de spam sem largar o cliente).
//
// Qualquer leitura (foto do painel, km digitado, gasto com km, troca de óleo) fecha o pedido como
// RESPONDIDO — é isso que mede quem cumpre o processo (painel da loja: "km em dia" / "não registra").

import { estadoOleo, fecharPedidoKm, type EstadoOleo } from "./oleo.ts";
export { fecharPedidoKm };

export const CICLO_DIAS = 10;
export const CICLO_LENTO_DIAS = 20;
export const REFORCO_HORAS = 48;
export const IMAGEM_REGISTRO_KM = "https://copilot.totexmotors.com/wa/registro-km.jpg";
const DIA = 86400000;
const kmBR = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} km`;

export type AcaoKm = {
  acao: "pedido" | "reforco"; pedidoId: string; estado: EstadoOleo; diasSemLeitura: number | null;
  ignoradosSeguidos: number; avisarLoja: boolean; texto: string;
};

async function ultimosPedidos(sb: any, userId: string, n = 6): Promise<any[]> {
  const { data, error } = await sb.from("km_pedidos").select("*").eq("user_id", userId).order("pedido_em", { ascending: false }).limit(n);
  if (error) throw error; // tabela ainda não criada → rotina desligada
  return data || [];
}
const seguidosIgnorados = (ps: any[]) => { let n = 0; for (const p of ps) { if (p.status === "ignorado") n++; else if (p.status === "respondido") break; } return n; };

// Abre um pedido de km (no máximo 1 pendente por cliente — índice único parcial no banco).
export async function abrirPedidoKm(sb: any, userId: string, accountId?: string | null): Promise<string | null> {
  try {
    const { data, error } = await sb.from("km_pedidos").insert({ user_id: userId, account_id: accountId || null, status: "pendente" }).select("id").single();
    return error ? null : data?.id || null;
  } catch { return null; }
}

// Decide a ação de km de hoje pro cliente (e já grava o estado do pedido). null = nada hoje.
export async function kmTick(sb: any, u: any, v: any): Promise<AcaoKm | null> {
  if (!u?.id || !v?.id) return null;
  const criado = v?.created_at ? new Date(v.created_at).getTime() : 0;
  if (criado && Date.now() - criado < 2 * DIA) return null; // acabou de cadastrar o carro
  let ps: any[];
  try { ps = await ultimosPedidos(sb, u.id); } catch { return null; }
  const e = await estadoOleo(sb, u, v);
  const leituraT = e.leitura.em ? new Date(e.leitura.em).getTime() : 0;
  const carro = v?.name || "seu carro";
  const oleoTxt = e.ativo && e.faltamKm != null
    ? (e.faltamKm <= 0 ? " A troca de óleo já chegou pela minha conta, então o km certo é importante agora." : e.faltamKm <= 2000 ? ` A troca de óleo está chegando (faltam ~${kmBR(e.faltamKm)}).` : "")
    : "";

  let pend = ps.find((p) => p.status === "pendente") || null;
  if (pend) {
    const pedidoT = new Date(pend.pedido_em).getTime();
    if (leituraT && leituraT >= pedidoT - DIA) { // respondeu por um caminho que não fechou o pedido
      await sb.from("km_pedidos").update({ status: "respondido", respondido_em: new Date(leituraT).toISOString(), km_resposta: e.leitura.km }).eq("id", pend.id);
      return null;
    }
    const idade = Date.now() - pedidoT;
    if (idade >= CICLO_DIAS * DIA) {
      await sb.from("km_pedidos").update({ status: "ignorado" }).eq("id", pend.id).eq("status", "pendente");
      pend.status = "ignorado";
      pend = null; // segue pra abrir o próximo ciclo
    } else if (!pend.reforco_em && idade >= REFORCO_HORAS * 3600000) {
      const agora = new Date().toISOString();
      const { data: claim } = await sb.from("km_pedidos").update({ reforco_em: agora }).eq("id", pend.id).is("reforco_em", null).select("id");
      if (!claim?.length) return null; // outra rodada já mandou
      const dias = e.leitura.diasAtras;
      return {
        acao: "reforco", pedidoId: pend.id, estado: e, diasSemLeitura: dias, ignoradosSeguidos: seguidosIgnorados(ps), avisarLoja: false,
        texto: `o ${carro} está sem atualização de quilometragem${dias != null ? ` há ${dias} dias` : ""} e eu ainda não recebi o km que pedi.${oleoTxt}`,
      };
    } else return null;
  }

  // sem pedido aberto: abre o próximo ciclo quando a última leitura tem 10+ dias
  const diasLeitura = leituraT ? (Date.now() - leituraT) / DIA : null;
  const ign = seguidosIgnorados(ps);
  const ciclo = ign > 3 ? CICLO_LENTO_DIAS : CICLO_DIAS; // 3º ignorado ainda gera o pedido (com aviso à loja); dali em diante, 20 dias
  if (diasLeitura != null && diasLeitura < CICLO_DIAS) return null;
  const ultimo = ps[0];
  if (ultimo && Date.now() - new Date(ultimo.pedido_em).getTime() < ciclo * DIA) return null;
  const id = await abrirPedidoKm(sb, u.id, v.id);
  if (!id) return null;
  const dias = diasLeitura != null ? Math.round(diasLeitura) : null;
  return {
    acao: "pedido", pedidoId: id, estado: e, diasSemLeitura: dias, ignoradosSeguidos: ign, avisarLoja: ign === 3,
    texto: `Atualização de km do ${carro} 📸 Me manda uma foto do painel com o km (ou digita o número).${e.ativo && dias ? ` Pela minha conta ele está com ~${kmBR(e.kmHoje)}.` : ""}${oleoTxt} É com o km certo que eu aviso a troca de óleo e as revisões na hora certa.`,
  };
}

// Insight pro compositor proativo (pedido de km). O reforço vai como imagem, sem IA.
export function insightKm(a: AcaoKm): Record<string, unknown> {
  const e = a.estado;
  return {
    tipo: "atualizacao_km", rotina: `a cada ${CICLO_DIAS} dias`,
    instrucao: "Peça a ATUALIZAÇÃO DO KM: foto do painel mostrando a quilometragem (ou o número digitado). Diga em 1 frase que é a checagem de rotina e que é com o km que você acerta a troca de óleo e as revisões. Curto, direto, sem tom de cobrança. Se a troca estiver perto, mencione com os números do insight (estimados = 'pela minha conta').",
    dias_sem_leitura: a.diasSemLeitura, km_estimado_hoje: e.ativo ? e.kmHoje : null, ultima_leitura: e.leitura,
    troca_oleo: e.ativo ? { proxima_km: e.proximaKm, faltam_km: e.faltamKm, data_limite: e.proximaData, status: e.status } : null,
    pedidos_ignorados_seguidos: a.ignoradosSeguidos,
  };
}

// Controle por cliente (painel da loja): pedidos/respostas dos últimos 90 dias.
export async function controleKm(sb: any, userIds: string[]): Promise<Record<string, { pedidos: number; respondidos: number; ignorados_seguidos: number; pendente_desde: string | null; reforco: boolean }>> {
  const out: Record<string, any> = {};
  if (!userIds.length) return out;
  try {
    const desde = new Date(Date.now() - 90 * DIA).toISOString();
    const { data, error } = await sb.from("km_pedidos").select("user_id, status, pedido_em, reforco_em").in("user_id", userIds).gte("pedido_em", desde).limit(5000);
    if (error) return out;
    const por: Record<string, any[]> = {};
    for (const r of data || []) (por[r.user_id] ||= []).push(r);
    for (const [uid, rs] of Object.entries(por)) {
      rs.sort((a, b) => String(b.pedido_em).localeCompare(String(a.pedido_em)));
      const pend = rs.find((r) => r.status === "pendente");
      out[uid] = {
        pedidos: rs.length, respondidos: rs.filter((r) => r.status === "respondido").length,
        ignorados_seguidos: seguidosIgnorados(rs), pendente_desde: pend?.pedido_em || null, reforco: !!pend?.reforco_em,
      };
    }
  } catch { /* */ }
  return out;
}
