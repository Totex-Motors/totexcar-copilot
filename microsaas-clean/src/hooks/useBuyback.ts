import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FipeItem { codigo: string | number; nome: string; }
export interface FipePrice {
  fipe: { value: number; code: string | null; brand: string; model: string; year: string | number; fuel: string };
  offer_pct: number;
  offer_value: number;
}
export interface BuybackRequest {
  id: string;
  owner_name: string | null;
  owner_phone: string | null;
  dealership: string | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  fuel: string | null;
  fipe_value: number | null;
  offer_pct: number | null;
  offer_value: number | null;
  status: "new" | "contacted" | "closed" | "declined" | string;
  created_at: string;
}

async function callBuyback(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("buyback", { body: { action, ...payload } });
  if (error) {
    try { const j = await (error as any).context.json(); if (j?.error) throw new Error(j.error); } catch (e) { if (e instanceof Error && e.message) throw e; }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const useFipeBrands = (enabled: boolean) =>
  useQuery({
    queryKey: ["fipe-brands"],
    queryFn: async () => (await callBuyback("fipe_brands")).brands as FipeItem[],
    enabled,
    staleTime: 1000 * 60 * 60,
  });

export const useFipeModels = (brand: string | null) =>
  useQuery({
    queryKey: ["fipe-models", brand],
    queryFn: async () => (await callBuyback("fipe_models", { brand })).models as FipeItem[],
    enabled: !!brand,
    staleTime: 1000 * 60 * 60,
  });

export const useFipeYears = (brand: string | null, model: string | null) =>
  useQuery({
    queryKey: ["fipe-years", brand, model],
    queryFn: async () => (await callBuyback("fipe_years", { brand, model })).years as FipeItem[],
    enabled: !!brand && !!model,
    staleTime: 1000 * 60 * 60,
  });

export const useFipePrice = (brand: string | null, model: string | null, year: string | null) =>
  useQuery({
    queryKey: ["fipe-price", brand, model, year],
    queryFn: async () => (await callBuyback("fipe_price", { brand, model, year })) as FipePrice,
    enabled: !!brand && !!model && !!year,
  });

export const useMyBuyback = (enabled: boolean) =>
  useQuery({
    queryKey: ["my-buyback"],
    queryFn: async () => ((await callBuyback("my_requests")).requests || []) as BuybackRequest[],
    enabled,
  });

export const useCreateBuyback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { brand: string; model: string; year: string; fuel?: string; fipe_code?: string | null; fipe_value: number; offer_pct: number }) =>
      callBuyback("request", p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-buyback"] }),
  });
};

// ===== Lojista ===== (dealership só tem efeito p/ admin — preview de uma loja)
export const useBuybackRequests = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["buyback-requests", dealership || null],
    queryFn: async () => ((await callBuyback("list_requests", dealership ? { dealership } : {})).requests || []) as BuybackRequest[],
    enabled,
  });

export const useUpdateBuyback = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; status: string }) => callBuyback("update_request", p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["buyback-requests"] }),
  });
};
