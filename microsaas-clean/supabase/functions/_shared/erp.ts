// Feed de estoque do ERP da loja (XML da Autoconf): traz a PLACA completa de cada anúncio, que o
// marketplace não tem. Casa com o carro do marketplace pelo erpExternalId (= <ID> do anúncio).

// feed por loja (nome normalizado da loja no Co-pilot)
const FEEDS: Record<string, string> = {
  "cardoso veiculos": "https://autoconf-prod.s3.sa-east-1.amazonaws.com/estoque-site/Y8Q0TzqSZnV6G46jxZP9WucGWWHWgFafZdUSIL8w.xml",
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CACHE_MS = 10 * 60_000;
const cache: Record<string, { em: number; placas: Record<string, string> }> = {};

// "<AD>…<ID>1033762</ID>…<FULL_PLATE>GBR5B23</FULL_PLATE>…</AD>" → { "1033762": "GBR5B23" }
export function placasDoFeed(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ad of xml.split(/<AD>/i).slice(1)) {
    const id = ad.match(/<ID>\s*([^<]+?)\s*<\/ID>/i)?.[1];
    const placa = (ad.match(/<FULL_PLATE>\s*([^<]*?)\s*<\/FULL_PLATE>/i)?.[1] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (id && /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) out[id] = placa;
  }
  return out;
}

// placas do estoque da loja pelo ID do ERP (vazio se a loja não tem feed ou o feed falhar)
export async function placasDoErp(loja: string): Promise<Record<string, string>> {
  const url = FEEDS[norm(loja)];
  if (!url) return {};
  const c = cache[url];
  if (c && Date.now() - c.em < CACHE_MS) return c.placas;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) return c?.placas || {};
    const placas = placasDoFeed(await res.text());
    cache[url] = { em: Date.now(), placas };
    return placas;
  } catch {
    return c?.placas || {};
  }
}
