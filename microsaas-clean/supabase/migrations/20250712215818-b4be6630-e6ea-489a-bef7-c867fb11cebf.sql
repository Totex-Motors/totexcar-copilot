-- Remover políticas antigas problemáticas
DROP POLICY IF EXISTS "Users can only see their own data" ON public.users;
DROP POLICY IF EXISTS "Users can only see their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can only see their own transactions" ON public.transactions;

-- Criar políticas RLS mais simples usando auth.uid()
CREATE POLICY "Users can manage their own data" ON public.users
FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage their own accounts" ON public.accounts
FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transactions" ON public.transactions
FOR ALL USING (auth.uid() = user_id);