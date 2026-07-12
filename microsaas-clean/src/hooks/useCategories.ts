import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Category = Tables<'categories'>;

export const useCategories = (type?: 'income' | 'expense') => {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      let query = supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (type) {
        query = query.eq('type', type);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
  });
};

export const useCategory = (id: number) => {
  return useQuery({
    queryKey: ['category', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (categoryData: Omit<Category, 'id' | 'is_system'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...categoryData,
          is_system: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Category> }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .eq('is_system', false) // Only allow updating user-created categories
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('is_system', false); // Only allow deleting user-created categories
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useCategoryStats = (userId?: string) => {
  return useQuery({
    queryKey: ['category-stats', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      // Buscar transações do mês atual com categorias
      const currentMonth = new Date();
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          amount,
          type,
          categories (
            id,
            name,
            color,
            type
          )
        `)
        .eq('user_id', userId)
        .gte('transaction_date', firstDay.toISOString().split('T')[0])
        .lte('transaction_date', lastDay.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      // Agrupar por categoria
      const categoryStats = data?.reduce((acc: any, transaction: any) => {
        if (!transaction.categories) return acc;
        
        const categoryId = transaction.categories.id;
        const amount = Math.abs(transaction.amount);
        
        if (!acc[categoryId]) {
          acc[categoryId] = {
            id: categoryId,
            name: transaction.categories.name,
            color: transaction.categories.color,
            type: transaction.categories.type,
            totalAmount: 0,
            transactionCount: 0,
            percentage: 0,
          };
        }
        
        acc[categoryId].totalAmount += amount;
        acc[categoryId].transactionCount += 1;
        
        return acc;
      }, {});
      
      const statsArray = Object.values(categoryStats || {}) as Array<{
        id: number;
        name: string;
        color: string;
        type: string;
        totalAmount: number;
        transactionCount: number;
        percentage: number;
      }>;
      
      const totalAmount = statsArray.reduce((sum: number, cat) => sum + cat.totalAmount, 0);
      
      // Calcular percentuais
      return statsArray.map((cat) => ({
        ...cat,
        percentage: totalAmount > 0 ? Math.round((cat.totalAmount / totalAmount) * 100) : 0,
      })).sort((a, b) => b.totalAmount - a.totalAmount);
    },
    enabled: !!userId,
  });
};