// TotexCar Co-pilot — link do CANAL com prévia rica (foto do carro) → abre o Co-pilot.
// Uso:  GET /functions/v1/oferta?s=<codeCurto>   (via rewrite bonito do app: /o/<code>)
//       GET /functions/v1/oferta?c=<idDoCarro>   (forma antiga, continua valendo)
//       sem parâmetro = vitrine geral (rewrite /oferta).
//
// Negociação por User-Agent (evita o bug de "mostrar o código-fonte" no navegador do WhatsApp):
//  • ROBÔ de preview (facebookexternalhit / WhatsApp bot / etc.): recebe HTML com Open Graph
//    (og:image = foto do carro em JPEG 1200x630 via images.weserv.nl) → o card do post mostra a foto.
//  • PESSOA (navegador real): recebe um 302 direto pro wa.me com uma mensagem HUMANA pré-preenchida
//    ("Oi! Vi o <carro> no canal e quero ver tudo dele 🚗 #oferta <code>") — a pessoa entende o que
//    vai acontecer e só aperta enviar. Redirect no nível HTTP = não depende de JS/meta.
// Deploy com verify_jwt=false (link público).

const WA = "5511963786699";
const MARKETPLACE = (Deno.env.get("MARKETPLACE_URL") || "https://totexmotors.com").replace(/\/+$/, "");
const APP = (Deno.env.get("APP_URL") || "https://copilot.totexmotors.com").replace(/\/+$/, "");
const SB_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const brl = (v: unknown) => (v != null && Number(v) > 0 ? `R$ ${Number(v).toLocaleString("pt-BR")}` : "");

// "Toyota Corolla Corolla Cross XRX" → "Toyota Corolla Cross XRX" (a versão muitas vezes já traz o modelo)
function carNome(v: any): string {
  const brand = String(v?.brand || "").trim(), model = String(v?.model || "").trim(), ver = String(v?.version || "").trim();
  const dup = model && ver.toLowerCase().startsWith(model.toLowerCase());
  return [brand, dup ? "" : model, ver].filter(Boolean).join(" ").trim();
}

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

// code curto (/o/<code>) → id do carro, via PostgREST com service role
async function resolveCode(code: string): Promise<string | null> {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const res = await fetch(`${SB_URL}/rest/v1/oferta_links?code=eq.${encodeURIComponent(code)}&select=car_id&limit=1`, {
      headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.car_id || null;
  } catch { return null; }
}

async function fetchVehicle(carId: string, timeoutMs = 2500): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(`${MARKETPLACE}/api/vehicles/${encodeURIComponent(carId)}`, {
      headers: { Accept: "application/json" }, signal: ctl.signal,
    });
    clearTimeout(t);
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = (url.searchParams.get("s") || "").trim().toLowerCase();
  let carId = (url.searchParams.get("c") || "").trim();
  if (!carId && code) carId = (await resolveCode(code)) || "";

  // o gatilho leva o token MAIS CURTO que resolve o carro (o code do link bonito, se houver)
  const token = code || carId;
  // Indique e Ganhe: repassa o código do indicador (?i= ou ?ind=) como "ind:<code>" no gatilho,
  // pro Co-pilot creditar a indicação (o webhook lê /\bind:([a-z0-9]{4,})\b/). Assim o link com
  // prévia rica (foto do carro) mantém a atribuição que o wa.me direto carregava antes.
  const ind = (url.searchParams.get("i") || url.searchParams.get("ind") || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const gatilho = (token ? `#oferta ${token}` : "#oferta") + (ind ? ` ind:${ind}` : "");

  // PESSOA → 302 pro Co-pilot com mensagem humana pré-preenchida (é só apertar enviar)
  if (isHumanBrowser(req.headers.get("user-agent") || "")) {
    let frase = token
      ? `Oi! Vi um carro no canal e quero ver tudo dele 🚗 ${gatilho}`
      : `Oi! Vim do canal e quero ver os carros 🚗 ${gatilho}`;
    if (carId) {
      const v = await fetchVehicle(carId, 1500);
      const nome = v ? `${carNome(v)}${v.year ? ` ${v.year}` : ""}`.trim() : "";
      if (nome) frase = `Oi! Vi o ${nome} no canal e quero ver tudo dele 🚗 ${gatilho}`;
    }
    const deepLink = `https://wa.me/${WA}?text=${encodeURIComponent(frase)}`;
    return new Response(null, { status: 302, headers: { Location: deepLink, "Cache-Control": "no-store" } });
  }

  // ROBÔ de preview → HTML com Open Graph (foto + título + preço)
  const deepLink = `https://wa.me/${WA}?text=${encodeURIComponent(gatilho)}`;
  let title = "TotexMotors — o carro que você procura, no seu WhatsApp";
  let desc = "Toque pra ver os carros e falar com o Co-pilot. 🚗";
  let img = `${APP}/og-image.png`;

  if (carId) {
    const v = await fetchVehicle(carId);
    if (v) {
      const t = carNome(v);
      if (t) title = `${t}${v.year ? " " + v.year : ""}`;
      const preco = brl(v.price);
      const loja = v?.dealership?.name ? ` · ${v.dealership.name}` : "";
      desc = `${preco ? preco + " · " : ""}Toque pra ver no WhatsApp 🚗${loja}`;
      const im = pickImage(v);
      if (im) img = `https://images.weserv.nl/?url=${encodeURIComponent("ssl:" + im.replace(/^https?:\/\//i, ""))}&w=1200&h=630&fit=cover&output=jpg&q=82`;
    }
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
