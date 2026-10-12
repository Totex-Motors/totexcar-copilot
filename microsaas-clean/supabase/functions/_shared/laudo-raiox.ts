// Laudo do Raio-X em PDF (marca TotexCar). O provedor (GPT Motors, "Veicular PRO") só devolve os
// dados — o PDF é montado aqui a partir da consulta GUARDADA (gpt_consultas), então é sempre o mesmo
// documento: abre no app (doc-open), no cofre e vai pelo WhatsApp depois do pagamento.
// Usa TUDO que o Veicular PRO pode trazer (Nacional/BIN, Estadual, Renainf, gravame, roubo e furto,
// leilão, indício de sinistro) + a FIPE do nosso histórico + um parecer por regras.
// Dados pessoais (nome/CPF do dono, do financiado e do comprador, nº do contrato, CNH) ficam de fora.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";
import { calcTendencia, type Tendencia } from "./fipe-tendencia.ts";

export interface LaudoIn {
  dados: any; analiseIA?: string | null; placa?: string | null; criadoEm?: string | null; codigo?: string | null;
  fipe?: Tendencia | null; // histórico FIPE do modelo (quando o carro está ligado a um código FIPE)
}

const W = 595, H = 842, M = 40;
const TEAL = rgb(0.047, 0.431, 0.416), TEAL_SOFT = rgb(0.93, 0.97, 0.96);
const INK = rgb(0.07, 0.09, 0.13), MUT = rgb(0.42, 0.46, 0.52), LINE = rgb(0.88, 0.9, 0.92);
const OK = rgb(0.09, 0.55, 0.33), OK_BG = rgb(0.9, 0.97, 0.93);
const WARN = rgb(0.8, 0.42, 0.06), WARN_BG = rgb(1, 0.95, 0.88);

// Helvetica padrão só tem WinAnsi (cp1252): o resto vira a letra-base ou some (não quebra o PDF).
const CP1252 = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function limpa(s: unknown): string {
  const pre = String(s ?? "").replace(/[\r\t]/g, " ").replace(/[\u2212\u2010\u2011]/g, "-").replace(/\u00a0/g, " ");
  return Array.from(pre).map((ch) => {
    const c = ch.charCodeAt(0);
    if (ch === "\n" || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || CP1252.includes(ch)) return ch;
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return /^[\x20-\x7e]$/.test(base) ? base : "";
  }).join("");
}

const vazio = (v: unknown) => v == null || String(v).trim() === "" || /^0+$/.test(String(v).trim());
const dataBR = (s: unknown) => {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s ?? "");
};
const ehValor = (v: unknown) => /^[\d.]*\d,\d{2}$|^\d+$/.test(String(v ?? "").trim());
const valorNum = (v: unknown) => ehValor(v) ? Number(String(v).trim().replace(/\./g, "").replace(",", ".")) : 0;
const nadaConsta = (v: unknown) => vazio(v) || /nada consta|n[aã]o consta|nao possui|sem restri/i.test(String(v));
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sim = (v: unknown) => v === true || /^(s|sim|true|yes)$/i.test(String(v ?? "").trim());
const lista = (v: unknown): any[] => Array.isArray(v) ? v : [];
const qtd = (o: any) => Number(o?.quantidadeRegistros ?? (lista(o?.registros).length || lista(o?.historico).length)) || 0;

// nomes curtos pro texto corrido
const NOME_DEB: Record<string, string> = {
  IPVA: "IPVA", DPVAT: "DPVAT", LICENCIAMENTO: "licenciamento", MULTAS_DETRAN: "multas do Detran", MULTAS_PRF: "multas da PRF",
  MULTAS_DER: "multas do DER", MULTAS_DERSA: "multas da Dersa", MULTAS_MUNICIPAIS: "multas municipais", MULTAS_CETESB: "multas da Cetesb", MULTAS_RENAINF: "multas Renainf",
};
const nomeDeb = (r: any) => NOME_DEB[String(r?.chave || "").toUpperCase()] || String(r?.nome || r?.chave || "").toLowerCase();
const humano = (s: unknown) => String(s ?? "").replace(/ALIENACAO FIDUCIARIA/gi, "alienação fiduciária").replace(/ARRENDAMENTO MERCANTIL/gi, "arrendamento mercantil").replace(/RESERVA DE DOMINIO/gi, "reserva de domínio");
const normR = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

