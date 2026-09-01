// Gera a página de vendas standalone (fidelidade/index.html) a partir do
// design source Main.dc.html — fonte única da verdade. Tira a linha do
// support.js (que é só do editor de canvas), move os <link> de fonte pro
// <head>, e embrulha num documento completo com SEO/Open Graph, rolagem
// suave e o script que transforma os data-msg em links wa.me.
//
//   node build-fidelidade.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SRC = resolve('Main.dc.html')
const OUT = resolve('../fidelidade/index.html')
const SITE = 'https://fidelidade.vercel.app'

let body = readFileSync(SRC, 'utf8')

// 1) remove a linha do runtime do editor de canvas
body = body.replace(/^\s*<script src="\.\/support\.js"><\/script>\s*\n/, '')

// 2) tira o bloco de fontes do corpo pra reinserir no <head>
const fontBlock = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Spline+Sans+Mono:wght@500;600&display=swap">',
].join('\n')
for (const line of fontBlock.split('\n')) body = body.replace(line + '\n', '')

const title = 'Cartão Fidelidade digital · por Totex'
const desc = 'Troque o cartão de papel por um motor de recompra: selos digitais, indicação no WhatsApp e clientes que voltam sozinhos. A construção é por nossa conta e o 1º mês é grátis.'
const favicon = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%94%A5</text></svg>'

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#e07f24">
<link rel="icon" href="${favicon}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${SITE}/og.jpg">
${fontBlock}
<style>
  html{scroll-behavior:smooth;background:#f6f0e6}
  body{margin:0}
  section[id]{scroll-margin-top:20px}
  /* a página tem largura fixa de 1200px no design; centraliza e deixa fluida no mobile */
  .jjsell{margin:0 auto;max-width:100%}
  @media(max-width:1240px){
    .jjsell{width:100%!important}
    .jjsell .hero{grid-template-columns:1fr!important;gap:36px!important}
    .jjsell .hero .phone{margin-top:8px}
    .jjsell .probs,.jjsell .steps,.jjsell .feats,.jjsell .tiers,.jjsell .roi{grid-template-columns:1fr!important}
    .jjsell .stats{grid-template-columns:1fr 1fr!important}
    .jjsell .gift{grid-template-columns:1fr!important;text-align:center;justify-items:center}
    .jjsell .tier.hot{transform:none!important}
    .jjsell .navlinks span,.jjsell .navlinks a:not(.btn){display:none}
    .jjsell .wrap,.jjsell .nav{padding-left:22px!important;padding-right:22px!important}
    .jjsell h1{font-size:40px!important}
    .jjsell h2{font-size:30px!important}
  }
</style>
</head>
<body>
${body.trimEnd()}
<script>
(function(){
  var P = 'https://wa.me/5511947448137';
  var links = document.querySelectorAll('a.wa[data-msg]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    a.href = P + '?text=' + encodeURIComponent(a.getAttribute('data-msg'));
  }
})();
</script>
</body>
</html>
`

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, html)
console.log('wrote', OUT, '·', html.length, 'bytes')
