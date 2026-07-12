import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AIProvider = 'anthropic' | 'openai' | 'gemini';

export interface Owner {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  created_at: string | null;
}

export const AI_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-opus-4-8', label: 'Claude Opus 4.8 (mais capaz)' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (equilíbrio)' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido/barato)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (visão)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini (barato)' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (rápido)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
};

async function callAdmin(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('admin-api', {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface StoreOption {
  name: string;
  slug: string | null;
  city: string | null;
  vehicles: number | null;
}

// lojas vindas do marketplace (fonte oficial) — para o seletor de loja
export const useStores = (enabled: boolean) =>
  useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('marketplace', { body: { action: 'dealerships' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.dealerships || []) as StoreOption[];
    },
    enabled,
    staleTime: 1000 * 60 * 10,
  });

export const useBootstrapAdmin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => callAdmin('bootstrap_admin'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      qc.invalidateQueries({ queryKey: ['owners'] });
    },
  });
};

export const useOwners = (enabled: boolean) =>
  useQuery({
    queryKey: ['owners'],
    queryFn: async () => {
      const data = await callAdmin('list_owners');
      return (data?.owners || []) as Owner[];
    },
    enabled,
  });

export const useCreateOwner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { email: string; password: string; name: string; phone: string; role?: string }) =>
      callAdmin('create_owner', p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owners'] }),
  });
};

export const useDeleteOwner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => callAdmin('delete_owner', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owners'] }),
  });
};

export interface Dealer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  dealership: string | null;
  created_at: string | null;
}

export const useDealers = (enabled: boolean) =>
  useQuery({
    queryKey: ['dealers'],
    queryFn: async () => {
      const data = await callAdmin('list_dealers');
      return (data?.dealers || []) as Dealer[];
    },
    enabled,
  });

export const useCreateDealer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { email: string; password: string; name: string; phone: string; dealership: string }) =>
      callAdmin('create_owner', { ...p, role: 'dealer' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealers'] }),
  });
};

export const useDeleteDealer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => callAdmin('delete_owner', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dealers'] }),
  });
};

export interface AppSettings {
  ai_provider: AIProvider;
  ai_model: string;
  anthropic_api_key: string | null;
  openai_api_key: string | null;
  gemini_api_key: string | null;
  uazapi_url: string | null;
  uazapi_token: string | null;
  uazapi_number: string | null;
  payment_provider: string | null;
  asaas_api_key: string | null;
  asaas_sandbox: boolean | null;
  asaas_webhook_token: string | null;
  plan_monthly_price: number | null;
  plan_annual_price: number | null;
  app_url: string | null;
  plan_name: string | null;
  member_monthly_price: number | null;
  member_annual_price: number | null;
  ecosystem_discount_pct: number | null;
  integration_api_key: string | null;
  os_webhook_url: string | null;
  buyback_fipe_pct: number | null;
  placa_api_url: string | null;
  placa_api_bearer: string | null;
  placa_api_device: string | null;
  referral_buyer_offer: string | null;
  smartgps_enabled: boolean | null;
  smartgps_base_url: string | null;
  smartgps_email: string | null;
  smartgps_password: string | null;
  support_owner_phone: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  label: string | null;
  dealership: string | null;
  discount_pct: number | null;
  active: boolean | null;
  max_uses: number | null;
  used_count: number | null;
  created_at: string | null;
}

export const useCoupons = (enabled: boolean) =>
  useQuery({
    queryKey: ['coupons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Coupon[];
    },
    enabled,
  });

export const useCreateCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { code: string; label?: string; dealership?: string; discount_pct?: number; max_uses?: number | null }) => {
      const { error } = await supabase.from('coupons').insert({
        code: c.code.trim().toUpperCase(),
        label: c.label || null,
        dealership: c.dealership || null,
        discount_pct: c.discount_pct ?? 90,
        max_uses: c.max_uses ?? null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
};

export const useToggleCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('coupons').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
};

export const useDeleteCoupon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coupons'] }),
  });
};

export interface Subscription {
  id: string;
  name: string | null;
  email: string | null;
  plan: string | null;
  subscription_status: string | null;
  dealership: string | null;
  coupon_code: string | null;
  plan_cycle: string | null;
  plan_value: number | null;
  created_at: string | null;
}

export const useSubscriptions = (enabled: boolean) =>
  useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id,name,email,plan,subscription_status,dealership,coupon_code,plan_cycle,plan_value,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Subscription[];
    },
    enabled,
  });

export const useAppSettings = (enabled: boolean) =>
  useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      if (error) throw error;
      return data as unknown as AppSettings;
    },
    enabled,
  });

export const useUpdateAppSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<AppSettings>) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings'] }),
  });
};
