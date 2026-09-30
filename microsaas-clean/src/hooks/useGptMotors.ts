import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GptProduto = "raiox" | "crlv" | "debitos" | "cnh";
export const IS_CPF: Record<GptProduto, boolean> = { raiox: false, crlv: false, debitos: false, cnh: true };

export interface GptResult {
  ok: boolean;
  cached?: boolean;
  needsPayment?: boolean;
  produto?: GptProduto;
  placa?: string | null;
  cpf?: string | null;
  uf?: string | null;
  dados?: any;
  analiseIA?: string | null;
  id?: string;
  preco?: number;
  error?: string;
}

// Traduz o erro da consulta pra uma mensagem amigável — e NUNCA mostra JSON/stack técnico do provedor.
export function gptErroMsg(error?: string | null): string {
  const e = String(error || "").trim();
  const map: Record<string, string> = {
    cpf_invalido: "Confira o CPF (11 dígitos).",
    placa_invalida: "Confira a placa.",
    uf_obrigatoria: "Escolha a UF da placa.",
    cnh_indisponivel: "Não consegui os dados da CNH agora — o órgão pode estar indisponível. Tente de novo em instantes.",
    crlv_indisponivel: "Não consegui emitir o CRLV-e agora. Confira se o veículo está licenciado e sem débitos.",
    consulta_sem_retorno: "A consulta não retornou dados agora. Tente de novo em instantes.",
    debitos_indisponivel: "Não consegui consultar os débitos agora. Tente de novo em instantes.",
    integracao_nao_configurada: "Serviço temporariamente indisponível.",
    auth_provedor_falhou: "Serviço temporariamente indisponível. Tente de novo em instantes.",
    preco_invalido: "Valor indisponível no momento.",
    asaas_nao_configurado: "Pagamento indisponível no momento.",
  };
  if (map[e]) return map[e];
  // qualquer coisa técnica/longa/JSON → genérico (não vaza pro usuário)
  if (!e || e.length > 80 || /[{}[\]]|JSON|Exception|LineNumber|isFinalBlock/i.test(e)) return "Não consegui concluir agora. Tente de novo em instantes.";
  return e;
}

// monta o corpo conforme o produto (placa OU cpf)
const identBody = (produto: GptProduto, ident: string, uf?: string) =>
  IS_CPF[produto] ? { produto, cpf: ident } : { produto, placa: ident, uf };

// Dispara uma consulta na edge function gpt-motors (Raio-X / CRLV-e / Débitos / CNH).
export async function runGptConsulta(produto: GptProduto, ident: string, uf?: string): Promise<GptResult> {
  try {
    const { data, error } = await supabase.functions.invoke("gpt-motors", { body: identBody(produto, ident, uf) });
    if (error) {
      try { const p = await (error as any).context.json(); return p as GptResult; } catch { /* */ }
      return { ok: false, error: String(error.message || error) };
    }
    return data as GptResult;
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Inicia o pagamento (Pix/cartão) de uma consulta e redireciona pro checkout Asaas.
export async function startGptCheckout(produto: GptProduto, ident: string, uf?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("gpt-checkout", { body: identBody(produto, ident, uf) });
    if (error) { try { const p = await (error as any).context.json(); return { ok: false, error: p?.error || "erro" }; } catch { return { ok: false, error: String(error.message || error) }; } }
    if (data?.url) { window.location.href = data.url; return { ok: true }; }
    return { ok: false, error: data?.error || "sem_url" };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

// Última consulta OK do usuário (retorno do pagamento). Filtra por placa ou cpf conforme o produto.
export async function fetchUltimaConsulta(userId: string, produto: GptProduto, ident?: string): Promise<GptResult | null> {
  let q = supabase.from("gpt_consultas").select("id, produto, placa, cpf, uf, dados, analise_ia, created_at")
    .eq("user_id", userId).eq("produto", produto).eq("status", "ok").order("created_at", { ascending: false }).limit(1);
  if (ident) q = IS_CPF[produto] ? q.eq("cpf", ident.replace(/\D/g, "")) : q.eq("placa", ident.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  const { data } = await q;
  const c = data?.[0];
  if (!c) return null;
  return { ok: true, produto, placa: c.placa, cpf: c.cpf, uf: c.uf, dados: c.dados, analiseIA: c.analise_ia, id: c.id };
}

// URL https do arquivo da consulta (edge doc-open), pra ABRIR no leitor nativo do aparelho.
// Um blob: não abre no celular/webview (só baixa); uma URL https de verdade abre em qualquer lugar.
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
export async function docFileUrl(consultaId: string): Promise<string | null> {
  try {
    if (!SUPABASE_URL || !consultaId) return null;
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    return `${SUPABASE_URL}/functions/v1/doc-open?id=${encodeURIComponent(consultaId)}&t=${encodeURIComponent(token)}`;
  } catch { return null; }
}

// Reabre uma consulta salva (com os dados completos) pra rever/baixar de novo.
export async function fetchConsultaById(id: string): Promise<GptResult | null> {
  const { data } = await supabase.from("gpt_consultas")
    .select("id, produto, placa, cpf, uf, dados, analise_ia").eq("id", id).single();
  if (!data) return null;
  return { ok: true, produto: data.produto as GptProduto, placa: data.placa, cpf: data.cpf, uf: data.uf, dados: data.dados, analiseIA: data.analise_ia, id: data.id };
}

// Histórico das consultas do próprio usuário (RLS: só as dele). Sem produto = todas (cofre).
export function useMinhasConsultas(userId?: string, produto?: GptProduto) {
  return useQuery({
    queryKey: ["gpt-consultas", userId, produto || "all"],
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase.from("gpt_consultas").select("id, produto, placa, cpf, uf, status, analise_ia, created_at, preco")
        .eq("user_id", userId).eq("status", "ok").order("created_at", { ascending: false }).limit(50);
      if (produto) q = q.eq("produto", produto);
      const { data, error } = await q;
      if (error) return [];
      return data || [];
    },
    enabled: !!userId,
  });
}
