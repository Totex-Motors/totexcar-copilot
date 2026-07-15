import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DealerInfo {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  dealership: string | null;
}

export interface ClientNextDue {
  tipo: string;
  date: string;
  days: number | null;
}

export interface DealerClient {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
  subscription_status: string | null;
  coupon_code: string | null;
  dealership: string | null;
  created_at: string | null;
  vehicle: { apelido: string | null; marca: string | null; modelo: string | null; placa: string | null; hodometro: number | null } | null;
  next_due: ClientNextDue | null;
  total_expenses: number;
  expense_count: number;
  last_expense_date: string | null;
}

export interface ClientJourney {
  owner: {
    id: string; name: string | null; email: string | null; phone: string | null;
    plan: string | null; subscription_status: string | null; dealership: string | null;
    coupon_code: string | null; created_at: string | null;
  } | null;
  vehicle: any | null;
  vencimentos: ClientNextDue[];
  expenses: { total: number; count: number; by_category: Record<string, number> };
  recent_expenses: { description: string | null; amount: number; type: string; date: string; odometer: number | null; category: string | null }[];
}

async function callDealer(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("dealer-api", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const useDealerMe = (enabled: boolean) =>
  useQuery({
    queryKey: ["dealer-me"],
    queryFn: async () => {
      const data = await callDealer("me");
      return data.dealer as DealerInfo;
    },
    enabled,
  });

// dealership só tem efeito para admin (preview de uma loja); o lojista é sempre preso à própria
export const useDealerClients = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["dealer-clients", dealership || null],
    queryFn: async () => {
      const data = await callDealer("list_clients", dealership ? { dealership } : {});
      return (data.clients || []) as DealerClient[];
    },
    enabled,
  });

export const useClientJourney = (userId: string | null) =>
  useQuery({
    queryKey: ["client-journey", userId],
    queryFn: async () => {
      const data = await callDealer("client_journey", { user_id: userId });
      return data as ClientJourney;
    },
    enabled: !!userId,
  });

// ===== Sucesso do Cliente / Pós-venda =====
export interface PostsaleJourney {
  id: string; dealership: string; customer_name: string | null; customer_phone: string;
  car_desc: string | null; purchase_date: string; coupon_code: string | null;
  status: string; welcome_sent: boolean; nps_asked_at: string | null; nps_score: number | null;
  nps_at: string | null; review_link_sent: boolean; anniversary_sent: boolean; created_at: string;
  transfer?: Record<string, boolean> | null;
  transfer_status?: string;
  warranty_until?: string | null;
  revisao_proxima?: string | null;
  sponsored?: boolean;
  sponsored_value?: number;
  sponsor_settled?: boolean;
  user_id?: string | null;
}
export interface PostsaleStats { total: number; respondidos: number; promotores: number; passivos: number; detratores: number; nps: number | null; cortesias_ativas?: number; cortesias_valor?: number; }
export interface SponsorBalance { lojas: { dealership: string; count: number; total: number }[]; total: number; }
export interface PostsaleConfig { dealership: string; google_review_url: string | null; nps_delay_days: number; }

export const usePostsaleList = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["postsale-list", dealership || null],
    queryFn: async () => ((await callDealer("postsale_list", dealership ? { dealership } : {})).journeys || []) as PostsaleJourney[],
    enabled,
  });

export const usePostsaleStats = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["postsale-stats", dealership || null],
    queryFn: async () => (await callDealer("postsale_stats", dealership ? { dealership } : {})) as PostsaleStats,
    enabled,
  });

export const usePostsaleConfig = (enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["postsale-config", dealership || null],
    queryFn: async () => (await callDealer("postsale_config", dealership ? { dealership } : {})) as { config: PostsaleConfig; coupon: string | null },
    enabled,
  });

export const usePostsaleCreate = () =>
  useMutation({
    mutationFn: async (p: { customer_name?: string; customer_phone: string; car_desc?: string; purchase_date?: string; cortesia?: boolean }) =>
      callDealer("postsale_create", p),
  });

// Admin: saldo devedor de cortesias por loja + quitar
export const useSponsorBalance = (enabled: boolean) =>
  useQuery({
    queryKey: ["postsale-sponsor-balance"],
    queryFn: async () => (await callDealer("postsale_sponsor_balance")) as SponsorBalance,
    enabled,
  });

export const useSponsorSettle = () =>
  useMutation({
    mutationFn: async (dealership: string) => callDealer("postsale_sponsor_settle", { dealership }),
  });

export const usePostsaleConfigSave = () =>
  useMutation({
    mutationFn: async (p: { google_review_url?: string; nps_delay_days?: number }) => callDealer("postsale_config_save", p),
  });

export const usePostsaleTransferSave = () =>
  useMutation({
    mutationFn: async (p: { id: string; transfer?: Record<string, boolean>; transfer_status?: string; warranty_until?: string | null; revisao_proxima?: string | null }) =>
      callDealer("postsale_transfer_save", p),
  });

// ===== Campanhas (WhatsApp) =====
export type CampaignAudience = "all" | "due_soon" | "single";

export interface CampaignRecipient {
  id: string;
  name: string | null;
  phone: string | null;
  vehicle: { marca: string | null; modelo: string | null; placa: string | null } | null;
  next_due: ClientNextDue | null;
}

export const useCampaignRecipients = (audience: CampaignAudience, clientId: string | null, enabled: boolean, dealership?: string) =>
  useQuery({
    queryKey: ["campaign-recipients", audience, clientId, dealership || null],
    queryFn: async () => {
      const data = await callDealer("campaign_recipients", { audience, client_id: clientId || undefined, dealership: dealership || undefined });
      return { count: data.count as number, recipients: (data.recipients || []) as CampaignRecipient[] };
    },
    enabled,
  });

export const useDraftMessage = () =>
  useMutation({
    mutationFn: async (brief: string) => {
      const data = await callDealer("draft_message", { brief });
      return data.message as string;
    },
  });

export const useSendCampaign = () =>
  useMutation({
    mutationFn: async (p: { audience: CampaignAudience; message: string; clientId?: string; dealership?: string }) => {
      const data = await callDealer("send_campaign", { audience: p.audience, message: p.message, client_id: p.clientId, dealership: p.dealership });
      return data as { total: number; sent: number; failed: number; results: { name: string; phone: string; ok: boolean }[] };
    },
  });
