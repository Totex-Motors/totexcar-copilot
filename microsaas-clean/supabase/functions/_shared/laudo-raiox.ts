// Laudo do Raio-X em PDF (marca TotexCar). O provedor só devolve os dados — o PDF é montado
// aqui a partir da consulta GUARDADA (gpt_consultas), então é sempre o mesmo documento:
// abre no app (doc-open), no cofre e vai pelo WhatsApp depois do pagamento.
// Dados pessoais (nome/CPF do dono e do financiado, nº do contrato) ficam de fora.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

export interface LaudoIn { dados: any; analiseIA?: string | null; placa?: string | null; criadoEm?: string | null; codigo?: string | null }

const W = 595, H = 842, M = 40;
const TEAL = rgb(0.047, 0.431, 0.416), TEAL_SOFT = rgb(0.93, 0.97, 0.96);
const INK = rgb(0.07, 0.09, 0.13), MUT = rgb(0.42, 0.46, 0.52), LINE = rgb(0.88, 0.9, 0.92);
const OK = rgb(0.09, 0.55, 0.33), OK_BG = rgb(0.9, 0.97, 0.93);
const WARN = rgb(0.8, 0.42, 0.06), WARN_BG = rgb(1, 0.95, 0.88);

// Helvetica padrão só tem WinAnsi (cp1252): o resto vira a letra-base ou some (não quebra o PDF).
const CP1252 = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function limpa(s: unknown): string {
  return Array.from(String(s ?? "").replace(/[\r\t]/g, " ")).map((ch) => {
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

type Linha = { t: string; ok: boolean; det?: string };

// Lê os blocos da cautelar → lista de verificações (verde = nada consta, laranja = consta)
export function verificacoesRaiox(d: any): Linha[] {
  const out: Linha[] = [];
  const le = d?.leilaoDados, si = d?.sinistroDados, rf = d?.rouboFurtoDados, gr = d?.gravameDados;
  const est = d?.estadualDados?.restricoesImpedimentos, ren = d?.renainfDados?.resumo, cv = d?.estadualDados?.comunicacaoDeVenda;
  const qtd = (o: any) => Number(o?.quantidadeRegistros ?? (Array.isArray(o?.registros) ? o.registros.length : Array.isArray(o?.historico) ? o.historico.length : 0)) || 0;

  if (le) { const n = qtd(le); const s = le.possuiRegistro === true || n > 0; out.push({ t: "Leilão", ok: !s, det: s ? `${n || 1} registro(s) de leilão` : undefined }); }
  if (si) {
    out.push({ t: "Sinistro com perda total", ok: si.sinistroIntegral !== true, det: si.sinistroIntegral === true && si.dataSinistroIntegral ? `Em ${dataBR(si.dataSinistroIntegral)}` : undefined });
    const ind = si.indicioDeSinistro === true || !vazio(si.indicioSinistroSeguradora);
    out.push({ t: "Indício de sinistro", ok: !ind, det: ind && !vazio(si.indicioSinistroSeguradora) ? String(si.indicioSinistroSeguradora) : undefined });
  }
  if (rf) { const n = qtd(rf); const s = rf.possuiRegistro === true || n > 0; out.push({ t: "Roubo e furto", ok: !s, det: s ? `${n || 1} ocorrência(s)` : undefined }); }
  if (gr) {
    const s = gr.possuiRegistro === true || (Array.isArray(gr.restricoes) && gr.restricoes.length > 0);
    const h = Array.isArray(gr.historico) ? gr.historico[0] : null;
    const det = s ? [
      (gr.restricoes || []).join(", ") || "Gravame ativo",
      h?.nomeAgente ? `agente: ${h.nomeAgente}` : "",
      h?.dataContrato ? `contrato de ${dataBR(h.dataContrato)}` : "",
    ].filter(Boolean).join(" · ") : undefined;
    out.push({ t: "Gravame / financiamento", ok: !s, det });
  }
  if (est) {
    for (const [k, t] of [["restricaoJudicial", "Restrição judicial"], ["restricaoAdministrativa", "Restrição administrativa"], ["restricaoTributaria", "Restrição tributária"], ["restricaoFurto", "Restrição de furto (Detran)"]] as const) {
      if (k in est) out.push({ t, ok: nadaConsta(est[k]), det: nadaConsta(est[k]) ? undefined : String(est[k]) });
    }
  }
  if (ren) {
    const n = Number(ren.quantidadeOcorrenciasTotal ?? ren.quantidadeOcorrencias ?? 0) || 0;
    out.push({ t: "Multas federais (Renainf)", ok: n === 0, det: n ? `${n} ocorrência(s)` : undefined });
  }
  // débitos estaduais com valor (IPVA, DPVAT, licenciamento, multas)
  const debs = Array.isArray(d?.estadualDados?.debitosEstaduais) ? d.estadualDados.debitosEstaduais : [];
  if (debs.length) {
    const pend = debs.filter((r: any) => !/^(STATUS_|TOTAL_)/i.test(String(r?.chave || "")) && valorNum(r?.valor) > 0);
    out.push({ t: "Débitos estaduais (IPVA, licenciamento, multas)", ok: pend.length === 0,
      det: pend.length ? pend.map((r: any) => `${r.nome || r.chave}: R$ ${r.valor}`).join(" · ") : undefined });
  }
  if (cv && !vazio(cv.indicadorComunicacaoDeVenda)) out.push({ t: "Comunicação de venda", ok: false, det: cv.dataVenda ? `Venda comunicada em ${dataBR(cv.dataVenda)}` : "Consta comunicação de venda" });
  return out;
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
  const secao = (t: string) => { garante(40); y -= 22; txt(t.toUpperCase(), M, y, 8.5, bold, TEAL); y -= 8; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE }); y -= 6; };

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

  // veículo
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
  const campos: [string, unknown][] = [
    ["Ano fab./modelo", [vb.anoFabricacao, vb.anoModelo].filter((v) => !vazio(v)).join(" / ")],
    ["Cor", vb.cor], ["Combustível", vb.combustivel], ["Chassi", vb.chassi], ["Renavam", vb.renavam],
    ["Município / UF", [vb.municipio, vb.uf].filter((v) => !vazio(v)).join(" / ")],
    ["Procedência", vb.procedencia], ["Situação", vb.situacao], ["Situação do chassi", vb.situacaoChassi],
    ["Espécie / tipo", [vb.especieVeiculo, vb.tipoVeiculo].filter((v) => !vazio(v)).join(" / ")],
    ["Categoria", vb.categoria], ["Emplacamento", vb.dataEmplacamento ? dataBR(vb.dataEmplacamento) : ""],
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
  txt(nAl ? "Veja abaixo o que consta antes de comprar, vender ou financiar." : "Nenhum registro de leilão, sinistro, roubo/furto ou restrição.", M + 40, y - 23, 8.5, font, MUT);
  y -= 34;

  // verificações
  secao("Verificações");
  for (const v of ver) {
    const detL = v.det ? quebra(v.det, W - 2 * M - 120, 8, font) : [];
    garante(22 + detL.length * 10);
    y -= 15;
    txt(v.t, M, y, 10, bold);
    const pill = v.ok ? "Nada consta" : "Consta";
    const pw = larg(pill, 8, bold) + 16;
    page.drawRectangle({ x: W - M - pw, y: y - 4, width: pw, height: 15, color: v.ok ? OK_BG : WARN_BG });
    txt(pill, W - M - pw + 8, y, 8, bold, v.ok ? OK : WARN);
    for (const l of detL) { y -= 11; txt(l, M, y, 8, font, MUT); }
    y -= 5;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: LINE });
  }

  // débitos estaduais: situação, IPVA/DPVAT/licenciamento, só os órgãos de multa com valor, e o total
  const debs = Array.isArray(d?.estadualDados?.debitosEstaduais) ? d.estadualDados.debitosEstaduais : [];
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

  // análise
  if (inp.analiseIA && String(inp.analiseIA).trim()) {
    secao("Análise");
    for (const l of quebra(inp.analiseIA, W - 2 * M, 9.5, font)) { garante(14); y -= 13; txt(l, M, y, 9.5); }
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
