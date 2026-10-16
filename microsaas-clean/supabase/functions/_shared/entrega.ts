// CHECKLIST DE ENTREGA — o vendedor ativa a etiqueta junto com o comprador e o Co-pilot conduz a conferência:
//  1. FOTO DO PAINEL com o carro ligado → km da entrega + nenhuma luz de alerta (a IA lê a foto)
//  2. ITENS de entrega com 1 toque → "✅ Tudo certo" (o OK do cliente, com data, hora e km) ou "⚠️ Tem problema"
// O registro é a prova de que o carro saiu em condições de uso. Tudo certo → avisa o grupo e pede a
// avaliação no Google (cliente acabou de confirmar que está tudo bem). Problema → grupo avisado na hora.

import { avisarGrupo, variantesTel } from "./posvenda.ts";

export const ITENS_ENTREGA = [
  "Carro liga normalmente (bateria ok)",
  "Painel sem luz de alerta acesa",
  "Pneus em bom estado, com estepe, macaco, chave de roda e triângulo",
  "Faróis, setas, luz de freio e de ré funcionando",
  "Ar-condicionado e limpador funcionando",
  "Lataria e interior conferidos",
  "Chaves e manual entregues",
];
export const BTN_ENTREGA_OK = "✅ Tudo certo";
export const BTN_ENTREGA_PROBLEMA = "⚠️ Tem problema";
const ABERTOS = ["aguardando_foto", "aguardando_confirmacao", "problema"];
const kmBR = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} km`;
const dataHoraBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Abre o checklist na ativação da etiqueta (1 por etiqueta). null = não abriu (tabela ausente ou já existe).
export async function iniciarChecklist(sb: any, o: { phone: string; tag: any; userId: string | null; accountId: string | null; nome?: string | null }): Promise<any | null> {
  try {
    const t = o.tag || {};
    if (t.id) {
      const { data: ja } = await sb.from("entrega_checklists").select("id").eq("tag_id", t.id).limit(1);
      if (ja?.length) return null;
    }
    let vendedorId: string | null = null;
    if (t.journey_id) vendedorId = (await sb.from("postsale_journeys").select("vendedor_id").eq("id", t.journey_id).maybeSingle()).data?.vendedor_id || null;
    const { data, error } = await sb.from("entrega_checklists").insert({
      dealership: t.dealership || null, tag_id: t.id || null, journey_id: t.journey_id || null, user_id: o.userId, account_id: o.accountId,
      vendedor_id: vendedorId, customer_phone: String(o.phone).replace(/\D/g, ""), customer_name: o.nome || t.customer_name || null,
      car_desc: t.car_desc || null, placa: t.placa || null, status: "aguardando_foto", iniciado_em: new Date().toISOString(),
    }).select("*").single();
    return error ? null : data;
  } catch { return null; }
}

// Checklist em andamento deste telefone (últimas 24h).
export async function checklistAberto(sb: any, phone: string): Promise<any | null> {
  try {
    const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await sb.from("entrega_checklists").select("*").in("customer_phone", variantesTel(phone))
      .gte("iniciado_em", desde).order("iniciado_em", { ascending: false }).limit(1);
    const c = data?.[0];
    return c && ABERTOS.includes(c.status) ? c : null;
  } catch { return null; }
}

export const textoPedidoFoto = (carro: string) =>
  `🔎 *Checklist de entrega* do seu ${carro}\n\nAntes de sair, vamos conferir juntos (1 minuto):\n\n📸 *Ligue o carro e me mande uma foto do painel* mostrando o km. Confira se não tem nenhuma luz de alerta acesa (injeção, óleo, bateria, freio, airbag).\n\nDepois eu te mando os outros itens pra confirmar com um toque.`;

export const textoItens = (c: any) =>
  `🔎 *Checklist de entrega* · ${c.car_desc || "seu carro"}${c.placa ? ` (${c.placa})` : ""}\n\nConfira com o vendedor:\n${ITENS_ENTREGA.map((i) => `▫️ ${i}`).join("\n")}\n\nTocando em *Tudo certo*, você confirma que conferiu esses itens e que o carro saiu em condições de uso${c.km ? `, com ${kmBR(c.km)}` : ""}.`;

// Foto (ou km) do painel lida pela IA.
export async function registrarPainel(sb: any, c: any, o: { km: number | null; luzAlerta: boolean; obs?: string | null; comFoto: boolean }): Promise<any> {
  const upd: Record<string, unknown> = {
    km: o.km && o.km > 0 ? Math.round(o.km) : c.km || null, luz_alerta: o.luzAlerta, painel_obs: o.obs ? String(o.obs).slice(0, 300) : null,
    status: o.luzAlerta ? "problema" : "aguardando_confirmacao",
  };
  if (o.comFoto) upd.foto_em = new Date().toISOString();
  await sb.from("entrega_checklists").update(upd).eq("id", c.id);
  if (o.luzAlerta && c.dealership) {
    await avisarGrupo(sb, c.dealership, `🚨 *Entrega com luz de alerta acesa*\n${c.customer_name || "Cliente"} · ${c.car_desc || "carro"}${c.placa ? ` (${c.placa})` : ""}${upd.km ? ` · ${kmBR(Number(upd.km))}` : ""}\nNo painel: ${o.obs || "luz de alerta"}.\nVendedor: verificar ANTES do carro sair.`).catch(() => false);
  }
  return { ...c, ...upd };
}

async function nomeVendedor(sb: any, id: string | null): Promise<string | null> {
  if (!id) return null;
  try { return (await sb.from("posvenda_equipe").select("nome").eq("id", id).maybeSingle()).data?.nome || null; } catch { return null; }
}

// Toque nos botões. Devolve o texto pro cliente (ou null se não for resposta de checklist).
export async function responderChecklist(sb: any, c: any, ok: boolean): Promise<{ texto: string; confirmou: boolean } | null> {
  const agora = new Date().toISOString();
  const carro = `${c.car_desc || "carro"}${c.placa ? ` (${c.placa})` : ""}`;
  const vend = await nomeVendedor(sb, c.vendedor_id);
  if (ok) {
    if (c.status === "aguardando_foto") return { texto: "Antes de confirmar, me manda a *foto do painel* com o carro ligado (km e nenhuma luz de alerta) 📸", confirmou: false };
    await sb.from("entrega_checklists").update({ status: "ok", confirmado_em: agora, itens: ITENS_ENTREGA }).eq("id", c.id);
    if (c.dealership) {
      await avisarGrupo(sb, c.dealership, `✅ *Entrega conferida pelo cliente*\n${c.customer_name || "Cliente"} · ${carro}${c.km ? ` · ${kmBR(c.km)}` : ""}\n${dataHoraBR(agora)}${vend ? ` · vendedor ${vend}` : ""}${c.foto_em ? " · foto do painel registrada" : ""}`).catch(() => false);
    }
    return {
      confirmou: true,
      texto: `✅ *Entrega registrada*\n${carro}\n📅 ${dataHoraBR(agora)}${c.km ? `\n🛣️ ${kmBR(c.km)}` : ""}\n\nVocê confirmou que o carro saiu em condições de uso. O registro e a foto do painel ficam guardados aqui no seu histórico. Boa viagem! 🚗`,
    };
  }
  await sb.from("entrega_checklists").update({ status: "problema" }).eq("id", c.id);
  if (c.dealership) {
    await avisarGrupo(sb, c.dealership, `⚠️ *Problema apontado na entrega*\n${c.customer_name || "Cliente"} · ${carro}${vend ? ` · vendedor ${vend}` : ""}\nO cliente tocou em "Tem problema" no checklist. Resolver antes do carro sair.`).catch(() => false);
  }
  return { confirmou: false, texto: `Certo, vamos resolver antes de você sair. 👍 Me conta o que encontrou (pode mandar foto, vídeo ou áudio)${vend ? ` e mostre ao ${vend.split(" ")[0]}` : " e mostre ao vendedor"}. Já avisei a equipe da loja.\n\nResolvido, é só tocar em *${BTN_ENTREGA_OK}* na mensagem do checklist.` };
}

// Painel da loja: últimos checklists.
export async function listarChecklists(sb: any, loja: string, limite = 80): Promise<any[]> {
  const { data } = await sb.from("entrega_checklists").select("*").eq("dealership", loja).order("iniciado_em", { ascending: false }).limit(limite);
  return data || [];
}
