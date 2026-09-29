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
