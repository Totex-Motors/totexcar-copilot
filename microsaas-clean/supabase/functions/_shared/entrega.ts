// CHECKLIST DE ENTREGA — o vendedor ativa a etiqueta junto com o comprador e o Co-pilot conduz a conferência:
//  1. FOTO DO PAINEL com o carro ligado → km da entrega + nenhuma luz de alerta (a IA lê a foto)
//  2. ITENS de entrega com 1 toque → "✅ Tudo certo" (o OK do cliente, com data, hora e km) ou "⚠️ Tem problema"
// O registro é a prova de que o carro saiu em condições de uso. Tudo certo → avisa o grupo e pede a
// avaliação no Google (cliente acabou de confirmar que está tudo bem). Problema → grupo avisado na hora.

import { avisarGrupo, variantesTel } from "./posvenda.ts";
import { ultimoLaudo, linkLaudo, textoFalhas } from "./scanner.ts";

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

// SCANNER NA ENTREGA: o laudo mais recente do carro (pela placa, até 120 dias) vai pro cliente em PDF e entra
// como item do checklist. Com falha apontada, o texto diz a verdade e a loja é avisada antes do carro sair.
export async function scannerDaEntrega(sb: any, c: any): Promise<{ linha: string; legenda: string; url: string | null; arquivo: string; comFalha: boolean } | null> {
  try {
    const l = await ultimoLaudo(sb, c.dealership, c.placa, 120);
    if (!l) return null;
    if (c.id && c.scanner_laudo_id !== l.id) await sb.from("entrega_checklists").update({ scanner_laudo_id: l.id }).eq("id", c.id);
    const data = new Date(l.gerado_em || l.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
    const comFalha = (l.n_falhas || 0) > 0;
    const bat = l.bateria?.status ? ` · bateria ${l.bateria.status}` : "";
    const res = `${textoFalhas(l)}${bat}`;
    if (comFalha && c.dealership) {
      await avisarGrupo(sb, c.dealership, `⚠️ *Entrega com falha no scanner*\n${c.customer_name || "Cliente"} · ${c.car_desc || "carro"}${c.placa ? ` (${c.placa})` : ""}\nÚltimo scanner (${data}): ${res}.\nO cliente está vendo isso no checklist agora. Vendedor: explicar antes do carro sair.`).catch(() => false);
    }
    return {
      comFalha, url: await linkLaudo(sb, l, 7 * 86_400), arquivo: `Laudo do scanner ${c.placa || ""}.pdf`.replace(/\s+\./, "."),
      legenda: comFalha
        ? `⚠️ Laudo do scanner eletrônico do seu carro (${data}): ${res}. Converse com o vendedor sobre esses pontos.`
        : `🔍 Laudo do scanner eletrônico do seu carro, feito em ${data}${l.km ? ` com ${kmBR(l.km)}` : ""}: ${res}.`,
      linha: comFalha
        ? `\n⚠️ *Scanner eletrônico de ${data}: ${res}.* Veja o laudo e fale com o vendedor antes de confirmar.`
        : `\n▫️ Scanner eletrônico feito em ${data}: ${res} (laudo acima)`,
    };
  } catch { return null; }
}

export const textoItens = (c: any, scanner = "") =>
  `🔎 *Checklist de entrega* · ${c.car_desc || "seu carro"}${c.placa ? ` (${c.placa})` : ""}\n\nConfira com o vendedor:\n${ITENS_ENTREGA.map((i) => `▫️ ${i}`).join("\n")}${scanner}\n\nTocando em *Tudo certo*, você confirma que conferiu esses itens e que o carro saiu em condições de uso${c.km ? `, com ${kmBR(c.km)}` : ""}.`;

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
    // scanner mostrado na entrega: fica registrado junto do OK do cliente
    let scan = "";
    if (c.scanner_laudo_id) {
      try {
        const { data: l } = await sb.from("scanner_laudos").select("n_falhas, falhas, gerado_em, created_at").eq("id", c.scanner_laudo_id).maybeSingle();
        if (l) scan = `scanner de ${new Date(l.gerado_em || l.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}: ${textoFalhas(l)}`;
      } catch { /* */ }
    }
    await sb.from("entrega_checklists").update({ status: "ok", confirmado_em: agora, itens: scan ? [...ITENS_ENTREGA, `Ciente do laudo do ${scan}`] : ITENS_ENTREGA }).eq("id", c.id);
    if (c.dealership) {
      await avisarGrupo(sb, c.dealership, `✅ *Entrega conferida pelo cliente*\n${c.customer_name || "Cliente"} · ${carro}${c.km ? ` · ${kmBR(c.km)}` : ""}\n${dataHoraBR(agora)}${vend ? ` · vendedor ${vend}` : ""}${c.foto_em ? " · foto do painel registrada" : ""}${scan ? `\n🔍 Ciente do ${scan}` : ""}`).catch(() => false);
    }
    return {
      confirmou: true,
      texto: `✅ *Entrega registrada*\n${carro}\n📅 ${dataHoraBR(agora)}${c.km ? `\n🛣️ ${kmBR(c.km)}` : ""}${scan ? `\n🔍 Ciente do ${scan}` : ""}\n\nVocê confirmou que o carro saiu em condições de uso. O registro e a foto do painel ficam guardados aqui no seu histórico. Boa viagem! 🚗`,
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
