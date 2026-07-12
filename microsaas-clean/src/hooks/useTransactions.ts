import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Transaction = Tables<'transactions'>;

export const useTransactions = (userId?: string, limit?: number) => {
  console.log('🔍 useTransactions - userId:', userId, 'limit:', limit);
  
  return useQuery({
    queryKey: ['transactions', userId, limit],
    queryFn: async () => {
      console.log('🔍 Fetching transactions for userId:', userId);
      
      if (!userId) {
        console.log('❌ No userId, returning empty array');
        return [];
      }
      
      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories (
            id,
            name,
            color,
            icon,
            type
          ),
          accounts (
            id,
            name,
            type
          )
        `)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      console.log('🔍 Supabase response:', { data, error, count: data?.length });
      
      if (error) {
        console.error('❌ Error fetching transactions:', error);
        throw error;
      }
      
      console.log('✅ Transactions fetched:', data?.length || 0, 'items');
      return data || [];
    },
    enabled: !!userId,
  });
};

export const useRecentTransactions = (userId?: string) => {
  return useTransactions(userId, 5);
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (transactionData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['category-stats'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      const { data, error } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['category-stats'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
    },
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['category-stats'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-stats'] });
    },
  });
};

// Total acumulado de gastos (todas as despesas) e receitas do veículo
export const useTotalSpent = (userId?: string) => {
  return useQuery({
    queryKey: ['total-spent', userId],
    queryFn: async () => {
      if (!userId) return { totalExpenses: 0, totalIncome: 0, net: 0 };

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId);

      if (error) throw error;

      const totalExpenses = data?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const totalIncome = data?.filter(t => t.type === 'income').reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      return { totalExpenses, totalIncome, net: totalIncome - totalExpenses };
    },
    enabled: !!userId,
  });
};

// Gasto com combustível no mês atual
export const useFuelThisMonth = (userId?: string) => {
  return useQuery({
    queryKey: ['fuel-this-month', userId],
    queryFn: async () => {
      if (!userId) return 0;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, categories(name)')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('transaction_date', firstDay.toISOString().split('T')[0])
        .lte('transaction_date', lastDay.toISOString().split('T')[0]);

      if (error) throw error;

      return (
        data
          ?.filter((t: any) => t.categories?.name === 'Combustível')
          .reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) || 0
      );
    },
    enabled: !!userId,
  });
};

export const useMonthlyStats = (userId?: string) => {
  return useQuery({
    queryKey: ['monthly-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const currentMonth = new Date();
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      // Buscar transações do mês atual
      const { data: currentMonthData, error: currentError } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('transaction_date', firstDay.toISOString().split('T')[0])
        .lte('transaction_date', lastDay.toISOString().split('T')[0]);
      
      if (currentError) throw currentError;
      
      // Buscar transações do mês anterior para comparação
      const previousMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const previousMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);
      
      const { data: previousMonthData, error: previousError } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('transaction_date', previousMonth.toISOString().split('T')[0])
        .lte('transaction_date', previousMonthEnd.toISOString().split('T')[0]);
      
      if (previousError) throw previousError;
      
      // Calcular totais do mês atual
      const currentIncome = currentMonthData?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
      const currentExpenses = currentMonthData?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const currentBalance = currentIncome - currentExpenses;
      const currentTransactionCount = currentMonthData?.length || 0;
      
      // Calcular totais do mês anterior
      const previousIncome = previousMonthData?.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) || 0;
      const previousExpenses = previousMonthData?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const previousBalance = previousIncome - previousExpenses;
      const previousTransactionCount = previousMonthData?.length || 0;
      
      // Calcular mudanças percentuais
      const incomeChange = previousIncome > 0 ? ((currentIncome - previousIncome) / previousIncome) * 100 : 0;
      const expenseChange = previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : 0;
      const balanceChange = previousBalance > 0 ? ((currentBalance - previousBalance) / previousBalance) * 100 : 0;
      const transactionChange = previousTransactionCount > 0 ? ((currentTransactionCount - previousTransactionCount) / previousTransactionCount) * 100 : 0;
      
      return {
        income: currentIncome,
        expenses: currentExpenses,
        balance: currentBalance,
        transactionCount: currentTransactionCount,
        changes: {
          income: incomeChange,
          expenses: expenseChange,
          balance: balanceChange,
          transactions: transactionChange,
        }
      };
    },
    enabled: !!userId,
  });
};