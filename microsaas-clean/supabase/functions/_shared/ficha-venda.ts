// FICHA DO CARRO À VENDA — depois da proposta (Venda Express/Vitrine), a Nina coleta no WhatsApp o que a loja
// precisa pra AGIR na hora: placa, km, quitado/financiado, histórico de batida e as FOTOS. Tudo fica no pedido
// (buyback_requests.qualificacao.ficha + .fotos) e aparece no painel "Pedidos de recompra", pronto pra publicar
// no grupo de repasse. As fotos ficam no bucket público car-photos (recompra/<pedido>/…): são fotos de anúncio.
// Estado da conversa: evento whatsapp_events kind=ficha_pending { step, buyback_id, carro, modalidade }.

export const FICHA_KIND = "ficha_pending";
export const MIN_FOTOS = 4;
export const MAX_FOTOS = 15;
export const VALIDADE_DIAS = 7;
const BUCKET = "car-photos";

export type PassoFicha = "placa_km" | "quitado" | "sinistro" | "fotos" | "done";
export type Ficha = {
  placa?: string | null; km?: number | null; quitado?: "quitado" | "financiado" | null;
  sinistro?: "nunca_bateu" | "reparo" | "leilao_sinistro" | null;
  fotos_n?: number; completa?: boolean; completa_em?: string | null; iniciada_em?: string | null;
};

// "ABC1D23 85.000", "placa abc-1234, 85 mil km", "120k" → placa (Mercosul ou antiga) e km
export function parsePlacaKm(texto: string): { placa: string | null; km: number | null } {
  const t = String(texto || "").toUpperCase();
  const mp = t.match(/\b([A-Z]{3})[-\s]?(\d[A-Z0-9]\d{2})\b/);
  const placa = mp ? `${mp[1]}${mp[2]}` : null;
  const resto = (mp ? t.replace(mp[0], " ") : t).toLowerCase();
  let km: number | null = null;
  const mil = resto.match(/(\d{1,3})(?:[.,](\d))?\s*(?:mil|k)\b/);            // 85 mil · 85,5 mil · 120k
  const cheio = resto.match(/\b(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})\b/);            // 85.000 · 85000
  if (mil) km = Number(mil[1]) * 1000 + (mil[2] ? Number(mil[2]) * 100 : 0);
  else if (cheio) km = Number(cheio[1].replace(/[.\s]/g, ""));
  if (km != null && !(km >= 100 && km <= 999_999)) km = null;
  if (km != null && km >= 1950 && km <= 2035 && !/km|rodad|quilom/.test(resto)) km = null; // "é 2020" é o ano, não o km
  return { placa, km };
}
export const lerQuitado = (t: string): Ficha["quitado"] => {
  const n = norm(t);
  if (/financiad|alienad|parcela|devendo|divida|consorcio/.test(n)) return "financiado";
  if (/quitad|pago|sem divida|nao devo/.test(n)) return "quitado";
  return null;
};
export const lerSinistro = (t: string): Ficha["sinistro"] => {
  const n = norm(t);
  if (/leilao|sinistro|perda total|\bpt\b|recuperado/.test(n)) return "leilao_sinistro";
  if (/nunca bateu|nunca|sem batida|original|zero batida/.test(n)) return "nunca_bateu";
  if (/reparo|ja teve|bateu|batida|retoque|repintura|funilaria/.test(n)) return "reparo";
  return null;
};
export const ehPronto = (t: string) => /^(pronto|enviei|terminei|acabei|so isso|e isso|sao essas|finalizar|concluir)\b|pronto,? enviei/.test(norm(t));
export const ehRetomar = (t: string) => /^(ficha|enviar ficha|continuar ficha|mandar (as )?fotos|fotos do carro)\b/.test(norm(t));
export const ehAdiar = (t: string) => norm(t).length <= 30 && /^(depois|agora nao|mais tarde|outra hora|nao posso agora|amanha)\b/.test(norm(t));
const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// ---------- fotos (Storage) ----------
const pasta = (id: string) => `recompra/${id}`;
const urlPublica = (path: string) => `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${path}`;

