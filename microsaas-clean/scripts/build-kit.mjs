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
  { slug: "cardoso-veiculos", nome: "Cardoso Veículos", accent: "#1D3FD1", photo: "cardoso-veiculos.jpg" },
];

// Capa sem foto: degradê escuro (mantém a diagramação idêntica).
const SEM_FOTO = "linear-gradient(155deg, #16233A 0%, #0A1424 70%), radial-gradient(120% 80% at 80% 0%, rgba(15,181,162,.35), transparent 60%)";

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
// Instâncias ESTÁTICAS (uma por peso). Fonte variável faz o Chrome rasterizar o texto no PDF.
const fonts = {
  "{{FONT_ARCHIVO_700}}": b64(join(ASSETS, "fonts/archivo700.woff2"), "font/woff2"),
  "{{FONT_ARCHIVO_800}}": b64(join(ASSETS, "fonts/archivo800.woff2"), "font/woff2"),
  "{{FONT_PLEX_400}}": b64(join(ASSETS, "fonts/plexsans400.woff2"), "font/woff2"),
  "{{FONT_PLEX_500}}": b64(join(ASSETS, "fonts/plexsans500.woff2"), "font/woff2"),
  "{{FONT_PLEX_600}}": b64(join(ASSETS, "fonts/plexsans600.woff2"), "font/woff2"),
  "{{FONT_PLEX_MONO_5}}": b64(join(ASSETS, "fonts/plexmono5.woff2"), "font/woff2"),
  "{{FONT_PLEX_MONO_6}}": b64(join(ASSETS, "fonts/plexmono6.woff2"), "font/woff2"),
};

function build({ slug, nome, accent, photo }) {
  let html = template;
  for (const [k, v] of Object.entries(fonts)) html = html.replaceAll(k, v);
  const photoCss = photo
    ? `url("${b64(join(ASSETS, "lojas", photo), photo.endsWith(".png") ? "image/png" : "image/jpeg")}")`
    : SEM_FOTO;
  html = html
    .replaceAll("{{STORE_PHOTO_CSS}}", photoCss)
    .replaceAll("{{STORE_NAME}}", nome)
    .replaceAll("{{ACCENT}}", accent);

  const out = slug ? join(ROOT, "public", "kit", `${slug}.pdf`) : join(ROOT, "public", "kit-boas-vindas-copilot.pdf");
  mkdirSync(dirname(out), { recursive: true });
  render(html, out);
  const kb = Math.round(readFileSync(out).length / 1024);
  console.log(`✅ ${slug || "geral"} → ${out.replace(ROOT, ".")} (${kb} KB)`);
}

const only = process.argv[2];
if (!only || only === "geral") {
  // genérico: sem foto, sem nome de loja ("sua loja"), acento na cor do produto
  build({ slug: null, nome: "Sua loja parceira", accent: "#0FB5A2", photo: null });
}
for (const loja of LOJAS) {
  if (only && only !== loja.slug) continue;
  build(loja);
}
