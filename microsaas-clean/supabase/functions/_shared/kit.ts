// Kit de boas-vindas (PDF) entregue ao cliente que ganha a cortesia da loja.
// Cada loja pode ter uma versão personalizada (nome + fachada na capa) gerada por
// `scripts/build-kit.mjs` em public/kit/<slug>.pdf; quem não tem cai no genérico.

export function kitSlug(dealership?: string | null): string {
  return String(dealership || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // Cardoso Veículos → cardoso-veiculos
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const KIT_FILENAME = "Kit-Boas-Vindas-Co-pilot.pdf";

// Devolve a URL do kit da loja se o arquivo existir; senão, a do kit genérico.
// Best-effort: qualquer falha de rede cai no genérico (o envio nunca depende disto).
export async function kitUrlFor(appUrl: string, dealership?: string | null): Promise<string> {
  const base = String(appUrl || "").replace(/\/+$/, "");
  const generico = `${base}/kit-boas-vindas-copilot.pdf`;
  const slug = kitSlug(dealership);
  if (!slug) return generico;
  const personalizado = `${base}/kit/${slug}.pdf`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(personalizado, { method: "HEAD", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok ? personalizado : generico;
  } catch {
    return generico;
  }
}
