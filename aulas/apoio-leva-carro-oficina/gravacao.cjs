// Roteiro de GRAVAÇÃO (voz do Marcos): 1 cena por página, letra grande pra ler no celular,
// com a pronúncia dos códigos/números e onde respirar. Gera gravacao-v1.pdf a partir de cenas.js.
const fs = require("fs");
const path = require("path");
const pw = require("playwright");
const A = require("./cenas.js");
const DIR = __dirname;

// como LER (a tela continua mostrando o código escrito)
const PRONUNCIA = [
  [/OS #14/g, "OS catorze"],
  [/48\.210/g, "quarenta e oito mil, duzentos e dez"],
  [/48\.212/g, "quarenta e oito mil, duzentos e doze"],
  [/58\.212/g, "cinquenta e oito mil, duzentos e doze"],
  [/30\.110/g, "trinta mil, cento e dez"],
  [/30\.115/g, "trinta mil, cento e quinze"],
  [/5W30/g, "cinco W trinta"],
  [/0W20/g, "zero W vinte"],
  [/3,5 litros/g, "três litros e meio"],
  [/: 3,5\./g, ": três e meio."],
  [/API SP/g, "A P I, S P"],
  [/ACEA C5/g, "A C E A, C cinco"],
  [/4 litros/g, "quatro litros"],
  [/48\.230/g, "quarenta e oito mil, duzentos e trinta"],
  [/48\.212 quilômetros/g, "quarenta e oito mil, duzentos e doze quilômetros"],
  [/ABC1D23/g, "A B C, um D, dois três"],
  [/BRA2E19/g, "B R A, dois E, um nove"],
  [/CV-0016/g, "C V, zero zero um seis"],
  [/48\.200/g, "quarenta e oito mil e duzentos"],
  [/48\.215/g, "quarenta e oito mil, duzentos e quinze"],
  [/30\.112/g, "trinta mil, cento e doze"],
  [/30\.180/g, "trinta mil, cento e oitenta"],
  [/\bLTL\b/g, "L T L"],
  [/OS 14/g, "OS catorze"],
];
const falada = (t) => PRONUNCIA.reduce((s, [re, por]) => s.replace(re, por), t)
  .replace(/ Pausa\. /, " [silêncio de 3 segundos]. ");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
// quebra em frases: uma por linha, com respiro entre elas
const frases = (t) => t.split(/(?<=[.?!])\s+/).map((f) => f.replace(/\[silêncio de 3 segundos\]\.?/, '<span class="sil">[ fique em silêncio 3 segundos ]</span>'));

let html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Gravação · ${esc(A.titulo)}</title><style>
@page { size: A5; margin: 12mm; }
*{box-sizing:border-box} body{font-family:Inter,"DejaVu Sans",Arial,sans-serif;color:#1d2433;margin:0}
h1{font-size:22px;margin:0 0 6px} .sub{color:#667085;font-size:13px;margin:0 0 12px}
.dicas li{font-size:14px;margin:5px 0;line-height:1.4} .dicas b{color:#FF8500}
.cena{page-break-before:always} .arq{display:inline-block;background:#FF8500;color:#fff;font-weight:800;border-radius:8px;padding:4px 10px;font-size:14px}
.cena h2{font-size:18px;margin:8px 0 12px;color:#667085;font-weight:700}
.f{font-size:21px;line-height:1.45;margin:0 0 12px} .sil{color:#FF8500;font-weight:800;font-size:17px}
.tela{font-size:12px;color:#98a2b3;border-top:1px solid #eee;padding-top:8px;margin-top:16px}
</style></head><body>
<h1>Gravação · ${esc(A.titulo)}</h1><p class="sub">Roteiro aprovado (storyboard v1).</p>
<ul class="dicas">
<li>Grave <b>um áudio por cena</b> no gravador do celular (ou áudio do WhatsApp) e dê o nome da cena: <b>S1, S2, S3, S4, S4b…</b> São ${A.cenas.length} áudios.</li>
<li>Lugar <b>silencioso</b>, sem ventilador nem eco. Celular a <b>um palmo</b> da boca.</li>
<li>Espere <b>1 segundo</b> antes de começar a falar e 1 segundo depois de terminar.</li>
<li>Leia como se explicasse pra alguém da oficina ao seu lado. Sem pressa. Respire entre as frases.</li>
<li>Errou? Pare, respire e <b>repita a frase inteira</b>. Eu corto o erro na edição.</li>
<li>Os números e códigos já estão escritos <b>do jeito de falar</b> (ex.: “cinco W trinta”). Na tela vai aparecer escrito 5W30.</li>
</ul>`;
for (const c of A.cenas) {
  html += `<section class="cena"><span class="arq">${c.id}</span><h2>${esc(c.nome)}</h2>`;
  html += frases(esc(falada(c.fala))).map((f) => `<p class="f">${f}</p>`).join("");
  html += `<div class="tela">Na tela: ${esc(c.mostra)}</div></section>`;
}
html += `</body></html>`;
fs.writeFileSync(path.join(DIR, "gravacao.html"), html);

(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(DIR, "gravacao.html"));
  await p.pdf({ path: path.join(DIR, "gravacao-v1.pdf"), format: "A5", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } });
  await b.close();
  fs.unlinkSync(path.join(DIR, "gravacao.html"));
  console.log("ok gravacao-v1.pdf");
})();
