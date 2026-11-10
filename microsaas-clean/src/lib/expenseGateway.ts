import { supabase } from '@/integrations/supabase/client';
import type { ExpenseDraft, ExpenseGateway } from './voiceExpense';

async function requireOwner(d: ExpenseDraft) {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || auth.user?.id !== d.userId) throw new Error('Sua sessão mudou. Entre novamente antes de salvar.');
  const account = await supabase.from('accounts').select('id').eq('id', d.accountId).eq('user_id', d.userId).eq('is_active', true).maybeSingle();
  if (account.error || !account.data) throw new Error('O carro não está disponível na sua conta.');
}
export const expenseGateway: ExpenseGateway = {
  async find(id, user) {
    const { data, error } = await supabase.from('transactions').select('id').eq('id', id).eq('user_id', user).maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async insert(d) {
    await requireOwner(d);
    const category = await supabase.from('categories').select('id').eq('id', d.categoryId).eq('type', 'expense').maybeSingle();
    if (category.error || !category.data) throw new Error('Selecione uma categoria de gasto válida.');
    const { error } = await supabase.from('transactions').insert({
      id: d.id, user_id: d.userId, account_id: d.accountId, category_id: d.categoryId,
      description: d.description.trim(), amount: -d.amount, type: 'expense', transaction_date: d.date, odometer: d.odometer,
    }).select('id').single();
    if (error) throw error;
  },
  async advanceOdometer(d) {
    await requireOwner(d);
    // Conditional update prevents a concurrent/historical entry from moving the dashboard backwards.
    const { error } = await supabase.from('accounts').update({ hodometro: d.odometer })
      .eq('id', d.accountId).eq('user_id', d.userId)
      .or(`hodometro.is.null,hodometro.lt.${d.odometer}`);
    if (error) throw error;
  },
};