// neutro = consta, mas é o mesmo achado de outra linha (não conta de novo como ponto de atenção)
type Linha = { t: string; ok: boolean; det?: string; neutro?: string };

// Lê os blocos da cautelar → lista de verificações (verde = nada consta, laranja = consta)
export function verificacoesRaiox(d: any): Linha[] {
  const out: Linha[] = [];
  const le = d?.leilaoDados, si = d?.sinistroDados, rf = d?.rouboFurtoDados, gr = d?.gravameDados, na = d?.nacionalDados;
  const est = d?.estadualDados?.restricoesImpedimentos, ren = d?.renainfDados?.resumo, cv = d?.estadualDados?.comunicacaoDeVenda;

  if (le) { const n = qtd(le); const s = le.possuiRegistro === true || n > 0; out.push({ t: "Leilão", ok: !s, det: s ? `${n || 1} registro(s) de leilão — detalhes abaixo` : undefined }); }
  if (si) {
    out.push({ t: "Sinistro com perda total", ok: si.sinistroIntegral !== true, det: si.sinistroIntegral === true ? `Perda total registrada${si.dataSinistroIntegral ? ` em ${dataBR(si.dataSinistroIntegral)}` : ""}` : undefined });
    const ind = si.indicioDeSinistro === true || !vazio(si.indicioSinistroSeguradora);
    out.push({ t: "Indício de sinistro (seguradoras)", ok: !ind, det: ind ? `Registrado por: ${vazio(si.indicioSinistroSeguradora) ? "seguradora não informada" : si.indicioSinistroSeguradora}` : undefined });
  }
  if (rf) { const n = qtd(rf); const s = rf.possuiRegistro === true || n > 0; out.push({ t: "Roubo e furto", ok: !s, det: s ? `${n || 1} ocorrência(s) — detalhes abaixo` : undefined }); }
  if (gr) {
    const s = gr.possuiRegistro === true || lista(gr.restricoes).length > 0;
    const h = lista(gr.historico)[0];
    const det = s ? [humano(lista(gr.restricoes).join(", ")) || "Gravame ativo", h?.nomeAgente ? `credor: ${h.nomeAgente}` : ""].filter(Boolean).join(" · ") : undefined;
    out.push({ t: "Gravame / financiamento", ok: !s, det });
  }
  if (na) {
    const rs = lista(na.restricoes);
    const doGravame = new Set(lista(gr?.restricoes).map(normR));
    const outras = rs.filter((r) => !doGravame.has(normR(r)));
    if (rs.length && !outras.length) out.push({ t: "Restrições na Base Nacional (BIN)", ok: true, neutro: "Só o gravame", det: `${humano(rs.join(", "))} (a mesma do gravame acima)` });
    else out.push({ t: "Restrições na Base Nacional (BIN)", ok: outras.length === 0, det: humano(outras.join(", ")) || undefined });
  }
  if (est) {
    for (const [k, t] of [["restricaoJudicial", "Restrição judicial"], ["restricaoAdministrativa", "Restrição administrativa"], ["restricaoTributaria", "Restrição tributária"], ["restricaoFurto", "Restrição de furto (Detran)"]] as const) {
      if (k in est) out.push({ t, ok: nadaConsta(est[k]), det: nadaConsta(est[k]) ? undefined : String(est[k]) });
    }
  }
  if (ren) {
    const n = Number(ren.quantidadeOcorrenciasTotal ?? ren.quantidadeOcorrencias ?? 0) || lista(d?.renainfDados?.registros).length;
    out.push({ t: "Multas fora do estado e federais (Renainf)", ok: n === 0, det: n ? `${n} ocorrência(s)${vazio(ren.alerta) ? "" : ` · ${ren.alerta}`}` : undefined });
  }
  const debs = lista(d?.estadualDados?.debitosEstaduais);
  if (debs.length) {
    const pend = debs.filter((r: any) => !/^(STATUS_|TOTAL_)/i.test(String(r?.chave || "")) && valorNum(r?.valor) > 0);
    out.push({ t: "Débitos estaduais (IPVA, licenciamento, multas)", ok: pend.length === 0,
      det: pend.length ? pend.map((r: any) => `${nomeDeb(r)}: R$ ${r.valor}`).join(" · ") : undefined });
  }
  if (cv) {
    const s = !vazio(cv.indicadorComunicacaoDeVenda) || !vazio(cv.dataVenda) || !vazio(cv.dataComunicacao);
    out.push({ t: "Comunicação de venda", ok: !s, det: s ? `Venda comunicada${cv.dataVenda ? ` em ${dataBR(cv.dataVenda)}` : ""}` : undefined });
  }
  return out;
}

