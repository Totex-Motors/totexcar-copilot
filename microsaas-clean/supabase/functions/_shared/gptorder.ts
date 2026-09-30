// Cria uma cobrança avulsa (Asaas) para UMA consulta GPT Motors e o pedido (gpt_orders).
// Usado pela function gpt-checkout (app) e pelo whatsapp-webhook (Co-pilot).
import { PRICE_COL, normPlaca, type GptProduto } from "./gptmotors.ts";

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
export const GPT_NOME: Record<GptProduto, string> = { raiox: "Raio-X do carro", crlv: "CRLV-e", debitos: "Débitos & Multas" };
export const GPT_PATH: Record<GptProduto, string> = { raiox: "/historico", crlv: "/crlv", debitos: "/multas" };

export interface CreateGptCheckoutOpts { userId: string; produto: GptProduto; placa: string; uf?: string; phone?: string | null; origem?: string }
export interface CreateGptCheckoutOut { ok: boolean; url?: string; orderId?: string; preco?: number; error?: string }

// admin = supabase-js client (service role)
export async function createGptCheckout(admin: any, opts: CreateGptCheckoutOpts): Promise<CreateGptCheckoutOut> {
  const produto = opts.produto;
  const placa = normPlaca(opts.placa);
  if (!["raiox", "crlv", "debitos"].includes(produto)) return { ok: false, error: "produto_invalido" };
  if (!placa || placa.length < 7) return { ok: false, error: "placa_invalida" };

  const { data: s } = await admin.from("app_settings")
    .select(`asaas_api_key, asaas_sandbox, app_url, ${PRICE_COL[produto]}`).eq("id", 1).single();
  const preco = Number((s as any)?.[PRICE_COL[produto]] ?? 0);
  const apiKey = (s as any)?.asaas_api_key;
  if (!apiKey) return { ok: false, error: "asaas_nao_configurado" };
  if (!preco || preco <= 0) return { ok: false, error: "preco_invalido" };

  const { data: order, error: oerr } = await admin.from("gpt_orders")
    .insert({ user_id: opts.userId, produto, placa, uf: opts.uf || null, preco, status: "pending", phone: opts.phone || null, origem: opts.origem || "app" })
    .select("id").single();
  if (oerr || !order) return { ok: false, error: "order_falhou" };

  const base = (s as any)?.asaas_sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
  const appUrl = ((s as any)?.app_url || "").replace(/\/+$/, "");
  const body = {
    billingTypes: ["PIX", "CREDIT_CARD"],
    chargeTypes: ["DETACHED"],
    minutesToExpire: 60,
    callback: { successUrl: `${appUrl}${GPT_PATH[produto]}?status=success`, cancelUrl: `${appUrl}${GPT_PATH[produto]}?status=cancel` },
    items: [{ name: GPT_NOME[produto].slice(0, 30), description: `${GPT_NOME[produto]} — placa ${placa}`, quantity: 1, value: preco, imageBase64: PIXEL }],
    externalReference: `gpt:${order.id}`,
  };
  try {
    const res = await fetch(`${base}/checkouts`, { method: "POST", headers: { "Content-Type": "application/json", access_token: apiKey }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { console.error("Asaas gpt-checkout erro:", res.status, JSON.stringify(data)); return { ok: false, error: data?.errors?.[0]?.description || `Asaas ${res.status}` }; }
    await admin.from("gpt_orders").update({ asaas_checkout_id: String(data.id || "") }).eq("id", order.id);
    const url = data.link || data.url || (data.id ? `${base.replace("/v3", "")}/checkoutSession/show/${data.id}` : null);
    return { ok: true, url: url || undefined, orderId: order.id, preco };
  } catch (e) {
    return { ok: false, error: String((e as any)?.message || e) };
  }
}
