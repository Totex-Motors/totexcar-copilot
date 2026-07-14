import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Account = Tables<'accounts'>;
export type AccountInsert = TablesInsert<'accounts'>;
export type AccountUpdate = TablesUpdate<'accounts'>;

export const useAccounts = (userId?: string) => {
  return useQuery({
    queryKey: ['accounts', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });
};

export const useCreateAccount = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (accountData: AccountInsert) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert(accountData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      // gera a ficha técnica do carro (IA + web) em background p/ o concierge
      supabase.functions.invoke('car-spec', { body: {} }).catch(() => {});
    },
  });
};

// campos que, ao mudar, invalidam a ficha técnica (identidade do carro)
const FICHA_KEYS = ['marca', 'modelo', 'ano_modelo', 'ano_fabricacao', 'combustivel'];

export const useUpdateAccount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: AccountUpdate }) => {
      // se a identidade do carro mudou, zera a ficha p/ o car-spec regenerar
      const identityChanged = FICHA_KEYS.some((k) => k in (updates as any));
      const payload: any = identityChanged ? { ...updates, ficha_tecnica: null, ficha_at: null, ficha_fonte: null } : updates;
      const { data, error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      supabase.functions.invoke('car-spec', { body: {} }).catch(() => {});
    },
  });
};

// Hook para calcular o saldo total de todas as contas
export const useTotalBalance = (userId?: string) => {
  const { data: accounts } = useAccounts(userId);

  return {
    totalBalance: accounts?.reduce((sum, account) => sum + (account.current_balance || 0), 0) || 0,
    accountsCount: accounts?.length || 0,
  };
};

// Veículo principal do proprietário (sistema de 1 carro por usuário)
export const useVehicle = (userId?: string) => {
  const query = useAccounts(userId);
  return {
    ...query,
    vehicle: (query.data && query.data.length > 0 ? query.data[0] : null) as Account | null,
  };
};