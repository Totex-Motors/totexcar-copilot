import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustoBucket { label: string; valor: number; pct: number }
export interface Custo {
  total: number;               // gasto real no período
  km_rodados: number;          // pelo odômetro (max - min)
  custo_por_km: number | null; // total / km
  custo_mensal: number;        // total / meses do período
  meses: number;
  desde: string | null;
  buckets: CustoBucket[];       // combustível / manutenção / fixos / financiamento / outros
  lancamentos: number;
}

// classifica a categoria do gasto num "balde" pro dono entender pra onde vai o dinheiro
function bucketOf(cat: string): string {
  const c = (cat || "").toLowerCase();
  if (/combust|gasolin|etanol|diesel|carga|abastec/.test(c)) return "Combustível";
  if (/financ|parcela|boleto/.test(c)) return "Financiamento";
  if (/ipva|seguro|licenc|multa|document|dpvat|estacion|pedágio|pedagio/.test(c)) return "Fixos (imposto/seguro)";
  if (/manuten|peça|peca|pneu|óleo|oleo|revis|mec|funilar|lavagem|acess/.test(c)) return "Manutenção";
  return "Outros";
}

// Custo real por km (CPK) e custo mensal — a partir dos gastos + leituras de hodômetro.
// Mesma filosofia do consumo: usa o que o dono já registra (cupom + hodômetro pelo WhatsApp).
export const useCusto = (userId?: string | null) =>
  useQuery({
    queryKey: ["custo", userId],
    queryFn: async (): Promise<Custo | null> => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("amount, type, odometer, transaction_date, created_at, categories(name)")
        .eq("user_id", userId)
        .eq("type", "expense")
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      const exp = (data || []).filter((t: any) => Math.abs(Number(t.amount)) > 0);
      if (exp.length < 2) return null;

      const total = exp.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

      // km pelo odômetro: soma os incrementos PLAUSÍVEIS entre leituras (descarta saltos/typos,
      // ex.: odômetro digitado errado tipo 600050). Mesma filosofia do consumo tanque-a-tanque.
      const leituras = exp
        .filter((t: any) => Number(t.odometer) > 0)
        .map((t: any) => Number(t.odometer))
        .sort((a: number, b: number) => a - b); // já vem por data asc; ordena por segurança
      let km = 0;
      for (let i = 1; i < leituras.length; i++) {
        const d = leituras[i] - leituras[i - 1];
        if (d > 0 && d <= 15000) km += d; // 15 mil km entre 2 registros é o teto de plausibilidade
      }

      const datas = exp.map((t: any) => t.transaction_date || t.created_at).filter(Boolean).sort();
      const desde = datas[0] || null;
      const ate = datas[datas.length - 1] || null;
      const diasSpan = desde && ate ? Math.max(1, (new Date(ate).getTime() - new Date(desde).getTime()) / 86400000) : 30;
      const meses = Math.max(0.5, diasSpan / 30.44);

      const byBucket: Record<string, number> = {};
      exp.forEach((t: any) => {
        const b = bucketOf(t.categories?.name || "");
        byBucket[b] = (byBucket[b] || 0) + Math.abs(Number(t.amount));
      });
      const buckets: CustoBucket[] = Object.entries(byBucket)
        .map(([label, valor]) => ({ label, valor: Number(valor.toFixed(2)), pct: Math.round((valor / total) * 100) }))
        .sort((a, b) => b.valor - a.valor);

      return {
        total: Number(total.toFixed(2)),
        km_rodados: Math.round(km),
        custo_por_km: km > 0 ? Number((total / km).toFixed(2)) : null,
        custo_mensal: Number((total / meses).toFixed(2)),
        meses: Number(meses.toFixed(1)),
        desde,
        buckets,
        lancamentos: exp.length,
      };
    },
    enabled: !!userId,
  });
