import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export function useMonthlyTrend(userId?: string) {
  return useQuery({
    queryKey: ['monthly-trend', userId],
    queryFn: async () => {
      if (!userId) return [];

      const monthlyData: MonthlyData[] = [];
      const currentDate = new Date();

      // Buscar dados dos últimos 6 meses
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(currentDate, i);
        const startDate = startOfMonth(monthDate);
        const endDate = endOfMonth(monthDate);

        // Buscar transações do mês
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', userId)
          .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
          .lte('transaction_date', format(endDate, 'yyyy-MM-dd'));

        if (error) {
          console.error('Erro ao buscar transações:', error);
          continue;
        }

        // Calcular totais do mês
        const income = transactions
          ?.filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const expenses = transactions
          ?.filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const balance = income - expenses;

        monthlyData.push({
          month: format(monthDate, 'MMM'),
          income,
          expenses,
          balance
        });
      }

      return monthlyData;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}