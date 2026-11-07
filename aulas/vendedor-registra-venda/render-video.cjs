// Monta o VÍDEO da aula: alinha a fala do roteiro (cenas.js) com a transcrição local do áudio gravado
// (palavra a palavra), gera um quadro 1080×1920 pra cada mudança de tela/marcação no instante da âncora
// (video.js) e junta com o áudio normalizado. Uso: node render-video.cjs <pasta-transcricao> <pasta-audios> <saida.mp4>
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const pw = require("playwright");
const DIR = __dirname;
const [TRANS, AUDIOS, SAIDA] = process.argv.slice(2);
const A = require("./cenas.js");
const TL = require("./video.js");
const caixas = { ...JSON.parse(fs.readFileSync(path.join(DIR, "caixas.json"), "utf8")), ...JSON.parse(fs.readFileSync(path.join(DIR, "caixas-sim.json"), "utf8")) };
const LARANJA = "#FF8500";
const TMP = path.join(SAIDA + ".quadros"); fs.mkdirSync(TMP, { recursive: true });

// ---------- alinhamento roteiro ↔ áudio ----------
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
function alinhar(fala, palavras) {
  const a = norm(fala), b = palavras.map((w) => norm(w.p).join(""));
  const n = a.length, m = b.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const pares = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { pares.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  return { a, pares };
}
function instante(ancora, al, palavras) {
  const q = norm(ancora);
  for (let i = 0; i + q.length <= al.a.length; i++) {
    if (q.every((t, k) => al.a[i + k] === t)) {
      const par = al.pares.find(([fi]) => fi >= i);
      if (par) return Math.max(0, palavras[par[1]].ini - 0.12);
    }
  }
  throw new Error(`âncora não achada: "${ancora}"`);
}

// ---------- marcação à mão (mesma linguagem do storyboard) ----------
function marca(bb, tipo, k) {
  const r = (n) => (n + Math.sin(k * 7.3 + n) * 1.5).toFixed(1);
  const { x, y, width: w, height: h } = bb;
  if (tipo === "circulo" && w > 120) {
    const p = 4, x0 = x - p, y0 = y - 1, x1 = x + w + p, y1 = y + h + p;
    return `<path d="M${r(x0 + 8)} ${r(y0)} L ${r(x1 - 6)} ${r(y0 + 1)} Q ${x1} ${y0} ${r(x1 + 1)} ${r(y0 + 7)} L ${r(x1)} ${r(y1 - 6)} Q ${x1} ${y1} ${r(x1 - 7)} ${r(y1 + 1)} L ${r(x0 + 6)} ${r(y1)} Q ${x0} ${y1} ${r(x0 - 1)} ${r(y1 - 7)} L ${r(x0)} ${r(y0 + 8)} Q ${x0} ${y0} ${r(x0 + 10)} ${r(y0 - 1)}"/>`;
  }
  if (tipo === "circulo") {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 9, ry = h / 2 + 5;
    return `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" transform="rotate(${k % 2 ? -1.5 : 1.2} ${cx} ${cy})"/><ellipse cx="${r(cx + 1)}" cy="${r(cy - 1)}" rx="${r(rx - 3)}" ry="${r(ry + 2)}" transform="rotate(${k % 2 ? 1 : -1} ${cx} ${cy})" opacity=".55"/>`;
  }
  const yy = y + h + 5;
  return `<path d="M${x - 2} ${yy} Q ${x + w * 0.3} ${yy + 4}, ${x + w * 0.55} ${yy + 1} T ${x + Math.min(w, 260)} ${yy + 2}"/>`;
}

// ---------- ilustrações com estados ----------
const CSS_ILU = `.ilu{position:relative;height:844px;padding:40px 24px;display:flex;flex-direction:column;justify-content:center;gap:22px;background:#fff;font-family:Inter,"DejaVu Sans",Arial,sans-serif;color:#1d2433}
.ficha{border:2.5px solid #1d2433;border-radius:12px;padding:16px;font-size:16px;position:relative;transform:rotate(-0.6deg);background:#fff} .ficha.ok{border-color:#16a34a}
.ficha b{display:block;margin-bottom:8px;font-size:17px} .lin{padding:7px 0;border-bottom:1px dashed #ccc} .vazio{color:${LARANJA};font-weight:800}
.lin.feito{font-weight:700;border-left:5px solid ${LARANJA};padding-left:8px}
.grande{position:absolute;right:14px;top:4px;font-size:64px;color:${LARANJA};font-weight:900;transform:rotate(8deg)}
.balao{border:2.5px solid ${LARANJA};border-radius:18px;padding:14px 16px;font-size:16px;align-self:flex-end;max-width:270px;transform:rotate(1deg);background:#fff} .balao.verde{border-color:#16a34a}
.seta{font-size:38px;color:${LARANJA};align-self:center;transform:rotate(90deg)} .pergunta{margin-top:14px;border:2.5px solid ${LARANJA};border-radius:10px;padding:12px;font-weight:700;line-height:1.45}
.resp{margin-top:10px;border-radius:10px;padding:10px 12px;background:#ECFDF3;border:2px solid #16a34a;font-weight:700;color:#14532d;line-height:1.4}
.tag{position:absolute;right:14px;bottom:12px;font-size:11px;color:${LARANJA};font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.oculto{visibility:hidden}`;
function ilustracao(nome, estado) {
  let h = A.ilustracoes[nome];
  if (nome === "problema" && estado === 0) h = h.replace('<div class="grande">?</div>', '<div class="grande oculto">?</div>');
  if (nome === "caminho") {
    let k = 0;
    h = h.replace(/<div class="lin">/g, () => (++k <= estado ? '<div class="lin feito">' : '<div class="lin">'));
    if (estado < 5) h = h.replace('<div class="seta">', '<div class="seta oculto">').replace('<div class="balao verde">', '<div class="balao verde oculto">');
  }
  if (nome === "pratica") {
    const r1 = estado >= 1 ? '<div class="resp">1. Antes: avise o Lucas pra revisar o carro na oficina.</div>' : "";
    const r2 = estado >= 2 ? '<div class="resp">2. Não: com “Tem problema”, resolvam primeiro. Só sai com ✅ Tudo certo.</div>' : "";
    h = h.replace(/<\/div><div class="tag">/, `${r1}${r2}</div><div class="tag">`);
  }
  return h;
}

// ---------- quadro 1080×1920 ----------
const ESC = 1780 / 844; // tela do celular (390×844 CSS) ocupa 1780 px de altura
function quadroHtml(quadro, marcas) {
  let miolo;
  if (quadro.startsWith("ilu:")) { const [, nome, est] = quadro.split(":"); miolo = `<div class="tela ilu-wrap">${ilustracao(nome, Number(est))}</div>`; }
  else {
    const img = fs.readFileSync(path.join(DIR, "capturas", `${quadro}.png`)).toString("base64");
    const svg = marcas.map(([el, tipo], k) => (caixas[quadro]?.[el] ? marca(caixas[quadro][el], tipo, k) : "")).join("");
    miolo = `<div class="tela"><img src="data:image/png;base64,${img}"><svg viewBox="0 0 390 844">${svg}</svg></div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0} body{width:1080px;height:1920px;background:#F4F5F7;display:flex;align-items:center;justify-content:center}
  .tela{position:relative;width:390px;height:844px;transform:scale(${ESC});border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.18)}
  .tela img{width:390px;height:844px;display:block} .tela svg{position:absolute;inset:0;width:390px;height:844px}
  .tela svg *{fill:none;stroke:${LARANJA};stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
  ${CSS_ILU}</style></head><body>${miolo}</body></html>`;
}

(async () => {
  // 1) estados com tempo
  const estados = []; let t0 = 0; const audios = [];
  for (const c of A.cenas) {
    const tr = JSON.parse(fs.readFileSync(path.join(TRANS, `${c.id}.json`), "utf8"));
    const al = alinhar(c.fala, tr.palavras);
    let quadro = null, marcas = [];
    for (const ev of TL[c.id]) {
      const t = ev.ancora ? instante(ev.ancora, al, tr.palavras) : 0;
      if (ev.quadro && ev.quadro !== quadro) { quadro = ev.quadro; marcas = []; }
      marcas = [...marcas, ...(ev.marcas || [])];
      estados.push({ cena: c.id, t: t0 + t, quadro, marcas: [...marcas] });
    }
    const arq = fs.readdirSync(AUDIOS).find((f) => f === `${c.id}.m4a` || f.endsWith(`-${c.id}.m4a`));
    audios.push(path.join(AUDIOS, arq));
    t0 += tr.duracao;
  }
  const total = t0;
  // 2) quadros
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const lista = [];
  for (const [k, e] of estados.entries()) {
    const png = path.join(TMP, `q${String(k).padStart(3, "0")}.png`);
    await p.setContent(quadroHtml(e.quadro, e.marcas)); await p.waitForTimeout(120);
    await p.screenshot({ path: png });
    const fim = k + 1 < estados.length ? estados[k + 1].t : total;
    lista.push(`file '${png}'\nduration ${(fim - e.t).toFixed(3)}`);
    console.log(`${e.cena} ${e.t.toFixed(2)}s ${e.quadro} ${e.marcas.map((m) => m[0]).join(",")}`);
  }
  await b.close();
  lista.push(`file '${path.join(TMP, `q${String(estados.length - 1).padStart(3, "0")}.png`)}'`);
  fs.writeFileSync(path.join(TMP, "lista.txt"), lista.join("\n"));
  // 3) áudio: cenas em sequência, volume normalizado
  const listaAud = audios.map((a) => `file '${a}'`).join("\n"); fs.writeFileSync(path.join(TMP, "audios.txt"), listaAud);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", path.join(TMP, "audios.txt"), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "160k", path.join(TMP, "audio.m4a")]);
  // 4) vídeo
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", path.join(TMP, "lista.txt"), "-i", path.join(TMP, "audio.m4a"),
    "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "copy", "-shortest", "-movflags", "+faststart", SAIDA]);
  console.log("ok", SAIDA, `${total.toFixed(1)} s, ${estados.length} quadros`);
})();
