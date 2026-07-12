import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CarState {
  lat: number | null; lng: number | null; speed: number | null;
  battery_pct: number | null; odometer: number | null; power_kw: number | null;
  moving: boolean | null; ignition: any; soh: number | null; range_km: number | null;
  updated_at: string | null;
}
export interface CarLink {
  status: "pending" | "connected" | string;
  device_label: string | null;
  last_seen: string | null;
  last_state: CarState | null;
  source: string | null;
  pair_code: string | null;
}
export interface PairInfo { pair_code: string; token: string; ingest_url: string; qr: string; }

async function call(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("car-link", { body: { action, ...extra } });
  if (error) {
    try { const j = await (error as any).context.json(); if (j?.error) throw new Error(j.error); } catch (e) { if (e instanceof Error && e.message) throw e; }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Estado do vínculo — refaz a cada 15s pra pegar quando o carro conecta / manda dados
export const useCarLink = (userId?: string | null) =>
  useQuery({
    queryKey: ["car-link", userId],
    queryFn: async () => (await call("get")) as { linked: boolean; link: CarLink | null },
    enabled: !!userId,
    refetchInterval: 15_000,
    retry: false,
  });

export const useCreatePair = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await call("create")) as PairInfo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["car-link"] }),
  });
};

export const useUnlinkCar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => call("unlink"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["car-link"] }),
  });
};

// Últimos eventos do carro (portas, ignição, viagens…) — leitura direta (RLS por dono)
export const useCarEvents = (accountId?: string | null) =>
  useQuery({
    queryKey: ["car-events", accountId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("car_events")
        .select("ts, type, label")
        .order("ts", { ascending: false })
        .limit(15);
      if (error) throw error;
      return (data || []) as { ts: string; type: string; label: string | null }[];
    },
    enabled: !!accountId,
    refetchInterval: 20_000,
  });
