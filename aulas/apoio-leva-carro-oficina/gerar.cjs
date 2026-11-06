// Gera roteiro.md + storyboard.html (+ PDF) a partir de cenas.js, capturas/*.png e caixas.json.
const fs = require("fs");
const path = require("path");
const pw = require("playwright");
const DIR = __dirname;
const A = require("./cenas.js");
const caixas = JSON.parse(fs.readFileSync(path.join(DIR, "caixas.json"), "utf8"));
const LARANJA = "#FF8500";
const palavras = (t) => t.split(/\s+/).filter(Boolean).length;
const seg = (t) => Math.round(palavras(t) / 2.6); // estimativa (~156 palavras/min); o tempo real vem do áudio

// ---------- roteiro.md ----------
let md = `# ${A.titulo}\n\n${A.subtitulo}\n\n`;
md += `| | |\n|---|---|\n| **Aluno** | ${A.aluno} |\n| **Situação** | ${A.situacao} |\n| **Objetivo** | ${A.objetivo} |\n| **Exemplo do início ao fim** | ${A.exemplo} |\n| **Onde será assistido** | ${A.destino} |\n| **Visual** | ${A.visual} |\n\n`;
const total = A.cenas.reduce((t, c) => t + seg(c.fala), 0);
md += `Duração estimada pela narração: **~${Math.floor(total / 60)} min ${total % 60} s** (estimativa por contagem de palavras; o tempo final sai do áudio gravado).\n\n`;
md += `> Telas: capturas reais do link da oficina (/oficina/:token) com **dados de demonstração** (placa e foto do painel fictícias). S1, S2 e S12 são **ilustrações**.\n\n`;
for (const c of A.cenas) {
  md += `## ${c.id} · ${c.nome} (~${seg(c.fala)} s)\n\n`;
  md += `**Narração:** ${c.fala}\n\n`;
  md += `**Na tela:** ${c.mostra}${c.tela.startsWith("ilustracao") ? "" : ` _(captura: ${c.tela}.png)_`}\n\n`;
  md += `**Sincronização (âncora na fala → mudança na tela):**\n\n`;
  for (const [ancora, muda] of c.eventos) md += `- ${ancora} → ${muda}\n`;
  md += `\n`;
}
md += `## Estado da produção\n\n- [x] Roteiro e storyboard com o exemplo preenchido (aprovado pelo dono em 06/11/2026)\n- [x] Capturas reais do link (dados de demonstração)\n- [ ] Narração final gravada (voz do Marcos; texto em gravacao-v1.pdf)\n- [ ] Tempos das cenas ajustados ao áudio real (hoje: estimativa)\n- [ ] Composição animada e prévia\n- [ ] Revisão do vídeo exportado\n`;
fs.writeFileSync(path.join(DIR, "roteiro.md"), md);

