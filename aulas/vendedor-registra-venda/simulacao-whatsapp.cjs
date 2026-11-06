// SIMULAÇÃO (não é captura) do WhatsApp do cliente na entrega, com os TEXTOS REAIS do Co-pilot
// (etiqueta/index.ts: mensagem do scan; _shared/entrega.ts: textoPedidoFoto, textoItens, botões e
// "Entrega registrada"). Gera capturas/w01..w03.png e a ilustração da etiqueta (e01).
const pw = require("playwright");
const fs = require("fs");
const path = require("path");
const DIR = __dirname;
const painel = "data:image/jpeg;base64," + fs.readFileSync(path.join(DIR, "ilustracoes/painel-48230.jpg")).toString("base64");

const carro = "Chevrolet Onix 2022 prata";
const ITENS = ["Carro liga normalmente (bateria ok)", "Painel sem luz de alerta acesa", "Pneus em bom estado, com estepe, macaco, chave de roda e triângulo", "Faróis, setas, luz de freio e de ré funcionando", "Ar-condicionado e limpador funcionando", "Lataria e interior conferidos", "Chaves e manual entregues"];
const negrito = (t) => t.replace(/\*([^*]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
const msgs = {
  scan: "Oi! Escaneei a etiqueta do meu carro 🚗\n#etiqueta cv0016",
  pedeFoto: `🔎 *Checklist de entrega* do seu ${carro}\n\nAntes de sair, vamos conferir juntos (1 minuto):\n\n📸 *Ligue o carro e me mande uma foto do painel* mostrando o km. Confira se não tem nenhuma luz de alerta acesa (injeção, óleo, bateria, freio, airbag).\n\nDepois eu te mando os outros itens pra confirmar com um toque.`,
  itens: `🔎 *Checklist de entrega* · ${carro} (ABC1D23)\n\nConfira com o vendedor:\n${ITENS.map((i) => `▫️ ${i}`).join("\n")}\n\nTocando em *Tudo certo*, você confirma que conferiu esses itens e que o carro saiu em condições de uso, com 48.230 km.`,
  ok: `✅ *Entrega registrada*\n${carro}\n📅 06/11/2026 10:15\n🛣️ 48.230 km\n\nVocê confirmou que o carro saiu em condições de uso. O registro e a foto do painel ficam guardados aqui no seu histórico. Boa viagem! 🚗`,
};
const bolha = (lado, html, hora = "10:1") => `<div class="b ${lado}">${html}<span class="h">${hora}</span></div>`;
const tela = (corpo) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box} body{margin:0;width:390px;height:844px;font-family:Inter,"DejaVu Sans",Arial,sans-serif;background:#0b141a;color:#e9edef;overflow:hidden;position:relative}
.top{height:64px;background:#1f2c34;display:flex;align-items:center;gap:10px;padding:0 14px} .av{width:38px;height:38px;border-radius:50%;background:#0C6E6A;display:grid;place-items:center;font-weight:800}
.nm{font-weight:700} .st{font-size:12px;color:#8696a0}
.chat{padding:10px 10px 0;display:flex;flex-direction:column;gap:6px;height:780px;justify-content:flex-end;padding-bottom:16px}
.b{max-width:86%;padding:7px 9px 18px;border-radius:9px;font-size:13.2px;line-height:1.38;position:relative} .b .h{position:absolute;right:8px;bottom:3px;font-size:10.5px;color:#8696a0}
.eu{align-self:flex-end;background:#005c4b} .ele{align-self:flex-start;background:#1f2c34}
.foto img{width:220px;border-radius:6px;display:block}
.btns{align-self:flex-start;width:86%;display:flex;flex-direction:column;gap:4px;margin-top:-4px} .btn{background:#1f2c34;color:#53bdeb;text-align:center;padding:9px;border-radius:8px;font-size:14px;font-weight:600}
.btn.sel{outline:2px solid #FF8500}
.sim{position:absolute;right:10px;top:70px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#FF8500;background:rgba(0,0,0,.55);padding:3px 7px;border-radius:6px}
</style></head><body><div class="top"><div class="av">C</div><div><div class="nm">TotexCar Co-pilot</div><div class="st">online</div></div></div>
<div class="sim">SIMULAÇÃO</div><div class="chat">${corpo}</div></body></html>`;
const etiqueta = () => {
  // QR ilustrativo (padrão fixo, não lê): só pra mostrar o que o cliente aponta a câmera
  let q = ""; let s = 7;
  for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) { s = (s * 9301 + 49297) % 233280; const fixo = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13); const on = fixo ? ((x % 6 === 0 || y % 6 === 0 || (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5)) && !(x === 6 && y > 6) && !(y === 6 && x > 6) && !(x === 14 || y === 14 ? false : false)) : s / 233280 > 0.5; if (on) q += `<rect x="${x * 10}" y="${y * 10}" width="10" height="10"/>`; }
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;width:390px;height:844px;background:#fff;font-family:Inter,"DejaVu Sans",Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;position:relative}
  .vidro{width:330px;height:430px;border-radius:26px;background:linear-gradient(160deg,#cfe3f2,#9cc3dd);display:grid;place-items:center;border:3px solid #1d2433;transform:rotate(-1.2deg)}
  .et{background:#fff;border-radius:14px;padding:14px;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.18);width:200px} .et b{display:block;font-size:13px;color:#0b1f6b;margin-bottom:8px} .et .n{font-weight:800;font-size:18px;margin-top:8px;letter-spacing:.06em}
  .cap{font-size:17px;font-weight:700;color:#1d2433;text-align:center;max-width:320px} .cap span{color:#FF8500}
  .tag{position:absolute;right:14px;bottom:12px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#FF8500}</style></head><body>
  <div class="vidro"><div class="et"><b>CO-PILOT · CARDOSO</b><svg viewBox="0 0 210 210" width="150" height="150" fill="#111">${q}</svg><div class="n">CV-0016</div></div></div>
  <div class="cap">Etiqueta colada no para-brisa.<br><span>“Aponta a câmera aqui.”</span></div><div class="tag">ILUSTRAÇÃO</div></body></html>`;
};
const frames = {
  e01: etiqueta(),
  w01: tela(bolha("eu", negrito(msgs.scan), "10:12") + bolha("ele", negrito(msgs.pedeFoto), "10:12")),
  w02: tela(bolha("eu foto", `<img src="${painel}">`, "10:13") + bolha("ele", negrito(msgs.itens), "10:13") + `<div class="btns"><div class="btn sel">✅ Tudo certo</div><div class="btn">⚠️ Tem problema</div></div>`),
  w03: tela(bolha("ele", negrito(msgs.itens.split("\n\n")[0]), "10:13") + `<div class="btns"><div class="btn">✅ Tudo certo</div><div class="btn">⚠️ Tem problema</div></div>` + bolha("eu", "✅ Tudo certo", "10:15") + bolha("ele", negrito(msgs.ok), "10:15")),
};
(async () => {
  const b = await pw.chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const [n, html] of Object.entries(frames)) {
    await p.setContent(html); await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(DIR, "capturas", `${n}.png`) });
    console.log("ok", n);
  }
  await b.close();
})();
