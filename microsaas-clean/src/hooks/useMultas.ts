import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Multa {
  id: string;
  orgao: string | null;
  auto_numero: string | null;
  data_infracao: string | null;
  local: string | null;
  enquadramento: string | null;
  descricao: string | null;
  valor: number | null;
  pontos: number | null;
  placa: string | null;
  prazo_recurso: string | null;
  gravidade: string | null;
  chance: "baixa" | "media" | "alta" | string | null;
  status: "nova" | "recurso_gerado" | "protocolada" | "deferida" | "indeferida" | string;
  recurso_texto: string | null;
  created_at: string;
}

// `multas` não está nos types gerados — acesso via (supabase as any), RLS escopa pelo dono.
export const useMultas = (userId?: string | null) =>
  useQuery({
    queryKey: ["multas", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("multas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Multa[];
    },
    enabled: !!userId,
  });

export const useUpdateMultaStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("multas").update({ status: p.status }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["multas"] }),
  });
};