// ---------- storyboard.html ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// marcação à mão: elipse dupla levemente torta, sublinhado ondulado ou seta curva
function marca(bb, tipo, k) {
  const r = (n) => (n + (Math.sin(k * 7.3 + n) * 1.5)).toFixed(1);
  const { x, y, width: w, height: h } = bb;
  if ((tipo === "circulo" && w > 120) || tipo === "seta") {
    // campo largo: contorno à mão justo (não corta o rótulo de cima)
    const p = 4, x0 = x - p, y0 = y - 1, x1 = x + w + p, y1 = y + h + p;
    return `<path d="M${r(x0 + 8)} ${r(y0)} L ${r(x1 - 6)} ${r(y0 + 1)} Q ${x1} ${y0} ${r(x1 + 1)} ${r(y0 + 7)} L ${r(x1)} ${r(y1 - 6)} Q ${x1} ${y1} ${r(x1 - 7)} ${r(y1 + 1)} L ${r(x0 + 6)} ${r(y1)} Q ${x0} ${y1} ${r(x0 - 1)} ${r(y1 - 7)} L ${r(x0)} ${r(y0 + 8)} Q ${x0} ${y0} ${r(x0 + 10)} ${r(y0 - 1)}"/>`;
  }
  if (tipo === "circulo") {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 9, ry = h / 2 + 5;
    return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" transform="rotate(${(k % 2 ? -1.5 : 1.2)} ${cx} ${cy})"/>
            <ellipse cx="${r(cx + 1)}" cy="${r(cy - 1)}" rx="${r(rx - 3)}" ry="${r(ry + 2)}" transform="rotate(${(k % 2 ? 1 : -1)} ${cx} ${cy})" opacity=".55"/>`;
  }
  if (tipo === "sublinhado") {
    const yy = y + h + 5;
    return `<path d="M${x - 2} ${yy} Q ${x + w * 0.3} ${yy + 4}, ${x + w * 0.55} ${yy + 1} T ${x + Math.min(w, 260)} ${yy + 2}"/>`;
  }
  // seta vindo da direita/baixo apontando pro elemento
  const tx = x + w - 30, ty = y + h + 4, sx = Math.min(tx + 22, 382), sy = ty + 58;
  return `<path d="M${sx} ${sy} C ${sx + 10} ${sy - 30}, ${tx + 25} ${ty + 25}, ${tx} ${ty}"/>
          <path d="M${tx} ${ty} l 4 16 M${tx} ${ty} l 15 6"/>`;
}
const ilustracao = A.ilustracoes || {};
let html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(A.titulo)} · storyboard</title><style>
@page { size: A4; margin: 14mm; }
*{box-sizing:border-box} body{font-family:Inter,"DejaVu Sans",Arial,sans-serif;color:#1d2433;margin:0;background:#fff}
h1{font-size:26px;margin:0 0 4px} .sub{color:#667085;margin:0 0 14px}
.meta{border-collapse:collapse;width:100%;font-size:12.5px;margin-bottom:10px} .meta td{border-top:1px solid #eee;padding:6px 8px;vertical-align:top} .meta td:first-child{font-weight:700;width:150px;color:${LARANJA}}
.aviso{font-size:12px;background:#FFF4E8;border-left:4px solid ${LARANJA};padding:8px 10px;margin:10px 0}
.cena{page-break-before:always;display:flex;gap:18px;align-items:flex-start}
.quadro{position:relative;width:300px;flex:none;border:1px solid #ddd;border-radius:14px;overflow:hidden;background:#fff}
.quadro img{width:300px;display:block} .quadro svg{position:absolute;inset:0} .quadro svg *{fill:none;stroke:${LARANJA};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.txt{flex:1;font-size:13px;line-height:1.5} .id{font-size:12px;font-weight:800;color:${LARANJA};letter-spacing:.08em} .txt h2{margin:2px 0 10px;font-size:20px}
.fala{font-size:15px;background:#F7F8FA;border-radius:10px;padding:10px 12px;margin:6px 0 10px} .lbl{font-weight:700;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:#667085;margin-top:8px}
.ev{margin:4px 0 0 0;padding-left:18px} .tempo{color:#667085;font-size:12px}
.ilu{position:relative;height:560px;padding:22px;display:flex;flex-direction:column;gap:18px;background:#fff}
.ficha{border:2.5px solid #1d2433;border-radius:12px;padding:14px;font-size:15px;position:relative;transform:rotate(-0.6deg)} .ficha.ok{border-color:#16a34a}
.ficha b{display:block;margin-bottom:8px} .lin{padding:5px 0;border-bottom:1px dashed #ccc} .vazio{color:${LARANJA};font-weight:800}
.grande{position:absolute;right:14px;top:6px;font-size:58px;color:${LARANJA};font-weight:900;transform:rotate(8deg)}
.balao{border:2.5px solid ${LARANJA};border-radius:18px;padding:12px 14px;font-size:15px;align-self:flex-end;max-width:240px;transform:rotate(1deg)} .balao.verde{border-color:#16a34a}
.fotos{display:flex;gap:8px;margin-top:10px} .ft{border:2px solid ${LARANJA};border-radius:8px;padding:6px 8px;font-size:12.5px}
.seta{font-size:34px;color:${LARANJA};align-self:center;transform:rotate(90deg)} .pergunta{margin-top:14px;border:2.5px solid ${LARANJA};border-radius:10px;padding:10px;font-weight:700}
.tag{position:absolute;right:12px;bottom:10px;font-size:11px;color:${LARANJA};font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.estado li{margin:3px 0}
</style></head><body>
<h1>${esc(A.titulo)}</h1><p class="sub">${esc(A.subtitulo)} · storyboard v1 para aprovação</p>
<table class="meta"><tr><td>Aluno</td><td>${esc(A.aluno)}</td></tr><tr><td>Situação</td><td>${esc(A.situacao)}</td></tr><tr><td>Objetivo</td><td>${esc(A.objetivo)}</td></tr><tr><td>Exemplo</td><td>${esc(A.exemplo)}</td></tr><tr><td>Onde assiste</td><td>${esc(A.destino)}</td></tr><tr><td>Visual</td><td>${esc(A.visual)}</td></tr><tr><td>Duração</td><td>~${Math.floor(total / 60)} min ${total % 60} s (estimada pelas palavras; o tempo final sai do áudio)</td></tr></table>
<div class="aviso">As telas são <b>capturas reais do link da oficina</b> com <b>dados de demonstração</b>: a placa e a foto do painel são fictícias. S1, S2 e S12 são ilustrações. As marcações laranja mostram onde o foco vai estar quando a voz falar o trecho indicado.</div>
<div class="lbl">Estado da produção</div><ul class="estado"><li>✅ Roteiro e storyboard com o exemplo preenchido</li><li>✅ Capturas reais do link (dados de demonstração)</li><li>⏳ Narração final (voz a definir e autorizar)</li><li>⏳ Tempos ajustados ao áudio real</li><li>⏳ Animação, prévia e revisão do vídeo exportado</li></ul>`;
A.cenas.forEach((c, i) => {
  let quadro;
  if (c.tela.startsWith("ilustracao:")) quadro = ilustracao[c.tela.split(":")[1]];
  else {
    const img = fs.readFileSync(path.join(DIR, "capturas", `${c.tela}.png`)).toString("base64");
    const marcas = (c.marcas || []).map(([q, el, tipo], k) => caixas[q]?.[el] ? marca(caixas[q][el], tipo, k + i) : "").join("");
    quadro = `<img src="data:image/png;base64,${img}"><svg viewBox="0 0 390 844" preserveAspectRatio="xMinYMin meet">${marcas}</svg>`;
  }
  html += `<section class="cena"><div class="quadro">${quadro}</div><div class="txt"><div class="id">CENA ${c.id}</div><h2>${esc(c.nome)}</h2>
    <div class="lbl">Narração <span class="tempo">· ~${seg(c.fala)} s</span></div><div class="fala">${esc(c.fala)}</div>
    <div class="lbl">Na tela</div><div>${esc(c.mostra)}</div>
    <div class="lbl">Sincronização</div><ul class="ev">${c.eventos.map(([a, m]) => `<li><b>${esc(a)}</b> → ${esc(m)}</li>`).join("")}</ul></div></section>`;
});
html += `</body></html>`;
fs.writeFileSync(path.join(DIR, "storyboard.html"), html);

(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(DIR, "storyboard.html"));
  await p.waitForTimeout(500);
  await p.pdf({ path: path.join(DIR, "storyboard-v1.pdf"), format: "A4", printBackground: true, margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" } });
  await b.close();
  console.log("ok · cenas:", A.cenas.length, "· duração estimada:", total, "s");
})();
