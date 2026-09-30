import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GptProduto = "raiox" | "crlv" | "debitos";

export interface GptResult {
  ok: boolean;
  cached?: boolean;
  needsPayment?: boolean;
  produto?: GptProduto;
  placa?: string;
  uf?: string | null;
  dados?: any;
  analiseIA?: string | null;
  id?: string;
  preco?: number;
  error?: string;
}

// Dispara uma consulta na edge function gpt-motors (Raio-X / CRLV-e / Débitos).
export async function runGptConsulta(produto: GptProduto, placa: string, uf?: string): Promise<GptResult> {
  try {
    const { data, error } = await supabase.functions.invoke("gpt-motors", { body: { produto, placa, uf } });
    if (error) {
      // erros 4xx/5xx da function trazem o corpo em error.context
      try { const p = await (error as any).context.json(); return p as GptResult; } catch { /* */ }
      return { ok: false, error: String(error.message || error) };
    }
    return data as GptResult;
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

// Inicia o pagamento (Pix/cartão) de uma consulta e redireciona pro checkout Asaas.
export async function startGptCheckout(produto: GptProduto, placa: string, uf?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("gpt-checkout", { body: { produto, placa, uf } });
    if (error) { try { const p = await (error as any).context.json(); return { ok: false, error: p?.error || "erro" }; } catch { return { ok: false, error: String(error.message || error) }; } }
    if (data?.url) { window.location.href = data.url; return { ok: true }; }
    return { ok: false, error: data?.error || "sem_url" };
  } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}

// Busca a última consulta OK do usuário (usado no retorno do pagamento). dados completos.
export async function fetchUltimaConsulta(userId: string, produto: GptProduto, placa?: string): Promise<GptResult | null> {
  let q = supabase.from("gpt_consultas").select("id, produto, placa, uf, dados, analise_ia, created_at")
    .eq("user_id", userId).eq("produto", produto).eq("status", "ok").order("created_at", { ascending: false }).limit(1);
  if (placa) q = q.eq("placa", placa.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  const { data } = await q;
  const c = data?.[0];
  if (!c) return null;
  return { ok: true, produto, placa: c.placa, uf: c.uf, dados: c.dados, analiseIA: c.analise_ia, id: c.id };
}

// Reabre uma consulta salva (com os dados completos) pra rever/baixar de novo.
export async function fetchConsultaById(id: string): Promise<GptResult | null> {
  const { data } = await supabase.from("gpt_consultas")
    .select("id, produto, placa, uf, dados, analise_ia").eq("id", id).single();
  if (!data) return null;
  return { ok: true, produto: data.produto as GptProduto, placa: data.placa, uf: data.uf, dados: data.dados, analiseIA: data.analise_ia, id: data.id };
}

// Histórico das consultas do próprio usuário (RLS: só as dele).
export function useMinhasConsultas(userId?: string, produto?: GptProduto) {
  return useQuery({
    queryKey: ["gpt-consultas", userId, produto || "all"],
    queryFn: async () => {
      if (!userId) return [];
      let q = supabase.from("gpt_consultas").select("id, produto, placa, uf, status, analise_ia, created_at, preco")
        .eq("user_id", userId).eq("status", "ok").order("created_at", { ascending: false }).limit(20);
      if (produto) q = q.eq("produto", produto);
      const { data, error } = await q;
      if (error) return [];
      return data || [];
    },
    enabled: !!userId,
  });
}