// Parecer por regras (o provedor nem sempre manda análise): o que cada achado significa na prática.
export function parecerRaiox(d: any, fipe?: Tendencia | null): string[] {
  const p: string[] = [];
  const le = d?.leilaoDados, si = d?.sinistroDados, rf = d?.rouboFurtoDados, gr = d?.gravameDados;
  const est = d?.estadualDados?.restricoesImpedimentos;
  if (le && (le.possuiRegistro === true || qtd(le) > 0)) p.push("Passou por leilão: isso costuma reduzir o valor de revenda e algumas seguradoras recusam ou cobram mais caro. Confira as condições do lote no detalhamento e faça vistoria cautelar presencial.");
  if (si?.sinistroIntegral === true) p.push("Tem perda total registrada: o carro foi indenizado por seguradora. Exige vistoria especial e muito cuidado na negociação.");
  else if (si && (si.indicioDeSinistro === true || !vazio(si.indicioSinistroSeguradora))) p.push("Há indício de sinistro registrado por seguradora: não significa perda total, mas vale vistoria presencial para checar reparos estruturais.");
  if (rf && (rf.possuiRegistro === true || qtd(rf) > 0)) p.push("Há registro de roubo/furto: só negocie depois de confirmar que o carro foi recuperado e que a ocorrência foi baixada no Detran.");
  if (gr && (gr.possuiRegistro === true || lista(gr.restricoes).length > 0)) {
    const ag = lista(gr.historico)[0]?.nomeAgente;
    p.push(`Está financiado (${humano(lista(gr.restricoes).join(", ")).toLowerCase() || "gravame ativo"}${ag ? ` com ${ag}` : ""}): a transferência só acontece depois da quitação e da baixa do gravame. Numa compra, combine a quitação junto ao banco antes de pagar.`);
  }
  if (est && (!nadaConsta(est.restricaoJudicial) || !nadaConsta(est.restricaoAdministrativa))) p.push("Há restrição judicial ou administrativa: ela pode impedir a transferência até ser resolvida no órgão responsável.");
  const debs = lista(d?.estadualDados?.debitosEstaduais).filter((r: any) => !/^(STATUS_|TOTAL_)/i.test(String(r?.chave || "")) && valorNum(r?.valor) > 0);
  if (debs.length) {
    const tot = debs.reduce((s: number, r: any) => s + valorNum(r.valor), 0);
    p.push(`Há ${brl(tot)} em débitos no Detran (${debs.map(nomeDeb).join(", ")}): precisam ser pagos para licenciar e para transferir.`);
  }
  const nRen = Number(d?.renainfDados?.resumo?.quantidadeOcorrenciasTotal ?? 0) || lista(d?.renainfDados?.registros).length;
  if (nRen) p.push(`Há ${nRen} multa(s) registrada(s) fora do estado ou por órgão federal (Renainf), que não aparecem no Detran do estado.`);
  if (!p.length) p.push("Nenhum impedimento encontrado nas bases consultadas: sem leilão, sinistro, roubo/furto, restrições ou débitos.");
  if (fipe && fipe.nivel !== "sem_dados" && fipe.atual) p.push(`Referência de mercado: FIPE de ${brl(fipe.atual)} (${fipe.meses.at(-1)?.ref}); ${fipe.resumo}.`);
  p.push("Recomendação: mesmo com a ficha em ordem, faça a vistoria física (chassi, motor e estrutura) antes de fechar negócio.");
  return p;
}

