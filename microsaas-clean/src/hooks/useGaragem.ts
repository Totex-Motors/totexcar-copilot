import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GaragemCar {
  id: string;
  title: string;
  brand: string; model: string; version: string | null;
  year: number; km: number; price: number; fipe_price: number | null;
  color: string | null; fuel: string | null; transmission: string | null;
  city: string | null; state: string | null; dealership: string | null;
  photo: string | null; url: string;
}
export interface GaragemFilters {
  search?: string; brand?: string; model?: string;
  min_year?: number; max_year?: number;
  min_price?: number; max_price?: number; max_km?: number;
  fuel?: string; transmission?: string;
  page?: number; limit?: number; sort?: string;
}
export interface Radar {
  id: string;
  brand: string | null; model: string | null; color: string | null;
  max_price: number | null; min_year: number | null; max_km: number | null;
  notes: string | null; lead_sent: boolean; created_at: string;
  matches: GaragemCar[];
}

async function call(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("garagem", { body: { action, ...extra } });
  if (error) {
    try { const j = await (error as any).context.json(); if (j?.error) throw new Error(j.error); } catch (e) { if (e instanceof Error && e.message) throw e; }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const useGaragemSearch = (filters: GaragemFilters, enabled: boolean) =>
  useQuery({
    queryKey: ["garagem-search", filters],
    queryFn: async () => (await call("search", { filters })) as { total: number; total_pages: number; cars: GaragemCar[] },
    enabled,
    staleTime: 60_000,
  });

export const useGaragemBrands = (enabled: boolean) =>
  useQuery({
    queryKey: ["garagem-brands"],
    queryFn: async () => ((await call("brands")).brands || []) as string[],
    enabled,
    staleTime: 1000 * 60 * 30,
  });

export const useOportunidades = (enabled: boolean) =>
  useQuery({
    queryKey: ["garagem-oportunidades"],
    queryFn: async () => (await call("opportunities")) as { base: any; cars: GaragemCar[] },
    enabled,
    staleTime: 1000 * 60 * 5,
  });

export const useInteresse = () =>
  useMutation({
    mutationFn: async (p: { vehicle_id: string; mensagem?: string }) => call("interest", p),
  });

export const useVenderAvaliar = () =>
  useMutation({
    mutationFn: async (p: { modo: "vender" | "avaliar"; marca?: string; modelo?: string; ano?: number; km?: number; local?: string; data?: string; horario?: string }) =>
      call("sell", p),
  });

export const useRadars = (enabled: boolean) =>
  useQuery({
    queryKey: ["garagem-radars"],
    queryFn: async () => ((await call("radar_list")).radars || []) as Radar[],
    enabled,
  });

export const useSalvarRadar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { brand?: string; model?: string; color?: string; max_price?: number; min_year?: number; max_km?: number; notes?: string }) =>
      (await call("radar_save", p)) as { id: string; lead_enviado: boolean; matches: GaragemCar[] },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garagem-radars"] }),
  });
};

export const useExcluirRadar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => call("radar_delete", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["garagem-radars"] }),
  });
};
