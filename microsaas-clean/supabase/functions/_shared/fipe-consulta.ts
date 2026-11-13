// CONSULTA FIPE DE QUALQUER CARRO (texto livre): "Corolla XEi 2020", "fiat toro freedom diesel 2022", "hb20 1.0".
// Lê a tabela FIPE LOCAL (public.fipe_tabela, atualizada sozinha todo mês) — sem API externa e sem custo.
// REGRA: nunca adivinhar a versão. Uma versão + um ano → valor e tendência. Mais de uma → devolve as opções
// pra pessoa escolher (ou abrir o formulário). Usado pela Nina (WhatsApp), pelo Flow e pela Nina da equipe.
import { calcTendencia, normFipe, refStr, type Tendencia } from "./fipe-tendencia.ts";

const MARCAS: Record<string, string> = {
  fiat: "fiat", volkswagen: "volkswagen", vw: "volkswagen", chevrolet: "chevrolet", gm: "chevrolet", chev: "chevrolet", ford: "ford", toyota: "toyota",
  honda: "honda", hyundai: "hyundai", renault: "renault", nissan: "nissan", jeep: "jeep", peugeot: "peugeot", citroen: "citroen", mitsubishi: "mitsubishi",
  kia: "kia", bmw: "bmw", mercedes: "mercedes", audi: "audi", volvo: "volvo", byd: "byd", gwm: "gwm", chery: "chery", caoa: "chery", suzuki: "suzuki",
  subaru: "subaru", mini: "mini", ram: "ram", dodge: "dodge", porsche: "porsche", jac: "jac", lexus: "lexus", troller: "troller", land: "land rover",
  jaguar: "jaguar", tesla: "tesla", ssangyong: "ssangyong", lifan: "lifan", effa: "effa", iveco: "iveco", mahindra: "mahindra",
};
const PARADAS = new Set(("fipe tabela valor preco preço quanto vale valendo custa custando carro veiculo de do da dos das um uma o a os as e ano modelo qual quais esta ta no na em pra para por me diz diga ver consultar consulta " +
  "nina oi ola bom dia boa tarde noite favor obrigado quero saber sobre hoje agora atual atualmente novo usado seminovo rover benz").split(" "));
const brl = (centavos: number) => `R$ ${Math.round(centavos / 100).toLocaleString("pt-BR")}`;
const compacta = (s: string) => s.replace(/[^a-z0-9]/g, "");

export type ItemFipe = { marca: string; modelo: string; ano: string; combustivel: string | null; codigo_fipe: string; valor: string; valor_num: number; tendencia?: Tendencia | null };
export type ResultadoFipe = {
  status: "exato" | "versoes" | "anos" | "nao_achei" | "falta_modelo";
  referencia: string | null;                 // mês da tabela (MM/AAAA)
  item?: ItemFipe;                           // status exato
  opcoes?: { versao: string; combustivel: string | null; anos?: string; ano?: string; valor?: string }[];
  total?: number; entendi?: string; anos_disponiveis?: string;
};

const SEL = "codigo_fipe, ano_modelo, nome_modelo, nome_marca, nome_combustivel, zero_km, valor_centavos, ref_mes, ref_ano, modelo_norm, marca_norm";
const anoTxt = (r: any) => (r.zero_km ? "0 km" : String(r.ano_modelo));

async function tendencia(sb: any, codigo: string, ano: number): Promise<Tendencia | null> {
  try {
    const { data } = await sb.from("fipe_historico").select("ref, valor_centavos").eq("codigo_fipe", codigo).eq("ano_modelo", ano).order("ref", { ascending: false }).limit(7);
    if (!data?.length) return null;
    return calcTendencia(data.map((h: any) => ({ ref: Number(h.ref), valor: Math.round(Number(h.valor_centavos) / 100) })));
  } catch { return null; }
}
const itemDe = (r: any, t?: Tendencia | null): ItemFipe => ({
  marca: r.nome_marca, modelo: r.nome_modelo, ano: anoTxt(r), combustivel: r.nome_combustivel || null, codigo_fipe: r.codigo_fipe,
  valor: brl(Number(r.valor_centavos)), valor_num: Math.round(Number(r.valor_centavos) / 100), tendencia: t ?? null,
});
const refDe = (r: any) => (r?.ref_mes && r?.ref_ano ? `${String(r.ref_mes).padStart(2, "0")}/${r.ref_ano}` : null);

