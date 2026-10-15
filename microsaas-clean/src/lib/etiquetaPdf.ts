// PDF de verdade das etiquetas QR (só o verso, com o logo da loja), em MILÍMETROS EXATOS.
// Imprimir HTML pelo navegador variava de impressora pra impressora (encolhia, cortava a borda, cache);
// um PDF vetorial aberto no leitor e impresso em "Tamanho real" sai sempre igual.
// Folha A4 EM PÉ (210 × 297 mm): a grade 5 × 3 de etiquetas 50 × 65 mm é desenhada deitada (página
// paisagem com /Rotate 90), igual à folha que a loja já usa. QR desenhado em vetor (módulo a módulo).
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import QRCode from "qrcode";

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;
const NAVY = rgb(0, 0, 0.5), CINZA = rgb(0.54, 0.56, 0.66), CORTE = rgb(0.75, 0.75, 0.75), BRANCO = rgb(1, 1, 1);

// geometria (mm) — página deitada 297 × 210
const PW = 297, PH = 210, EW = 50, EH = 65, COLS = 5, ROWS = 3, GX = 5, GY = 1.5;

// retângulo de cantos arredondados como path SVG (origem no canto de cima à esquerda, y pra baixo)
function rr(w: number, h: number, r: number, soTopo = false) {
  const b = soTopo ? 0 : r;
  return `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - b} ${b ? `A ${b} ${b} 0 0 1 ${w - b} ${h}` : ""} H ${b} ${b ? `A ${b} ${b} 0 0 1 0 ${h - b}` : ""} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

export async function gerarPdfVersoLogo(
  tags: { label: string; token: string }[],
  appUrl: string,
  logo?: { bytes: Uint8Array; png: boolean } | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Etiquetas ${tags[0]?.label || ""} - ${tags[tags.length - 1]?.label || ""}`);
  doc.setCreator("TotexCar Co-pilot");
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  let img: PDFImage | null = null;
  if (logo?.bytes?.length) { try { img = logo.png ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes); } catch { img = null; } }

  const x0 = (PW - (COLS * EW + (COLS - 1) * GX)) / 2;
  const y0 = (PH - (ROWS * EH + (ROWS - 1) * GY)) / 2;

  for (let i = 0; i < tags.length; i += COLS * ROWS) {
    const page = doc.addPage([mm(PW), mm(PH)]);
    page.setRotation(degrees(90)); // sai em pé (retrato) em qualquer impressora
    const lote = tags.slice(i, i + COLS * ROWS);
    for (let k = 0; k < lote.length; k++) {
      const c = k % COLS, r = Math.floor(k / COLS);
      await desenhaEtiqueta(page, lote[k], appUrl, x0 + c * (EW + GX), y0 + r * (EH + GY), { bold, helv, mono, img });
    }
  }
  return await doc.save();
}

// (x, yTopo) em mm, a partir do canto de cima à esquerda da página deitada
async function desenhaEtiqueta(page: PDFPage, t: { label: string; token: string }, appUrl: string, x: number, yTopo: number,
  f: { bold: PDFFont; helv: PDFFont; mono: PDFFont; img: PDFImage | null }) {
  const Y = (v: number) => mm(PH - v);                       // mm a partir do topo → pt do PDF
  const svg = (path: string, ox: number, oy: number, o: any) => page.drawSvgPath(path, { x: mm(ox), y: Y(oy), scale: MM, ...o });
  const centro = (s: string, size: number, font: PDFFont, yBase: number, color = NAVY, esp = 0) => {
    const w = font.widthOfTextAtSize(s, size) + esp * (s.length - 1);
    let cx = mm(x + EW / 2) - w / 2;
    if (!esp) { page.drawText(s, { x: cx, y: Y(yBase), size, font, color }); return; }
    for (const ch of s) { page.drawText(ch, { x: cx, y: Y(yBase), size, font, color }); cx += font.widthOfTextAtSize(ch, size) + esp; }
  };

  // linha de corte (50 × 65) e moldura azul da arte (1 mm pra dentro). Em drawSvgPath tudo (inclusive a
  // espessura da linha) já está em mm por causa do scale.
  svg(rr(EW, EH, 3.5), x, yTopo, { borderColor: CORTE, borderWidth: 0.2, borderDashArray: [1.2, 0.9] });
  const ax = x + 1, ay = yTopo + 1, AW = EW - 2, AH = EH - 2;
  // faixa azul do topo (cantos de cima arredondados)
  const FAIXA = 6.2;
  svg(rr(AW, FAIXA, 3, true), ax, ay, { color: NAVY, borderWidth: 0 });
  svg(rr(AW, AH, 3), ax, ay, { borderColor: NAVY, borderWidth: 0.45 });
  centro("MANUTENÇÃO DO SEU CARRO", 6.2, f.bold, ay + 4.2, BRANCO, 0.75);

  // logo (até 34 × 8 mm)
  let yy = ay + FAIXA + 1.6;
  if (f.img) {
    const s = Math.min(mm(34) / f.img.width, mm(8) / f.img.height);
    const w = f.img.width * s, h = f.img.height * s;
    page.drawImage(f.img, { x: mm(x + EW / 2) - w / 2, y: Y(yy) - h, width: w, height: h });
    yy += h / MM + 1.6;
  }

  // QR em vetor, dentro da caixinha arredondada
  const QRMM = 26, PAD = 1.8, BOX = QRMM + 2 * PAD;
  const bx = x + (EW - BOX) / 2;
  svg(rr(BOX, BOX, 2.5), bx, yy, { borderColor: NAVY, borderWidth: 0.5 });
  const q = QRCode.create(`${appUrl}/q/${t.token}`, { errorCorrectionLevel: "M" });
  const n = q.modules.size, cel = QRMM / n, qx = bx + PAD, qy = yy + PAD;
  for (let rI = 0; rI < n; rI++) {
    for (let cI = 0; cI < n; cI++) {
      if (!q.modules.get(rI, cI)) continue;
      page.drawRectangle({ x: mm(qx + cI * cel), y: Y(qy + (rI + 1) * cel), width: mm(cel) + 0.05, height: mm(cel) + 0.05, color: NAVY });
    }
  }
  yy += BOX;

  // número, frase e assinatura — distribuídos no que sobra até a base da arte
  centro(t.label, 11, f.mono, yy + 4.6, NAVY, 1.3);
  centro("Aponte a câmera e acompanhe", 7.2, f.bold, yy + 8.6);
  centro("a manutenção do seu carro", 7.2, f.bold, yy + 11.4);
  centro("TotexCar Co-pilot", 5.8, f.helv, ay + AH - 1.6, CINZA, 0.25);
}
