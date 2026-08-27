// TotexCar Co-pilot — link do CANAL com prévia rica (foto do carro) → abre o Co-pilot.
// Uso: GET /functions/v1/oferta?c=<idDoCarro>  (sem c = vitrine geral).
//
// Negociação por User-Agent (evita o bug de "mostrar o código-fonte" no navegador do WhatsApp):
//  • ROBÔ de preview (facebookexternalhit / WhatsApp bot / etc.): recebe HTML com Open Graph
//    (og:image = foto do carro em JPEG 1200x630 via images.weserv.nl) → o card do post mostra a foto.
//  • PESSOA (navegador real): recebe um 302 direto pro wa.me com "#oferta <id>" → abre o Co-pilot
//    naquele carro + a vitrine (origem=canal). Redirect no nível HTTP = não depende de JS/meta.
// Deploy com verify_jwt=false (link público).

const WA = "5511963786699";
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const APP = (Deno.env.get("APP_URL") || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const brl = (v: unknown) => (v != null && Number(v) > 0 ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "");

// prefere foto NÃO-webp; qualquer foto é normalizada pra JPEG 1200x630 no preview
function pickImage(v: any): string {
  const imgs = Array.isArray(v?.images) ? v.images : [];
  const jpg = imgs.find((i: any) => i?.url && !/\.webp(\?|$)/i.test(String(i.url)));
  const prim = imgs.find((i: any) => i?.isPrimary) || imgs[0];
  return (jpg?.url || prim?.url || "") as string;
}

// navegador de gente (recebe 302). Robôs de preview NÃO têm Chrome/Safari no UA → caem no HTML.
function isHumanBrowser(ua: string): boolean {
  if (!/mozilla/i.test(ua)) return false;
  if (!/(chrome|crios|safari|firefox|fxios|edg|samsungbrowser|opr)\//i.test(ua)) return false;
  if (/facebookexternalhit|externalhit|facebot|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|embedly|skypeuripreview|redditbot|googlebot|bingbot|applebot|pinterest|whatsapp\/\d/i.test(ua)) return false;
  return true;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const c = (url.searchParams.get("c") || "").trim();
  const deepLink = `https://wa.me/${WA}?text=${encodeURIComponent(c ? `#oferta ${c}` : "#oferta")}`;

  // PESSOA → 302 direto pro Co-pilot (não renderiza HTML, não tem bug de "ver código")
  if (isHumanBrowser(req.headers.get("user-agent") || "")) {
    return new Response(null, { status: 302, headers: { Location: deepLink, "Cache-Control": "no-store" } });
  }

  // ROBÔ de preview → HTML com Open Graph (foto + título + preço)
  let title = "TotexMotors — o carro que você procura, no seu WhatsApp";
  let desc = "Toque pra ver os carros e falar com o Co-pilot. 🚗";
  let img = `${APP}/og-image.png`;

  if (c) {
    try {
      const res = await fetch(`${MARKETPLACE}/api/vehicles/${encodeURIComponent(c)}`, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const v = await res.json();
        const t = [v.brand, v.model, v.version].filter(Boolean).join(" ").trim();
        if (t) title = `${t}${v.year ? " " + v.year : ""}`;
        const preco = brl(v.price);
        const loja = v?.dealership?.name ? ` · ${v.dealership.name}` : "";
        desc = `${preco ? preco + " · " : ""}Toque pra ver no WhatsApp 🚗${loja}`;
        const im = pickImage(v);
        if (im) img = `https://images.weserv.nl/?url=${encodeURIComponent("ssl:" + im.replace(/^https?:\/\//i, ""))}&w=1200&h=630&fit=cover&output=jpg&q=82`;
      }
    } catch { /* usa o default */ }
  }

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TotexMotors">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<title>${esc(title)}</title>
<meta http-equiv="refresh" content="0;url=${esc(deepLink)}">
</head><body><a href="${esc(deepLink)}">Abrir no WhatsApp</a></body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
