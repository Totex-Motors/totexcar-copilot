// TotexCar Co-pilot — link do CANAL com prévia rica (foto do carro) → abre o Co-pilot.
// Uso: GET /functions/v1/oferta?c=<idDoCarro>  (sem c = vitrine geral).
// - O bot de preview do WhatsApp faz GET e lê as tags Open Graph → mostra a FOTO do carro,
//   o título e o preço no card do post (em vez do card vazio da logo).
// - A pessoa que toca é redirecionada pro wa.me com "#oferta <id>" → o Co-pilot manda aquele
//   carro em destaque + a vitrine, marcado como origem=canal (funil do piloto).
// Deploy com verify_jwt=false (link público).

const WA = "5511963786699";
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const APP = (Deno.env.get("APP_URL") || "https://totexcarco-pilot.vercel.app").replace(/\/+$/, "");

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const brl = (v: unknown) => (v != null && Number(v) > 0 ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "");

// prefere foto NÃO-webp (o preview do WhatsApp às vezes não renderiza webp)
function pickImage(v: any): string {
  const imgs = Array.isArray(v?.images) ? v.images : [];
  const jpg = imgs.find((i: any) => i?.url && !/\.webp(\?|$)/i.test(String(i.url)));
  const prim = imgs.find((i: any) => i?.isPrimary) || imgs[0];
  return (jpg?.url || prim?.url || "") as string;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const c = (url.searchParams.get("c") || "").trim();
  const deepLink = `https://wa.me/${WA}?text=${encodeURIComponent(c ? `#oferta ${c}` : "#oferta")}`;

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
        // normaliza pra JPEG 1200x630 (o preview do WhatsApp não renderiza webp de forma confiável)
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
<style>html,body{height:100%}body{margin:0;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;background:#0b1312;color:#e9f0ed}a{color:#33b7ae}</style>
</head><body>
<script>location.replace(${JSON.stringify(deepLink)});</script>
<p>Abrindo o WhatsApp… se não abrir, <a href="${esc(deepLink)}">toque aqui</a>.</p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
