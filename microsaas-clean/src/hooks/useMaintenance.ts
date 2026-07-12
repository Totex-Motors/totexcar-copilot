import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MaintenanceReminder {
  id: string;
  account_id: string | null;
  title: string;
  interval_km: number;
  last_km: number;
  last_date: string | null;
  active: boolean;
  created_at: string;
}

// tabela nova ainda não está no types gerado — acesso destipado, contido aqui
const sb = () => supabase as any;
const today = () => new Date().toISOString().slice(0, 10);

export const useMaintenance = (userId?: string) =>
  useQuery({
    queryKey: ["maintenance", userId],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("maintenance_reminders").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as MaintenanceReminder[];
    },
    enabled: !!userId,
  });

export const useCreateMaintenance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { user_id: string; account_id: string | null; title: string; interval_km: number; last_km: number }) => {
      const { error } = await sb().from("maintenance_reminders").insert({ ...p, last_date: today() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
};

export const useMarkMaintenanceDone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; last_km: number }) => {
      const { error } = await sb().from("maintenance_reminders")
        .update({ last_km: p.last_km, last_date: today(), updated_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
};

export const useDeleteMaintenance = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb().from("maintenance_reminders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });
};

// status de um lembrete em relação ao hodômetro atual
export function maintenanceStatus(r: MaintenanceReminder, currentKm: number) {
  const next = Number(r.last_km) + Number(r.interval_km);
  const remaining = next - currentKm;
  const soonThreshold = Math.max(1000, Math.round(Number(r.interval_km) * 0.1));
  const level = remaining <= 0 ? "overdue" : remaining <= soonThreshold ? "soon" : "ok";
  return { next, remaining, level };
}
