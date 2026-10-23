// OFICINAS PARCEIRAS — ordem de serviço dos carros do estoque (dealer-api + tick da função posvenda).
//  1. ENVIADA   — o gerente de manutenção manda o carro (km + foto do painel na saída)
//  2. RECEBIDA  — a oficina confirma a chegada pelo link dela (km + foto do painel na chegada)
//  3. CONCLUÍDA — a oficina registra o serviço; campos obrigatórios (óleo: viscosidade, norma, marca, litros,
//                 filtros; km; foto do painel; foto da etiqueta). Troca de óleo vira a PREPARAÇÃO do carro.
//  4. DEVOLVIDA — o gerente confirma a volta (km)
// Extraordinário (algo além do pedido) só com aprovação do gerente. Carro parado na oficina mais de 1 dia
// (enviada/recebida) → aviso no grupo da loja.

import { avisarGrupo, janelaAberta } from "./posvenda.ts";
import { loadWaSettings, waSendText, waSendTemplate, garantirTemplateTexto } from "./wa.ts";

export const SERVICOS: Record<string, string> = { troca_oleo: "troca de óleo e filtro", revisao: "revisão", outro: "outro serviço" };
export const PRAZO_HORAS = 24;
const BUCKET = "arquivozap";
const kmBR = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} km`;
export const descServicos = (s: string[] | null | undefined) => (s || []).map((x) => SERVICOS[x] || x).join(" + ") || "serviço";
export const nomeCarro = (os: any) => `${os.car_desc || "carro"}${os.placa ? ` (${os.placa})` : ""}`;

export function novoToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function linkDaOficina(sb: any, token: string): Promise<string> {
  const { data: st } = await sb.from("app_settings").select("app_url").eq("id", 1).maybeSingle();
  return `${String(st?.app_url || "https://copilot.totexmotors.com").replace(/\/+$/, "")}/parceiro/${token}`;
}

// Foto que vem do celular como data URL (a tela já comprime). Guarda no Storage privado e devolve o caminho.
export async function salvarFoto(sb: any, osId: string, campo: string, dataUrl: unknown): Promise<string | null> {
  const m = String(dataUrl || "").match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  const bin = atob(m[2]);
  if (bin.length < 2_000 || bin.length > 6_000_000) return null; // vazia/corrompida ou grande demais
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg";
  const path = `oficina/${osId}/${campo}-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: m[1], upsert: false });
  return error ? null : path;
}

// URLs assinadas (1 h) das fotos de uma lista de OS, numa chamada só.
export async function comFotos(sb: any, rows: any[]): Promise<any[]> {
  const campos = ["foto_saida", "foto_chegada", "foto_painel", "foto_etiqueta", "foto_nota", "extra_foto"];
  const paths = [...new Set(rows.flatMap((r) => campos.map((c) => r[c]).filter(Boolean)))] as string[];
  const url: Record<string, string> = {};
  if (paths.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const d of data || []) if (d?.path && d?.signedUrl) url[d.path] = d.signedUrl;
  }
  return rows.map((r) => {
    const fotos: Record<string, string | null> = {};
    for (const c of campos) fotos[c] = r[c] ? url[r[c]] || null : null;
    const fim = r.devolvida_em || r.concluida_em || r.cancelada_em || new Date().toISOString();
    return {
      ...r, fotos,
      km_ida: r.km_saida != null && r.km_chegada != null ? r.km_chegada - r.km_saida : null,
      horas_na_oficina: Math.round((new Date(fim).getTime() - new Date(r.enviada_em).getTime()) / 3_600_000),
      atrasada: ["enviada", "recebida"].includes(r.status) && Date.now() - new Date(r.enviada_em).getTime() > PRAZO_HORAS * 3_600_000,
    };
  });
}

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
const txt = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

