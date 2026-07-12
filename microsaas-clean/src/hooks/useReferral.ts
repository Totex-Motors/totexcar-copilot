import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Carro vindo do marketplace (totexmotors.com) — ao vivo, filtrado pela loja do dono
export interface MarketplaceCar {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  year: number | null;
  price: number | null;
  km: number | null;
  color: string | null;
  fuel: string | null;
  photo_url: string | null;
  url: string;
}

export interface MarketplaceFeed {
  dealership: { name: string; slug: string | null; phone: string | null; url: string } | null;
  referral_code: string | null;
  buyer_offer?: string | null;
  cars: MarketplaceCar[];
  reason?: string;
}

export interface ReferralEvent {
  id: string;
  dealership: string | null;
  car_title: string | null;
  type: "click" | "lead" | "sale" | string;
  value: number;
  status: "pending" | "paid" | "logged" | string;
  created_at: string;
  paid_at: string | null;
}

// Feed ao vivo do marketplace (via edge function, escopado pela loja do dono).
// Sempre fresco: re-busca ao montar a página e ao voltar o foco — evita "cache preso".
export const useMarketplaceFeed = (enabled: boolean) =>
  useQuery({
    queryKey: ["marketplace-feed"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("marketplace", { body: { action: "feed" } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as MarketplaceFeed;
    },
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

export const useReferralEvents = (ownerId?: string) =>
  useQuery({
    queryKey: ["referral-events", ownerId],
    queryFn: async () => {
      // RLS já restringe aos eventos do próprio dono
      const { data, error } = await supabase
        .from("referral_events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ReferralEvent[];
    },
    enabled: !!ownerId,
  });

export const useUpdatePixKey = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, pixKey }: { userId: string; pixKey: string }) => {
      const { error } = await supabase.from("users").update({ pix_key: pixKey }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-profile"] }),
  });
};

// Link rastreável da página do carro no marketplace, com o código do dono
export function carReferralLink(carUrl: string, code: string | null | undefined): string {
  if (!code) return carUrl;
  const sep = carUrl.includes("?") ? "&" : "?";
  return `${carUrl}${sep}ref=${encodeURIComponent(code)}`;
}

// Link rastreável da loja inteira (página da loja no marketplace)
export function storeReferralLink(storeUrl: string | null | undefined, code: string | null | undefined): string | null {
  if (!storeUrl) return null;
  if (!code) return storeUrl;
  const sep = storeUrl.includes("?") ? "&" : "?";
  return `${storeUrl}${sep}ref=${encodeURIComponent(code)}`;
}