// Histórico FIPE do carro pela placa (código FIPE já ligado a alguma conta com essa placa).
// Carro de terceiro, sem conta ligada → sem FIPE no laudo (não inventa modelo).
export async function fipeDaPlaca(sbUrl: string, key: string, placa?: string | null): Promise<Tendencia | null> {
  const pl = String(placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!pl || !sbUrl || !key) return null;
  const H = { apikey: key, authorization: `Bearer ${key}` };
  try {
    const a = await (await fetch(`${sbUrl}/rest/v1/accounts?placa=eq.${pl}&fipe_codigo=not.is.null&select=fipe_codigo,fipe_ano&limit=1`, { headers: H })).json();
    const c = a?.[0];
    if (!c?.fipe_codigo || !c?.fipe_ano) return null;
    const h = await (await fetch(`${sbUrl}/rest/v1/fipe_historico?codigo_fipe=eq.${encodeURIComponent(c.fipe_codigo)}&ano_modelo=eq.${c.fipe_ano}&select=ref,valor_centavos&order=ref.desc&limit=7`, { headers: H })).json();
    if (!Array.isArray(h) || !h.length) return null;
    const t = calcTendencia(h.map((r: any) => ({ ref: Number(r.ref), valor: Number(r.valor_centavos) / 100 })));
    return t.atual ? t : null;
  } catch { return null; }
}

