-- Adicionar campos de controle de trial na tabela users
ALTER TABLE public.users 
ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN subscription_status TEXT DEFAULT 'trial';

-- Atualizar usuários existentes com trial de 7 dias
UPDATE public.users 
SET 
  trial_started_at = created_at,
  trial_ends_at = created_at + INTERVAL '7 days',
  subscription_status = 'trial'
WHERE trial_started_at IS NULL;

-- Função para verificar se o trial está ativo
CREATE OR REPLACE FUNCTION public.is_trial_active(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN u.plan = 'premium' THEN true
      WHEN u.trial_ends_at IS NULL THEN false
      WHEN u.trial_ends_at > NOW() THEN true
      ELSE false
    END
  FROM public.users u
  WHERE u.id = user_id;
$$;

-- Função para calcular dias restantes do trial
CREATE OR REPLACE FUNCTION public.trial_days_remaining(user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN u.plan = 'premium' THEN -1
      WHEN u.trial_ends_at IS NULL THEN 0
      WHEN u.trial_ends_at <= NOW() THEN 0
      ELSE EXTRACT(DAYS FROM (u.trial_ends_at - NOW()))::INTEGER
    END
  FROM public.users u
  WHERE u.id = user_id;
$$;