// Campos obrigatórios do serviço. Devolve os valores limpos ou o primeiro erro (código p/ a tela).
export function validarServico(os: any, p: any): { erro: string } | { campos: Record<string, unknown> } {
  const km = Math.round(num(p.km_servico));
  if (!(km > 0) || km > 2_000_000) return { erro: "informe_o_km" };
  if (os.km_chegada != null && km < os.km_chegada) return { erro: "km_menor_que_na_chegada" };
  if (!p.foto_painel) return { erro: "foto_do_painel_obrigatoria" };
  const oleo = (os.servicos || []).includes("troca_oleo");
  const campos: Record<string, unknown> = { km_servico: km, servico_obs: txt(p.servico_obs, 800) || null };
  if (oleo) {
    const visc = txt(p.oleo_viscosidade, 20).toUpperCase(), norma = txt(p.oleo_norma, 60), marca = txt(p.oleo_marca, 60);
    const litros = num(p.oleo_litros);
    if (!/^\d{1,2}W-?\d{2}$/.test(visc.replace(/\s/g, ""))) return { erro: "viscosidade_invalida" };
    if (norma.length < 2) return { erro: "informe_a_norma_do_oleo" };
    if (marca.length < 2) return { erro: "informe_a_marca_do_oleo" };
    if (!(litros >= 0.5 && litros <= 15)) return { erro: "litros_invalidos" };
    if (!p.foto_etiqueta) return { erro: "foto_da_etiqueta_obrigatoria" };
    Object.assign(campos, {
      oleo_viscosidade: visc.replace(/\s/g, ""), oleo_norma: norma, oleo_marca: marca, oleo_litros: Math.round(litros * 10) / 10,
      filtro_oleo: !!p.filtro_oleo, filtro_ar: !!p.filtro_ar, filtro_combustivel: !!p.filtro_combustivel, filtro_cabine: !!p.filtro_cabine,
    });
  }
  // revisão / outro serviço: descrever o que foi feito
  if ((os.servicos || []).some((s: string) => s !== "troca_oleo") && txt(p.servico_obs, 800).length < 5) return { erro: "descreva_o_servico_feito" };
  const valor = num(p.valor);
  if (valor > 0) campos.valor = Math.round(valor * 100) / 100;
  return { campos };
}

export const descOleo = (os: any) => [os.oleo_viscosidade, os.oleo_norma, os.oleo_marca, os.oleo_litros ? `${String(os.oleo_litros).replace(".", ",")} L` : null].filter(Boolean).join(" · ");
const descFiltros = (os: any) => [os.filtro_oleo && "óleo", os.filtro_ar && "ar", os.filtro_combustivel && "combustível", os.filtro_cabine && "cabine"].filter(Boolean).join(", ");

// Troca de óleo concluída → registro de PREPARAÇÃO do carro (o mesmo que o gerente fazia à mão).
export async function prepararDaOS(sb: any, os: any, oficinaNome: string): Promise<string | null> {
  if (!(os.servicos || []).includes("troca_oleo")) return null;
  const { data, error } = await sb.from("preparacao_veiculos").insert({
    dealership: os.dealership, vehicle_id: os.vehicle_id || null, car_desc: os.car_desc || null, placa: os.placa || null,
    data: new Date().toISOString().slice(0, 10), km: os.km_servico, oleo: true,
    oleo_tipo: [os.oleo_viscosidade, os.oleo_norma, os.oleo_marca].filter(Boolean).join(" ").slice(0, 60) || null,
    filtro_oleo: !!os.filtro_oleo, filtro_ar: !!os.filtro_ar, filtro_combustivel: !!os.filtro_combustivel, filtro_cabine: !!os.filtro_cabine,
    intervalo_km: 10000, obs: `OS #${os.numero}${os.servico_obs ? ` · ${os.servico_obs}` : ""}`.slice(0, 500), feito_por: oficinaNome,
  }).select("id").single();
  return error ? null : data?.id || null;
}

// ---------------- avisos ----------------
// Oficina: texto livre se ela falou com o Co-pilot nas últimas 24h; senão o template (aprovado pela Meta).
export async function avisarOficina(sb: any, oficina: any, texto: string, template?: { name: string; params: string[] }): Promise<boolean> {
  const fone = String(oficina?.whatsapp || "").replace(/\D/g, "");
  if (!fone) return false;
  const wa = await loadWaSettings(sb);
  try {
    if (await janelaAberta(sb, fone)) return await waSendText(wa, fone, texto);
    if (!template) return false;
    await garantirTemplateTexto(wa, template.name).catch(() => "");
    return await waSendTemplate(wa, fone, template.name, template.params);
  } catch (e) { console.error("aviso oficina:", e); return false; }
}

export async function avisarNovaOS(sb: any, os: any, oficina: any, link: string): Promise<void> {
  const serv = descServicos(os.servicos);
  await avisarOficina(sb, oficina,
    `🔧 *Ordem de serviço #${os.numero}* · ${os.dealership}\n\nO *${nomeCarro(os)}* está indo para a ${oficina.nome}.\nServiço pedido: ${serv}${os.pedido_obs ? `\nObs.: ${os.pedido_obs}` : ""}\n\nQuando o carro chegar, abra o link e confirme a chegada (km + foto do painel). No fim, registre o serviço por lá:\n${link}`,
    { name: "copilot_os_oficina", params: [`#${os.numero}`, os.dealership, nomeCarro(os), serv, link] });
  await avisarGrupo(sb, os.dealership, `🔧 *OS #${os.numero}*: ${nomeCarro(os)} enviado para a *${oficina.nome}* (${serv})${os.km_saida ? ` · saiu com ${kmBR(os.km_saida)}` : ""}${os.enviada_por ? ` · por ${os.enviada_por}` : ""}.\nPrazo: ${PRAZO_HORAS}h.`).catch(() => false);
}

