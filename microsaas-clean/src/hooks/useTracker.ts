import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LivePosition {
  ok?: boolean;
  device: { id: number; name: string | null; imei: string | null; online: string | null; last_update: string | null };
  position: {
    lat: number | null; lng: number | null; speed: number | null;
    ignition: number | string | null; address: string | null; odometer: number | null;
  };
  hodometro_atualizado: number | null;
}
export interface TrackPoint { lat: number; lng: number; speed: number | null; time: string | null; odometer: number | null; }
export interface LinkStatus { linked: boolean; device: { id: number; name: string | null; imei: string | null } | null; }

async function callTracker(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("smartgps", { body: { action, ...payload } });
  if (error) {
    try { const j = await (error as any).context.json(); if (j?.error) throw new Error(j.error); } catch (e) { if (e instanceof Error && e.message) throw e; }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// posição ao vivo (auto-refresh a cada 30s)
export const useLivePosition = (enabled: boolean) =>
  useQuery({
    queryKey: ["tracker-live"],
    queryFn: async () => (await callTracker("live")) as LivePosition,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    retry: false,
  });

export const useLinkStatus = (enabled: boolean) =>
  useQuery({
    queryKey: ["tracker-link"],
    queryFn: async () => (await callTracker("link_status")) as LinkStatus,
    enabled,
    retry: false,
  });

export const useTrackHistory = () =>
  useMutation({
    mutationFn: async (p: { from: string; to: string }) =>
      (await callTracker("history", p)) as { count: number; positions: TrackPoint[] },
  });

// ----- Admin (vincular device ↔ carro) -----
export interface SmartgpsDevice { id: number; name: string | null; imei: string | null; online: string | null; lat: number | null; lng: number | null; }
export const useSmartgpsDevices = (enabled: boolean) =>
  useQuery({
    queryKey: ["smartgps-devices"],
    queryFn: async () => ((await callTracker("list_devices")).devices || []) as SmartgpsDevice[],
    enabled,
    retry: false,
  });
export const useAssignDevice = () =>
  useMutation({
    mutationFn: async (p: { account_id: string; device_id: number | null; imei: string | null }) => callTracker("assign", p),
  });
