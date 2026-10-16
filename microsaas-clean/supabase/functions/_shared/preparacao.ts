// PREPARAÇÃO DO CARRO ANTES DA VENDA → ponto zero do motor de manutenção do Co-pilot.
// O gerente de manutenção registra no painel a troca de óleo + filtro (e o km) feita na preparação.
// Na venda, a preparação fica ligada à jornada (postsale_journeys.preparacao_id) e, assim que o cliente
// tem conta/carro no Co-pilot, vira o lembrete "Troca de óleo e filtro" com última troca = km da
// preparação. Daí em diante o Co-pilot projeta a próxima troca pelo ritmo de uso do cliente.

import { TITULO_OLEO, lembreteOleo, registrarLeitura } from "./oleo.ts";
export { TITULO_OLEO };
const dataBR = (s: unknown) => { const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s ?? ""); };
const km = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} km`;

// última preparação registrada pra um carro do estoque (ou pela placa)
export async function preparacaoDoCarro(sb: any, loja: string, o: { vehicleId?: string | null; placa?: string | null }): Promise<any | null> {
  if (o.vehicleId) {
    const { data } = await sb.from("preparacao_veiculos").select("*").eq("dealership", loja).eq("vehicle_id", String(o.vehicleId))
      .order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1);
    if (data?.[0]) return data[0];
  }
  const placa = String(o.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (placa.length >= 7) {
    const { data } = await sb.from("preparacao_veiculos").select("*").eq("dealership", loja).eq("placa", placa)
      .order("data", { ascending: false }).limit(1);
    if (data?.[0]) return data[0];
  }
  return null;
}

// frase pro cliente: "saiu revisado: óleo e filtro trocados em 10/10/2026 com 48.200 km. Próxima: 58.200 km."
export function textoPreparacao(p: any, loja?: string | null): string {
  if (!p) return "";
  const itens = [p.oleo ? "óleo" : "", p.filtro_oleo ? "filtro de óleo" : "", p.filtro_ar ? "filtro de ar" : "", p.filtro_combustivel ? "filtro de combustível" : "", p.filtro_cabine ? "filtro de cabine" : ""].filter(Boolean);
  const lista = itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}` : itens[0] || "revisão";
  return `🛠️ Ele saiu revisado${loja ? ` da ${loja}` : ""}: ${lista} trocados em ${dataBR(p.data)}, com ${km(p.km)}. Próxima troca de óleo: ${km(Number(p.km) + Number(p.intervalo_km || 10000))}, e eu te aviso antes.`;
}

// Cria/atualiza o lembrete de troca de óleo do cliente a partir da preparação e acerta o hodômetro.
// Idempotente: se o cliente já registrou uma troca MAIS NOVA, não mexe. Marca a jornada como aplicada.
export async function aplicarPreparacao(sb: any, o: { userId: string; accountId?: string | null; journeyId?: string | null; prep: any }): Promise<boolean> {
  const p = o.prep;
  if (!o.userId || !p?.km) return false;
  try {
    const { data: rems } = await sb.from("maintenance_reminders").select("id, last_km, title, account_id").eq("user_id", o.userId).eq("active", true);
    const oleo = lembreteOleo(rems, o.accountId);
    const row = { interval_km: Number(p.intervalo_km) || 10000, last_km: Number(p.km), last_date: p.data };
    if (!oleo) {
      const ins = { user_id: o.userId, account_id: o.accountId || null, title: TITULO_OLEO, active: true, ...row };
      const { error } = await sb.from("maintenance_reminders").insert({ ...ins, interval_meses: 12 });
      if (error) await sb.from("maintenance_reminders").insert(ins); // banco sem interval_meses ainda
    } else if (Number(oleo.last_km || 0) < Number(p.km)) {
      await sb.from("maintenance_reminders").update({ ...row, updated_at: new Date().toISOString() }).eq("id", oleo.id);
    }
    // leitura do hodômetro na data da preparação (sobe o km do carro, nunca desce) → base da estimativa
    await registrarLeitura(sb, { userId: o.userId, accountId: o.accountId, km: Number(p.km), fonte: "preparacao", quando: p.data });
    if (o.journeyId) await sb.from("postsale_journeys").update({ prep_aplicada: true }).eq("id", o.journeyId);
    return true;
  } catch (e) { console.error("aplicarPreparacao:", e); return false; }
}

// Aplica a preparação ligada à jornada (se houver e ainda não aplicada). Usado na ativação da etiqueta,
// na cortesia (conta criada na hora) e no cron diário (fallback pra quem entrou por outro caminho).
export async function aplicarPreparacaoDaJornada(sb: any, j: any, userId: string, accountId?: string | null): Promise<any | null> {
  if (!j?.preparacao_id || j.prep_aplicada) return null;
  const { data: p } = await sb.from("preparacao_veiculos").select("*").eq("id", j.preparacao_id).maybeSingle();
  if (!p) return null;
  let acc = accountId || null;
  if (!acc) {
    const { data: a } = await sb.from("accounts").select("id").eq("user_id", userId).eq("is_active", true).limit(1);
    acc = a?.[0]?.id || null;
  }
  return (await aplicarPreparacao(sb, { userId, accountId: acc, journeyId: j.id, prep: p })) ? p : null;
}