export async function laudoRaioxPdf(inp: LaudoIn): Promise<Uint8Array> {
  const d = inp.dados || {};
  const vb = d.veiculoDadosBasicos || {};
  const doc = await PDFDocument.create();
  doc.setTitle(limpa(`Laudo Raio-X ${inp.placa || vb.placa || ""}`.trim()));
  doc.setAuthor("TotexCar Co-pilot");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H;
  const txt = (s: unknown, x: number, yy: number, size = 9.5, f: PDFFont = font, color = INK) =>
    page.drawText(limpa(s), { x, y: yy, size, font: f, color });
  const larg = (s: unknown, size: number, f: PDFFont = font) => f.widthOfTextAtSize(limpa(s), size);
  const quebra = (s: unknown, max: number, size: number, f: PDFFont = font): string[] => {
    const linhas: string[] = [];
    for (const par of limpa(s).split("\n")) {
      let l = "";
      for (const w of par.split(/\s+/).filter(Boolean)) {
        const t = l ? `${l} ${w}` : w;
        if (f.widthOfTextAtSize(t, size) > max && l) { linhas.push(l); l = w; } else l = t;
      }
      linhas.push(l);
    }
    return linhas;
  };
  const novaPagina = () => { page = doc.addPage([W, H]); y = H - M; };
  const garante = (h: number) => { if (y - h < 60) novaPagina(); };
  const secao = (t: string, prox = 30) => { garante(36 + prox); y -= 22; txt(t.toUpperCase(), M, y, 8.5, bold, TEAL); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE }); y -= 6; };
  const paragrafo = (s: string, size = 9.5, cor = INK, recuo = 0) => {
    for (const l of quebra(s, W - 2 * M - recuo, size)) { garante(size + 4); y -= size + 3.5; txt(l, M + recuo, y, size, font, cor); }
  };
  // ficha "rótulo: valor" em 2 colunas (detalhamentos)
  const cw2 = (W - 2 * M) / 2;
  const fichaLayout = (pares: [string, unknown][]) => {
    const vis = pares.filter(([, v]) => !vazio(v)).map(([l, v]) => [l, String(v)] as [string, string]);
    const curtos = vis.filter(([, v]) => larg(v, 8.5, bold) <= cw2 - 10), longos = vis.filter(([, v]) => larg(v, 8.5, bold) > cw2 - 10);
    const altura = 20 + Math.ceil(curtos.length / 2) * 21 + longos.reduce((h, [, v]) => h + 11 + quebra(v, W - 2 * M, 8.5, bold).length * 11, 0) + 6;
    return { curtos, longos, altura };
  };
  const ficha = (titulo: string, pares: [string, unknown][]) => {
    const { curtos, longos, altura } = fichaLayout(pares);
    garante(altura);
    y -= 15; txt(titulo, M, y, 9.5, bold);
    for (let i = 0; i < curtos.length; i += 2) {
      y -= 21;
      curtos.slice(i, i + 2).forEach(([l, v], j) => { const x = M + j * cw2; txt(l, x, y + 9, 7, font, MUT); txt(v, x, y - 1, 8.5, bold); });
    }
    for (const [l, v] of longos) {
      y -= 12; txt(l, M, y, 7, font, MUT); y += 1;
      for (const ln of quebra(v, W - 2 * M, 8.5, bold)) { y -= 11; txt(ln, M, y, 8.5, bold); }
      y -= 1;
    }
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE });
  };

  // cabeçalho
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: TEAL });
  txt("LAUDO RAIO-X", M, H - 42, 20, bold, rgb(1, 1, 1));
  txt("Consulta cautelar do veículo · TotexCar Co-pilot", M, H - 60, 9.5, font, rgb(0.86, 0.95, 0.93));
  const quando = inp.criadoEm ? new Date(inp.criadoEm) : new Date();
  const qStr = quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const dir = (s: string, yy: number, size: number, f: PDFFont, c = rgb(1, 1, 1)) => txt(s, W - M - larg(s, size, f), yy, size, f, c);
  dir(`Consultado em ${qStr}`, H - 40, 9, bold);
  if (inp.codigo) dir(`Código ${String(inp.codigo).slice(0, 36)}`, H - 54, 7.5, font, rgb(0.86, 0.95, 0.93));
  y = H - 92;

  // veículo (identificação + dados técnicos que vieram preenchidos)
  y -= 30;
  const nome = vb.marcaModelo || [vb.marca, vb.modelo].filter(Boolean).join(" ") || "Veículo";
  txt(nome, M, y, 15, bold);
  const placa = String(inp.placa || vb.placa || "");
  if (placa) {
    const pw = larg(placa, 12, bold) + 20;
    page.drawRectangle({ x: W - M - pw, y: y - 6, width: pw, height: 22, color: rgb(1, 1, 1), borderColor: INK, borderWidth: 1.2 });
    txt(placa, W - M - pw + 10, y, 12, bold);
  }
  y -= 10;
  const prop = d?.estadualDados?.proprietario;
  const campos: [string, unknown][] = [
    ["Ano fab./modelo", [vb.anoFabricacao, vb.anoModelo].filter((v) => !vazio(v)).join(" / ")],
    ["Cor", vb.cor], ["Combustível", vb.combustivel], ["Chassi", vb.chassi], ["Renavam", vb.renavam], ["Motor", vb.motor],
    ["Município / UF", [vb.municipio, vb.uf].filter((v) => !vazio(v)).join(" / ")],
    ["Procedência", vb.procedencia], ["Situação", vb.situacao], ["Situação do chassi", vb.situacaoChassi],
    ["Espécie / tipo", [vb.especieVeiculo, vb.tipoVeiculo].filter((v) => !vazio(v)).join(" / ")],
    ["Categoria", vb.categoria], ["Emplacamento", vb.dataEmplacamento ? `${dataBR(vb.dataEmplacamento)}${vazio(vb.origemEmplacamento) ? "" : ` (${vb.origemEmplacamento})`}` : ""],
    ["Potência", vazio(vb.potencia) ? "" : `${Number(vb.potencia)} cv`], ["Cilindradas", vazio(vb.cilindradas) ? "" : `${Number(vb.cilindradas)} cc`],
    ["Passageiros", vazio(vb.capacidadePassageiros) ? "" : Number(vb.capacidadePassageiros)], ["Eixos", vb.quantidadeEixos],
    ["Peso bruto total", vazio(vb.pesoBrutoTotal) ? "" : `${Number(vb.pesoBrutoTotal)} kg`], ["Nº do câmbio", vb.numeroCaixaCambio], ["Nº da carroceria", vb.numeroCarroceria],
    ["Dono anterior", prop ? (vazio(prop.nomeProprietarioAnterior) ? "Não registrado" : "Registrado (nome omitido)") : ""],
  ].filter(([, v]) => !vazio(v)) as [string, unknown][];
  const colW = (W - 2 * M) / 3;
  for (let i = 0; i < campos.length; i += 3) {
    y -= 26;
    campos.slice(i, i + 3).forEach(([l, v], j) => {
      const x = M + j * colW;
      txt(l, x, y + 10, 7.5, font, MUT);
      txt(quebra(v, colW - 10, 9.5, bold)[0], x, y - 1, 9.5, bold);
    });
  }

  // veredito
  const ver = verificacoesRaiox(d);
  const nAl = ver.filter((v) => !v.ok).length;
  y -= 24;
  page.drawRectangle({ x: M, y: y - 34, width: W - 2 * M, height: 44, color: nAl ? WARN_BG : OK_BG });
  page.drawCircle({ x: M + 22, y: y - 12, size: 9, color: nAl ? WARN : OK });
  txt(nAl ? `${nAl} ponto(s) de atenção` : "Ficha limpa", M + 40, y - 9, 13, bold, nAl ? WARN : OK);
  txt(nAl ? "Veja abaixo o que consta antes de comprar, vender ou financiar." : "Nenhum registro de leilão, sinistro, roubo/furto, restrição ou débito.", M + 40, y - 23, 8.5, font, MUT);
  y -= 34;

  // bases consultadas
  const bases = [
    [d.nacionalDados, "Base Nacional (BIN)"], [d.estadualDados, `Base Estadual (Detran${vb.uf ? `-${vb.uf}` : ""})`], [d.renainfDados, "Renainf"],
    [d.gravameDados, "Gravame"], [d.rouboFurtoDados, "Roubo e furto"], [d.leilaoDados, "Leilão"], [d.sinistroDados, "Indício de sinistro"],
    [inp.fipe && inp.fipe.atual ? 1 : null, "Tabela FIPE"],
  ].filter(([b]) => b).map(([, n]) => String(n));
  y -= 18;
  txt(`${bases.length} BASES CONSULTADAS`, M, y, 7.5, bold, TEAL);
  let bx = M + larg(`${bases.length} BASES CONSULTADAS`, 7.5, bold) + 10;
  for (const b of bases) {
    const bw = larg(b, 7.5, font) + 12;
    if (bx + bw > W - M) { y -= 15; bx = M; }
    page.drawRectangle({ x: bx, y: y - 3.5, width: bw, height: 12, color: TEAL_SOFT });
    txt(b, bx + 6, y, 7.5, font, TEAL);
    bx += bw + 5;
  }

  // verificações
  secao("Verificações");
  for (const v of ver) {
    const detL = v.det ? quebra(v.det, W - 2 * M - 120, 8, font) : [];
    garante(22 + detL.length * 10);
    y -= 15;
    txt(v.t, M, y, 10, bold);
    const pill = v.neutro || (v.ok ? "Nada consta" : "Consta");
    const pw = larg(pill, 8, bold) + 16;
    page.drawRectangle({ x: W - M - pw, y: y - 4, width: pw, height: 15, color: v.neutro ? TEAL_SOFT : v.ok ? OK_BG : WARN_BG });
    txt(pill, W - M - pw + 8, y, 8, bold, v.neutro ? MUT : v.ok ? OK : WARN);
    for (const l of detL) { y -= 11; txt(l, M, y, 8, font, MUT); }
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE });
  }

  // detalhamento — só o que tem registro
  const le = d.leilaoDados, rf = d.rouboFurtoDados, gr = d.gravameDados, si = d.sinistroDados;
  const regsLeilao = lista(le?.registros), regsRoubo = lista(rf?.historico), regsRen = lista(d.renainfDados?.registros), regsGr = lista(gr?.historico);
  const cv = d?.estadualDados?.comunicacaoDeVenda;
  const temCv = cv && (!vazio(cv.indicadorComunicacaoDeVenda) || !vazio(cv.dataVenda) || !vazio(cv.dataComunicacao));
  const temSin = si && (si.sinistroIntegral === true || si.indicioDeSinistro === true);
  if (regsLeilao.length || regsRoubo.length || regsRen.length || regsGr.length || temCv || temSin) {
    secao("Detalhamento", 120);
    regsLeilao.forEach((r: any, i: number) => ficha(`Leilão ${regsLeilao.length > 1 ? `${i + 1} ` : ""}${r.dataLeilao ? `· ${dataBR(r.dataLeilao)}` : ""}`, [
      ["Leiloeiro", r.leiloeiro], ["Comitente (quem vendeu)", r.comitente], ["Lote", r.lote], ["Condições do veículo", r.condicoesVeiculo],
      ["Motor", r.condicoesMotor], ["Câmbio", r.condicoesCambio], ["Mecânica", r.condicoesMecanica], ["Situação do chassi", r.situacaoChassi],
      ["Score", [r.score, r.scorePontuacao].filter((v) => !vazio(v)).join(" · ")], ["Aceitação", r.aceitacaoVeiculo],
      ["Exige vistoria especial", vazio(r.exigeVistoriaEspecial) ? "" : sim(r.exigeVistoriaEspecial) ? "Sim" : String(r.exigeVistoriaEspecial)], ["Observação", r.observacao],
    ]));
    if (le && !vazio(le.score) && !regsLeilao.length) ficha("Leilão", [["Score geral", le.score]]);
    if (temSin) ficha("Sinistro", [
      ["Perda total", si.sinistroIntegral === true ? `Sim${si.dataSinistroIntegral ? `, em ${dataBR(si.dataSinistroIntegral)}` : ""}` : "Não"],
      ["Indício registrado por", si.indicioSinistroSeguradora],
    ]);
    regsRoubo.forEach((r: any, i: number) => ficha(`Roubo / furto ${regsRoubo.length > 1 ? i + 1 : ""}`, [
      ["Ocorrência", r.ocorrencia], ["Data", r.dataOcorrencia ? dataBR(r.dataOcorrencia) : ""], ["Boletim", r.boletim], ["Ano", r.ano],
    ]));
    regsGr.forEach((r: any, i: number) => ficha(`Gravame ${regsGr.length > 1 ? i + 1 : ""}`, [
      ["Situação", r.status], ["Atualizado em", r.dataAtualizacaoStatus ? dataBR(r.dataAtualizacaoStatus) : ""],
      ["Credor (agente financeiro)", r.nomeAgente], ["Data do contrato", r.dataContrato ? dataBR(r.dataContrato) : ""],
      ["Tipo de contrato", r.descricaoContrato], ["Informante", r.informanteRestricao],
      ["UF da restrição", String(r.ufRestricao || "").split("/").pop()], ["Data da restrição", r.dataRestricao ? dataBR(r.dataRestricao) : ""],
    ]));
    regsRen.forEach((r: any, i: number) => {
      const dt = r.detalhes || {}, pg = r.dadosDePagamento || {}, sp = r.dadosDeSuspensao || {};
      const med = [dt.medicaoReal && `medido ${dt.medicaoReal}`, dt.medicaoConsiderada && `considerado ${dt.medicaoConsiderada}`, dt.limitePermitido && `limite ${dt.limitePermitido}`].filter(Boolean).join(" · ");
      ficha(`Multa Renainf ${i + 1}${r.dataInfracao || dt.dataInfracao ? ` · ${dataBR(r.dataInfracao || dt.dataInfracao)}` : ""}`, [
        ["Infração", r.infracao || dt.codInfracao], ["Órgão autuador", r.orgao || dt.orgaoAutuador], ["Local", dt.localInfracao],
        ["Hora", dt.horaInfracao], ["Valor", dt.valorInfracao ? (ehValor(dt.valorInfracao) ? `R$ ${dt.valorInfracao}` : dt.valorInfracao) : ""],
        ["Medição", med ? `${med}${dt.unidadeMedida ? ` ${dt.unidadeMedida}` : ""}` : ""], ["Auto de infração", r.numeroAutoInfracao || dt.numAutoInfracao],
        ["Pagamento", vazio(pg.dataPagamento) && vazio(pg.valorPago) ? "Sem pagamento registrado" : `Pago${pg.valorPago ? ` R$ ${pg.valorPago}` : ""}${pg.dataPagamento ? ` em ${dataBR(pg.dataPagamento)}` : ""}`],
        ["Suspensão", [sp.tipo, sp.origem].filter((v) => !vazio(v)).join(" · ")],
      ]);
    });
    if (temCv) ficha("Comunicação de venda", [
      ["Data da venda", cv.dataVenda ? dataBR(cv.dataVenda) : ""], ["Comunicada em", cv.dataComunicacao ? dataBR(cv.dataComunicacao) : ""],
      ["Nota fiscal", cv.dataNotaFiscal ? dataBR(cv.dataNotaFiscal) : ""], ["Protocolo no Detran", cv.dataProtocoloDetran ? dataBR(cv.dataProtocoloDetran) : ""],
    ]);
  }

  // débitos estaduais: situação, IPVA/DPVAT/licenciamento, só os órgãos de multa com valor, e o total
  const debs = lista(d?.estadualDados?.debitosEstaduais);
  if (debs.length) {
    secao("Débitos estaduais (Detran)");
    const multaZerada = (r: any) => /^MULTAS_/i.test(String(r?.chave || "")) && ehValor(r?.valor) && valorNum(r?.valor) === 0;
    const linhas = debs.filter((r: any) => !multaZerada(r));
    const zeradas = debs.length - linhas.length;
    const linha = (nomeR: string, valor: string, forte: boolean, pend: boolean) => {
      const nomeL = quebra(nomeR, W - 2 * M - 160, 9, forte ? bold : font);
      garante(12 * nomeL.length + 4);
      y -= 13;
      nomeL.forEach((l, i) => txt(l, M, y - i * 11, 9, forte ? bold : font, forte || pend ? INK : MUT));
      const vs = limpa(valor).slice(0, 40);
      txt(vs, W - M - larg(vs, 9, bold), y, 9, bold, pend ? WARN : INK);
      y -= (nomeL.length - 1) * 11;
    };
    for (const r of linhas) {
      const total = /^TOTAL_/i.test(String(r?.chave || ""));
      const pend = ehValor(r?.valor) ? valorNum(r.valor) > 0 : /existe|consta d[eé]bito/i.test(String(r?.valor ?? ""));
      if (total && zeradas) linha(`Demais órgãos de multa (${zeradas})`, "R$ 0,00", false, false);
      linha(String(r?.nome || r?.chave || ""), ehValor(r?.valor) ? `R$ ${r.valor}` : String(r?.valor ?? "—"), total, pend);
    }
  }

  // FIPE (nosso histórico mensal)
  const fp = inp.fipe;
  if (fp && fp.atual && fp.meses.length) {
    secao("Valor de mercado (Tabela FIPE)", 70);
    y -= 20;
    txt(brl(fp.atual), M, y, 16, bold);
    txt(`referência ${fp.meses.at(-1)?.ref}`, M + larg(brl(fp.atual), 16, bold) + 8, y + 1, 8.5, font, MUT);
    const caiu = fp.nivel === "queda" || fp.nivel === "queda_seguida";
    const tag = fp.nivel === "valorizando" ? "Valorizando" : fp.nivel === "estavel" ? "Estável" : caiu ? (fp.nivel === "queda_seguida" ? "Quedas seguidas" : "Em queda") : "";
    if (tag) { const tw = larg(tag, 8, bold) + 16; page.drawRectangle({ x: W - M - tw, y: y - 3, width: tw, height: 15, color: caiu ? WARN_BG : OK_BG }); txt(tag, W - M - tw + 8, y + 1, 8, bold, caiu ? WARN : OK); }
    const ms = fp.meses.slice(-6);
    const cw = (W - 2 * M) / Math.max(ms.length, 1);
    y -= 28;
    ms.forEach((m, i) => { txt(m.ref, M + i * cw, y + 10, 7, font, MUT); txt(brl(m.valor).replace(/,\d{2}$/, ""), M + i * cw, y - 1, 8.5, bold); });
    y -= 4;
    paragrafo(fp.resumo.charAt(0).toUpperCase() + fp.resumo.slice(1) + ".", 8.5, MUT);
  }

  // parecer + análise do provedor (quando vier)
  secao("Parecer TotexCar", 40);
  for (const par of parecerRaiox(d, fp)) { paragrafo(`• ${par}`, 9.5, INK); y -= 3; }
  if (inp.analiseIA && String(inp.analiseIA).trim()) {
    secao("Análise do provedor");
    paragrafo(String(inp.analiseIA));
  }

  // rodapé em todas as páginas
  const pags = doc.getPages();
  const aviso = "Dados das bases nacionais e estaduais no momento da consulta. Documento informativo: não substitui a vistoria física do veículo. Dados pessoais omitidos (LGPD).";
  pags.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.4, color: LINE });
    quebra(aviso, W - 2 * M - 60, 7, font).forEach((l, k) => txt(l, M, 34 - k * 9, 7, font, MUT));
    const pg = `${i + 1}/${pags.length}`;
    txt(pg, W - M - larg(pg, 7.5, bold), 34, 7.5, bold, MUT);
  });

  return await doc.save();
}
