import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LucroSemana {
  de: string;
  ate: string;
  receita: number;
  despesa: number;
  lucro: number;
  km_rodados: number | null;
  lucro_por_km: number | null;
}

const iso = (d: Date) => d.toISOString().split("T")[0];

// Semana atual (segunda → hoje)
function thisWeek(): { de: string; ate: string } {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return { de: iso(mon), ate: iso(now) };
}

// Lucro do motorista PRO na semana corrente (receitas − despesas + km pelas leituras de hodômetro)
export const useLucroSemana = (userId?: string | null, enabled = true) =>
  useQuery({
    queryKey: ["lucro-semana", userId],
    queryFn: async (): Promise<LucroSemana> => {
      const { de, ate } = thisWeek();
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, odometer")
        .eq("user_id", userId!)
        .gte("transaction_date", de)
        .lte("transaction_date", ate);
      if (error) throw error;
      let receita = 0, despesa = 0;
      const odos: number[] = [];
      (data || []).forEach((t: any) => {
        if (t.type === "income") receita += Math.abs(Number(t.amount));
        else despesa += Math.abs(Number(t.amount));
        if (Number(t.odometer) > 0) odos.push(Number(t.odometer));
      });
      const lucro = Number((receita - despesa).toFixed(2));
      const km = odos.length >= 2 ? Math.round(Math.max(...odos) - Math.min(...odos)) : null;
      return {
        de, ate,
        receita: Number(receita.toFixed(2)),
        despesa: Number(despesa.toFixed(2)),
        lucro,
        km_rodados: km,
        lucro_por_km: km && km > 0 ? Number((lucro / km).toFixed(2)) : null,
      };
    },
    enabled: !!userId && enabled,
  });

// Liga/desliga o Modo PRO no próprio perfil
export const useSetDriverMode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { userId: string; on: boolean }) => {
      const { error } = await (supabase as any).from("users").update({ driver_mode: p.on }).eq("id", p.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-user"] });
      qc.invalidateQueries({ queryKey: ["lucro-semana"] });
    },
  });
};