export async function avisarChegada(sb: any, os: any, oficina: any): Promise<void> {
  const ida = os.km_saida != null && os.km_chegada != null ? os.km_chegada - os.km_saida : null;
  const alerta = ida != null && ida > 50 ? `\n⚠️ Rodou *${kmBR(ida)}* entre a loja e a oficina.` : "";
  await avisarGrupo(sb, os.dealership, `📥 *OS #${os.numero}*: a *${oficina.nome}* recebeu o ${nomeCarro(os)} com ${kmBR(os.km_chegada)}${ida != null ? ` (${ida >= 0 ? "+" : ""}${ida} km desde a saída)` : ""}.${alerta}`).catch(() => false);
}

export async function avisarConclusao(sb: any, os: any, oficina: any): Promise<void> {
  const oleo = (os.servicos || []).includes("troca_oleo") ? `\n🛢️ Óleo: ${descOleo(os)}${descFiltros(os) ? `\n🧰 Filtros: ${descFiltros(os)}` : ""}` : "";
  await avisarGrupo(sb, os.dealership, `✅ *OS #${os.numero} pronta* na *${oficina.nome}*: ${nomeCarro(os)} · ${kmBR(os.km_servico)}${oleo}${os.servico_obs ? `\n📝 ${os.servico_obs}` : ""}\nFotos do painel e da etiqueta no link da oficina. Gerente: buscar o carro e confirmar a volta.`).catch(() => false);
}

export async function avisarExtra(sb: any, os: any, oficina: any): Promise<void> {
  await avisarGrupo(sb, os.dealership, `⚠️ *OS #${os.numero}*: a *${oficina.nome}* encontrou algo além do pedido no ${nomeCarro(os)}:\n"${os.extra_descricao}"${os.extra_valor ? `\nValor: R$ ${Number(os.extra_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}\nO gerente de manutenção aprova ou recusa no link dele. Nada é feito sem aprovação.`).catch(() => false);
}

export async function avisarDecisaoExtra(sb: any, os: any, oficina: any, aprovado: boolean): Promise<void> {
  const t = aprovado
    ? `✅ *OS #${os.numero}*: o extra no ${nomeCarro(os)} foi *APROVADO* por ${os.extra_decidido_por || "a loja"}. Pode fazer:\n"${os.extra_descricao}"`
    : `❌ *OS #${os.numero}*: o extra no ${nomeCarro(os)} foi *RECUSADO* por ${os.extra_decidido_por || "a loja"}. Não fazer:\n"${os.extra_descricao}"`;
  await avisarOficina(sb, oficina, t);
  await avisarGrupo(sb, os.dealership, t).catch(() => false);
}

// Tick (função posvenda, a cada 5 min): carro na oficina há mais de 1 dia sem o serviço registrado.
export async function osAtrasoTick(sb: any): Promise<number> {
  const limite = new Date(Date.now() - PRAZO_HORAS * 3_600_000).toISOString();
  const { data: os } = await sb.from("ordens_servico").select("*").in("status", ["enviada", "recebida"])
    .lt("enviada_em", limite).is("alerta_atraso_em", null).limit(50);
  let avisados = 0;
  for (const o of os || []) {
    const { data: upd } = await sb.from("ordens_servico").update({ alerta_atraso_em: new Date().toISOString() })
      .eq("id", o.id).is("alerta_atraso_em", null).select("id");
    if (!upd?.length) continue; // outro tick já avisou
    const { data: of } = await sb.from("oficinas_parceiras").select("*").eq("id", o.oficina_id).maybeSingle();
    const horas = Math.round((Date.now() - new Date(o.enviada_em).getTime()) / 3_600_000);
    const etapa = o.status === "enviada" ? "a oficina ainda não confirmou que recebeu" : "o serviço ainda não foi registrado";
    await avisarGrupo(sb, o.dealership, `⏰ *OS #${o.numero} passou do prazo*: ${nomeCarro(o)} está com a *${of?.nome || "oficina"}* há ${horas}h e ${etapa}. Prazo: ${PRAZO_HORAS}h.`).catch(() => false);
    if (of) await avisarOficina(sb, of, `⏰ *OS #${o.numero}* (${nomeCarro(o)}) passou do prazo de ${PRAZO_HORAS}h: ${etapa}. Registre pelo link da oficina, por favor.`);
    avisados++;
  }
  return avisados;
}
