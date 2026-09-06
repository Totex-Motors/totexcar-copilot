// build-tenant.mjs — o nó "Build" da fábrica.
// Pega o MOTOR (jj-fidelidade/index.html) + a config de um cliente e gera o
// index.html daquele cliente, injetando window.__TENANT__ e ajustando o <head>.
// Um motor, N clientes: nada de copiar código por loja.
//
// Uso: node build-tenant.mjs <engine.html> <tenant.json> <saida.html>
import fs from 'node:fs';

const [, , enginePath, tenantJsonPath, outPath] = process.argv;
if (!enginePath || !tenantJsonPath || !outPath) {
  console.error('uso: node build-tenant.mjs <engine.html> <tenant.json> <saida.html>');
  process.exit(1);
}

const engine = fs.readFileSync(enginePath, 'utf8');
const cfg = JSON.parse(fs.readFileSync(tenantJsonPath, 'utf8'));
const s = cfg.settings || {};
const b = s.brand || {};
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 1) injeta a config do cliente ANTES do resto (no fim do <head>), para o motor já
//    subir com os padrões desta loja.
const inject = `<script>window.__TENANT__=${JSON.stringify(cfg)};</script>`;
// O motor é um HTML minimalista SEM </head>/<body> literais. Injeta logo após <head>;
// se não houver, antes do 1º <script>. O guard verifica a ATRIBUIÇÃO (window.__TENANT__=),
// que só a injeção produz — o código do motor referencia window.__TENANT__ sem "=".
let html;
if (engine.includes('</head>')) html = engine.replace('</head>', inject + '\n</head>');
else if (engine.includes('<head>')) html = engine.replace('<head>', '<head>\n' + inject);
else html = engine.replace(/<script/, inject + '\n<script');
if (!html.includes('window.__TENANT__=')) throw new Error('falha ao injetar window.__TENANT__ no app do cliente');

// 2) ajusta as tags estáticas do <head> (título e cartão de compartilhamento).
if (b.appTitle) html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(b.appTitle)}</title>`);
if (b.name) {
  html = html.replace(/(<meta property="og:title" content=")[^"]*(">)/, `$1${esc(b.name)} — Cartão Fidelidade$2`);
  html = html.replace(/(<meta property="og:site_name" content=")[^"]*(">)/, `$1${esc(b.name)}$2`);
}
if (s.rule) {
  html = html.replace(/(<meta name="description" content=")[^"]*(">)/, `$1${esc(s.rule)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(">)/, `$1${esc(s.rule)}$2`);
}
if (s.appUrl) {
  const origin = String(s.appUrl).replace(/\/+$/, '');
  html = html.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${esc(origin)}/$2`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${esc(origin)}/og.jpg$2`);
}

fs.writeFileSync(outPath, html);
console.log(`build-tenant: ${cfg.tenant || '(sem nome)'} → ${outPath} (${html.length} bytes)`);
