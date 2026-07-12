import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Trecho {
  km_rodados: number;
  litros: number;
  km_por_litro: number;
  custo: number;
  data: string | null;
}
export interface Consumo {
  ultimo: Trecho;
  media_km_por_litro: number;
  custo_combustivel_por_km: number;
  abastecimentos_medidos: number;
}

// Consumo TANQUE-A-TANQUE (mesma lógica do agente): a cada abastecimento com litros + km,
// usa a distância desde o abastecimento anterior. Trechos implausíveis (km/L fora de 3–30)
// são descartados. `litros` não está nos types gerados — acesso via (supabase as any).
export const useConsumo = (userId?: string | null) =>
  useQuery({
    queryKey: ["consumo", userId],
    queryFn: async (): Promise<Consumo | null> => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("amount, odometer, litros, transaction_date, created_at, categories(name)")
        .eq("user_id", userId)
        .eq("type", "expense")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const f = (data || []).filter((t: any) =>
        String(t.categories?.name || "").toLowerCase().includes("combust") &&
        Number(t.odometer) > 0 && Number(t.litros) > 0);
      if (f.length < 2) return null;

      const trechos: Trecho[] = [];
      for (let i = 1; i < f.length; i++) {
        const dist = Number(f[i].odometer) - Number(f[i - 1].odometer);
        const litros = Number(f[i].litros);
        if (!(dist > 0) || !(litros > 0)) continue;
        const kml = dist / litros;
        if (kml < 3 || kml > 30) continue;
        trechos.push({
          km_rodados: Math.round(dist),
          litros: Number(litros.toFixed(1)),
          km_por_litro: Number(kml.toFixed(1)),
          custo: Math.abs(Number(f[i].amount)),
          data: f[i].transaction_date || null,
        });
      }
      if (!trechos.length) return null;

      const somaKm = trechos.reduce((s, t) => s + t.km_rodados, 0);
      const somaL = trechos.reduce((s, t) => s + t.litros, 0);
      const somaCusto = trechos.reduce((s, t) => s + t.custo, 0);
      return {
        ultimo: trechos[trechos.length - 1],
        media_km_por_litro: Number((somaKm / somaL).toFixed(1)),
        custo_combustivel_por_km: Number((somaCusto / somaKm).toFixed(2)),
        abastecimentos_medidos: trechos.length,
      };
    },
    enabled: !!userId,
  });
