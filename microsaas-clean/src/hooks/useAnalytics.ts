import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export function useCategoryStats(userId?: string, monthsBack: number = 0) {
  return useQuery({
    queryKey: ['category-stats', userId, monthsBack],
    queryFn: async () => {
      if (!userId) return [];

      const targetDate = subMonths(new Date(), monthsBack);
      const startDate = startOfMonth(targetDate);
      const endDate = endOfMonth(targetDate);

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          type,
          categories (
            id,
            name,
            color,
            icon
          )
        `)
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('transaction_date', format(startDate, 'yyyy-MM-dd'))
        .lte('transaction_date', format(endDate, 'yyyy-MM-dd'));

      if (error) {
        console.error('Erro ao buscar estatísticas de categorias:', error);
        return [];
      }

      // Agrupar por categoria
      const categoryTotals = transactions?.reduce((acc: any, transaction: any) => {
        if (!transaction.categories) return acc;
        
        const categoryId = transaction.categories.id;
        if (!acc[categoryId]) {
          acc[categoryId] = {
            category: transaction.categories.name,
            amount: 0,
            color: transaction.categories.color,
            icon: transaction.categories.icon,
          };
        }
        acc[categoryId].amount += Number(transaction.amount);
        return acc;
      }, {});

      // Converter para array e calcular percentuais
      const categoryArray = Object.values(categoryTotals || {}) as any[];
      const totalAmount = categoryArray.reduce((sum, cat) => sum + cat.amount, 0);

      return categoryArray
        .map(cat => ({
          ...cat,
          percentage: totalAmount > 0 ? Math.round((cat.amount / totalAmount) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useWeeklyStats(userId?: string) {
  return useQuery({
    queryKey: ['weekly-stats', userId],
    queryFn: async () => {
      if (!userId) return [];

      const currentDate = new Date();
      const weeklyData = [];

      // Buscar dados das últimas 4 semanas
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - (i * 7 + 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', userId)
          .gte('transaction_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('transaction_date', format(weekEnd, 'yyyy-MM-dd'));

        if (error) {
          console.error('Erro ao buscar dados semanais:', error);
          continue;
        }

        const income = transactions
          ?.filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const expenses = transactions
          ?.filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        weeklyData.push({
          week: `Sem ${4 - i}`,
          income,
          expenses
        });
      }

      return weeklyData;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}