export async function consultarFipe(sb: any, q: { texto: string; ano?: number | string | null }): Promise<ResultadoFipe> {
  const bruto = normFipe(String(q.texto || "").replace(/(\d)[.,](\d)/g, "$1 $2"));
  let zero = /\b(0 ?km|zero ?km|zero)\b/.test(bruto);
  let ano = Number(q.ano) >= 1950 && Number(q.ano) <= 2100 ? Number(q.ano) : null;
  let marca: string | null = null;
  const tokens: string[] = [];
  for (const w of bruto.replace(/\b(0 ?km|zero ?km)\b/g, " ").split(" ").filter(Boolean)) {
    if (/^(19[5-9]\d|20[0-4]\d)$/.test(w)) { ano = ano || Number(w); continue; }
    if (MARCAS[w] && !marca) { marca = MARCAS[w]; continue; }
    if (PARADAS.has(w) || w === "zero") continue;
    tokens.push(w);
  }
  if (String(q.ano || "").match(/0 ?km|zero/i)) zero = true;
  // "1 0", "2 0": cilindrada vira uma frase só
  const termos: string[] = [];
  const fundidos = new Map<string, string>(); // "tcross" → "t cross" (grafia da tabela)
  for (let i = 0; i < tokens.length; i++) {
    if (/^\d$/.test(tokens[i]) && /^\d$/.test(tokens[i + 1] || "")) { termos.push(`${tokens[i]} ${tokens[i + 1]}`); i++; }
    else if (tokens[i].length >= 2 || /\d/.test(tokens[i])) termos.push(tokens[i]);
    else if (tokens[i].length === 1 && tokens[i + 1]) { fundidos.set(tokens[i] + tokens[i + 1], `${tokens[i]} ${tokens[i + 1]}`); termos.push(tokens[i] + tokens[i + 1]); i++; } // "t cross" → "tcross"
  }
  if (!termos.length) return { status: "falta_modelo", referencia: null };

  // busca ampla pelo termo principal (o nome do modelo) e ranqueia em código
  const principal = termos[0];
  let query = sb.from("fipe_tabela").select(SEL).limit(1500);
  if (marca) query = query.ilike("marca_norm", `%${marca}%`);
  // "tcross" na tabela é "t cross": procura as duas grafias
  const comEspaco = fundidos.get(principal) || (/^t ?cross$/.test(principal) ? "t cross" : null);
  query = comEspaco ? query.or(`modelo_norm.ilike.%${principal}%,modelo_norm.ilike.${comEspaco}%`) : query.ilike("modelo_norm", `%${principal}%`);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  let lista: any[] = rows || [];
  const referencia = refDe(lista[0]);
  if (!lista.length) return { status: "nao_achei", referencia, entendi: [marca, ...termos].filter(Boolean).join(" ") };

  // família: o nome do modelo começa pelo termo principal ("corolla", "toro", "t cross")
  const fam = compacta(principal);
  // a 1ª palavra (ou as 2 primeiras juntas) do nome tem que SER o modelo: "gol" não pode trazer o Golf
  const ehFamilia = (r: any) => { const w = String(r.modelo_norm).split(" "); return w[0] === fam || compacta(`${w[0]}${w[1] || ""}`) === fam || compacta(`${w[0]}${w[1] || ""}${w[2] || ""}`) === fam; };
  let daFamilia = lista.filter(ehFamilia);
  if (!daFamilia.length) daFamilia = lista.filter((r) => compacta(r.modelo_norm).startsWith(fam));
  if (daFamilia.length) lista = daFamilia;
  // demais termos (versão, motor, câmbio): fica com as linhas que casam MAIS termos
  const resto = termos.slice(1);
  const casa = (r: any, t: string) => {
    const n = ` ${r.modelo_norm} `;
    if (t.includes(" ")) return n.includes(` ${t} `) || n.includes(` ${t}`);
    return n.includes(` ${t} `) || n.split(" ").some((w: string) => w.length > 2 && t.length > 2 && (w.startsWith(t) || t.startsWith(w)));
  };
  if (resto.length) {
    const pontos = lista.map((r) => ({ r, s: resto.filter((t) => casa(r, t)).length }));
    const max = Math.max(...pontos.map((p) => p.s));
    if (max > 0) lista = pontos.filter((p) => p.s === max).map((p) => p.r);
  }
  // ano
  const todosAnos = [...new Set(lista.map((r) => (r.zero_km ? 9999 : Number(r.ano_modelo))))].sort((a, b) => a - b);
  const faixa = (as: number[]) => { const reais = as.filter((a) => a !== 9999); return `${reais[0] ?? "0 km"}${reais.length > 1 ? `–${reais[reais.length - 1]}` : ""}${as.includes(9999) && reais.length ? " e 0 km" : ""}`; };
  if (ano || zero) {
    const doAno = lista.filter((r) => (zero ? r.zero_km : !r.zero_km && Number(r.ano_modelo) === ano));
    if (!doAno.length) return { status: "nao_achei", referencia, entendi: `${[marca, ...termos].filter(Boolean).join(" ")} ${zero ? "0 km" : ano}`, anos_disponiveis: faixa(todosAnos) };
    lista = doAno;
  }
  const versoes = new Map<string, any[]>();
  for (const r of lista) (versoes.get(r.codigo_fipe) || versoes.set(r.codigo_fipe, []).get(r.codigo_fipe)!).push(r);

  if (versoes.size === 1) {
    const linhas = [...versoes.values()][0].sort((a, b) => (b.zero_km ? 9999 : b.ano_modelo) - (a.zero_km ? 9999 : a.ano_modelo));
    if (linhas.length === 1) return { status: "exato", referencia, item: itemDe(linhas[0], linhas[0].zero_km ? null : await tendencia(sb, linhas[0].codigo_fipe, Number(linhas[0].ano_modelo))) };
    // uma versão, vários anos: mostra os valores por ano e pergunta qual
    return { status: "anos", referencia, total: linhas.length,
      opcoes: linhas.slice(0, 10).map((r) => ({ versao: `${r.nome_marca} ${r.nome_modelo}`, combustivel: r.nome_combustivel || null, ano: anoTxt(r), valor: brl(Number(r.valor_centavos)) })) };
  }
  // várias versões: lista pra pessoa escolher (nunca chutar)
  const ops = [...versoes.values()].map((ls) => {
    const r = ls[0]; const as = ls.map((x) => (x.zero_km ? 9999 : Number(x.ano_modelo))).sort((a, b) => a - b);
    return { versao: `${r.nome_marca} ${r.nome_modelo}`, combustivel: r.nome_combustivel || null, ...(ano || zero ? { ano: anoTxt(r), valor: brl(Number(r.valor_centavos)) } : { anos: faixa(as) }), _ord: Math.max(...as.filter((a) => a !== 9999), 0) };
  }).sort((a, b) => b._ord - a._ord || a.versao.localeCompare(b.versao));
  return { status: "versoes", referencia, total: ops.length, opcoes: ops.slice(0, 12).map(({ _ord, ...o }) => o) };
}

// Pelo código FIPE + ano (resultado do formulário): valor da tabela local + tendência
export async function fipePorCodigo(sb: any, codigo: string, ano: number | null, zero = false): Promise<{ item: ItemFipe; referencia: string | null } | null> {
  if (!codigo) return null;
  const { data } = await sb.from("fipe_tabela").select(SEL).eq("codigo_fipe", codigo).limit(60);
  const r = (data || []).find((x: any) => (zero ? x.zero_km : !x.zero_km && Number(x.ano_modelo) === ano));
  if (!r) return null;
  return { item: itemDe(r, r.zero_km ? null : await tendencia(sb, r.codigo_fipe, Number(r.ano_modelo))), referencia: refDe(r) };
}

// texto curto da tendência (uma linha), pro formulário e pro grupo
export function textoTendencia(t?: Tendencia | null): string {
  if (!t || t.nivel === "sem_dados") return "";
  return `No último mês ${t.resumo}.`;
}
export { refStr };