export async function fotosDaFicha(sb: any, buybackId: string): Promise<string[]> {
  const { data } = await sb.storage.from(BUCKET).list(pasta(buybackId), { limit: 100, sortBy: { column: "name", order: "asc" } });
  return (data || []).filter((o: any) => o.id).map((o: any) => urlPublica(`${pasta(buybackId)}/${o.name}`));
}
// guarda 1 foto; devolve quantas o pedido tem agora (contando no Storage: fotos chegam em paralelo)
export async function salvarFotoFicha(sb: any, buybackId: string, b64: string, mime: string): Promise<{ ok: boolean; total: number }> {
  const ja = await fotosDaFicha(sb, buybackId);
  if (ja.length >= MAX_FOTOS) return { ok: false, total: ja.length };
  const ext = /png/.test(mime) ? "png" : /webp/.test(mime) ? "webp" : "jpg";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const nome = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(`${pasta(buybackId)}/${nome}`, bytes, { contentType: mime || "image/jpeg", upsert: false });
  if (error) { console.error("ficha foto:", error.message); return { ok: false, total: ja.length }; }
  return { ok: true, total: ja.length + 1 };
}

// ---------- pedido ----------
// grava/mescla a ficha dentro de qualificacao (coluna jsonb que já existe: não precisa de SQL)
export async function gravarFicha(sb: any, buybackId: string, patch: Partial<Ficha>, fotos?: string[]): Promise<any | null> {
  const { data: b } = await sb.from("buyback_requests").select("*").eq("id", buybackId).maybeSingle();
  if (!b) return null;
  const q = b.qualificacao && typeof b.qualificacao === "object" ? b.qualificacao : {};
  const ficha: Ficha = { ...(q.ficha || {}), ...patch };
  const nova = { ...q, ficha, ...(fotos ? { fotos } : {}) };
  const { data: up } = await sb.from("buyback_requests").update({ qualificacao: nova, updated_at: new Date().toISOString() }).eq("id", buybackId).select("*").single();
  return up || { ...b, qualificacao: nova };
}

// ---------- textos ----------
export const ROTULO = {
  quitado: { quitado: "Quitado", financiado: "Financiado" } as Record<string, string>,
  sinistro: { nunca_bateu: "Nunca bateu", reparo: "Já teve reparo", leilao_sinistro: "Leilão/sinistro" } as Record<string, string>,
};
export function textoPasso(passo: PassoFicha, ctx: { carro?: string | null; modalidade?: string | null; total?: number }): { texto: string; botoes?: string[] } {
  const carro = ctx.carro || "seu carro";
  if (passo === "placa_km") {
    const ganho = ctx.modalidade === "express" ? "ele entra hoje mesmo no nosso grupo de repasse" : "a loja já prepara o anúncio dele";
    return { texto: `📋 *Último passo pra acelerar a venda do ${carro}*: com a ficha completa, ${ganho}. Leva 2 minutos.\n\n1️⃣ Me mande a *placa* e o *km* atual.\nEx.: ABC1D23 85.000` };
  }
  if (passo === "quitado") return { texto: "2️⃣ O carro está *quitado* ou ainda tem financiamento?", botoes: ["Quitado", "Financiado"] };
  if (passo === "sinistro") return { texto: "3️⃣ Já teve *batida ou reparo* de lataria?", botoes: ["Nunca bateu", "Já teve reparo", "Leilão ou sinistro"] };
  if (passo === "fotos") {
    return { texto: `4️⃣ Agora as *fotos* 📸 (mínimo ${MIN_FOTOS}): frente, traseira, uma lateral, o interior e o painel ligado mostrando o km.\n\nMande aqui mesmo e, quando terminar, toque em *Pronto*.${ctx.total ? `\n\nJá recebi ${ctx.total}.` : ""}`, botoes: ["Pronto, enviei"] };
  }
  return { texto: "" };
}
// resumo de UMA linha (template pra loja e nota do CRM)
export function resumoFicha(b: any): string {
  const f: Ficha = b?.qualificacao?.ficha || {};
  const n = Array.isArray(b?.qualificacao?.fotos) ? b.qualificacao.fotos.length : f.fotos_n || 0;
  return [
    [b?.brand, b?.model, b?.year].filter(Boolean).join(" "),
    f.placa ? `placa ${f.placa}` : null,
    f.km ? `${Number(f.km).toLocaleString("pt-BR")} km` : null,
    f.quitado ? ROTULO.quitado[f.quitado] : null,
    f.sinistro ? ROTULO.sinistro[f.sinistro] : null,
    `${n} foto${n === 1 ? "" : "s"}`,
  ].filter(Boolean).join(" · ");
}
