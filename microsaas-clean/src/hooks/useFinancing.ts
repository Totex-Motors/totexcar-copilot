import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Financiamento {
  id: string;
  user_id: string;
  account_id: string | null;
  banco: string | null;
  valor_parcela: number;
  num_parcelas: number;
  parcelas_pagas: number;
  primeira_parcela: string; // yyyy-mm-dd
  valor_total: number | null;
  valor_entrada: number | null;
  boleto_linha: string | null;
  ativo: boolean;
  created_at: string;
}

// tabela nova ainda não está no types gerado — acesso destipado, contido aqui
const sb = () => supabase as any;

export const useFinancings = (userId?: string) =>
  useQuery({
    queryKey: ["financiamentos", userId],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("financiamentos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Financiamento[];
    },
    enabled: !!userId,
  });

export const useCreateFinancing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Financiamento> & { user_id: string; valor_parcela: number; num_parcelas: number; primeira_parcela: string }) => {
      const { error } = await sb().from("financiamentos").insert(p);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiamentos"] }),
  });
};

export const useUpdateFinancing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string } & Partial<Financiamento>) => {
      const { id, ...rest } = p;
      const { error } = await sb().from("financiamentos").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiamentos"] }),
  });
};

export const useDeleteFinancing = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("financiamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financiamentos"] }),
  });
};

// Soma N meses a uma data (yyyy-mm-dd), mantendo o dia (ajusta fim de mês).
function addMonths(dateStr: string, months: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = new Date(y, (m - 1) + months, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d, lastDay));
  return base;
}

// Situação do financiamento: próxima parcela, dias restantes, quitado.
export function financingStatus(f: Financiamento) {
  const quitado = f.parcelas_pagas >= f.num_parcelas;
  const proximaData = quitado ? null : addMonths(f.primeira_parcela, f.parcelas_pagas);
  const restantes = Math.max(0, f.num_parcelas - f.parcelas_pagas);
  let dias: number | null = null;
  if (proximaData) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    dias = Math.round((proximaData.getTime() - hoje.getTime()) / 86400000);
  }
  const saldoDevedor = restantes * Number(f.valor_parcela || 0);
  return { quitado, proximaData, restantes, dias, saldoDevedor };
}
