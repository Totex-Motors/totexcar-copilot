// TotexCar Co-pilot — gera o Kit de boas-vindas em PDF (genérico e por loja).
//
// O PDF é entregue ao cliente que ganha a cortesia da loja (dealer-api postsale_create
// anexa no template do WhatsApp; o webhook manda na 1ª resposta como fallback).
//
// USO:
//   node scripts/build-kit.mjs              → gera todos (geral + cada loja em LOJAS)
//   node scripts/build-kit.mjs cardoso-veiculos
//
// Saída:
//   public/kit-boas-vindas-copilot.pdf   (genérico — fallback de qualquer loja)
//   public/kit/<slug>.pdf                (personalizado com nome + fachada da loja)
//
// Requer Chrome/Edge instalado (headless). Fontes e fotos são embutidas em base64
// para o PDF ficar autocontido.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const KIT = join(HERE, "kit");
const ASSETS = join(KIT, "assets");

// Registro de lojas com kit personalizado. `accent` = cor da marca da loja (usada só
// como fio de assinatura na capa); `photo` = fachada em assets/lojas/.
const LOJAS = [
  { slug: "cardoso-veiculos", nome: "Cardoso Veículos", photo: "cardoso-veiculos.jpg" },
];

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(p).toString("base64")}`;

function chromePath() {
  const cands = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const found = cands.find((c) => existsSync(c));
  if (!found) throw new Error("Chrome não encontrado. Defina CHROME_PATH.");
  return found;
}

function render(html, outPdf) {
  const tmp = join(tmpdir(), `kit-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(tmp, html, "utf8");
  try {
    execFileSync(chromePath(), [
      "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
      `--print-to-pdf=${outPdf}`, `file:///${tmp.replace(/\\/g, "/")}`,
    ], { stdio: "ignore" });
  } finally {
    rmSync(tmp, { force: true });
  }
}

const template = readFileSync(join(KIT, "kit.template.html"), "utf8");
// Imagem do presente (fundo removido de Downloads/"presente png.jpg" via flood-fill).
const giftImg = b64(join(ASSETS, "presente.png"), "image/png");

function build({ slug, nome, photo }) {
  let html = template.replaceAll("{{GIFT_IMG}}", giftImg);
  // personalização: o kit da loja traz o NOME dela no texto (capa, cortesia e rodapé final)
  // e o card da FACHADA na capa; o genérico mantém o texto aprovado ("da sua loja").
  const daLoja = slug ? `da <b style="color:#fff">${nome}</b>, a loja onde você comprou seu carro` : "da loja onde você comprou seu carro";
  const storeBlock = photo
    ? `<div class="storecard"><img src="${b64(join(ASSETS, "lojas", photo), photo.endsWith(".png") ? "image/png" : "image/jpeg")}" alt=""><div class="nm">${nome}</div></div>`
    : (slug ? `<div class="storecard noimg"><div class="nm2">${nome}</div></div>` : "");
  html = html
    .replaceAll("{{PRESENTE_DA_LOJA}}", daLoja)
    .replaceAll("{{CORTESIA_DA_LOJA}}", slug ? nome : "sua loja")
    .replaceAll("{{FOOTER_LOJA}}", slug ? nome : "sua loja")
    .replaceAll("{{STORE_BLOCK}}", storeBlock);

  const out = slug ? join(ROOT, "public", "kit", `${slug}.pdf`) : join(ROOT, "public", "kit-boas-vindas-copilot.pdf");
  mkdirSync(dirname(out), { recursive: true });
  render(html, out);
  const kb = Math.round(readFileSync(out).length / 1024);
  console.log(`✅ ${slug || "geral"} → ${out.replace(ROOT, ".")} (${kb} KB)`);
}

const only = process.argv[2];
if (!only || only === "geral") {
  // genérico: sem fachada (o texto já fala "da sua loja")
  build({ slug: null, nome: "Sua loja parceira", photo: null });
}
for (const loja of LOJAS) {
  if (only && only !== loja.slug) continue;
  build(loja);
}
