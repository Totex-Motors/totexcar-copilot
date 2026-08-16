-- PACOTE STAND + INDICAÇÃO DO CO-PILOT (aplicada em produção em 2026-08-16 via MCP)
-- 1) users.referred_by: código de indicação (referral_code) de quem indicou, capturado no cadastro
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by text;

-- 2) abonos de indicação: 1 por indicado (unique), com teto anual verificado no cron
CREATE TABLE IF NOT EXISTS public.referral_signup_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  days int NOT NULL DEFAULT 30,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_signup_bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrer reads own bonuses" ON public.referral_signup_bonuses;
CREATE POLICY "referrer reads own bonuses" ON public.referral_signup_bonuses
  FOR SELECT USING (auth.uid() = referrer_user_id);
-- escrita só via service role (cron)

-- 3) handle_new_user: trial de 30 dias pro lead do STAND (shopping) + captura do referred_by.
-- Casamento de telefone por SUFIXO de 8 dígitos (ignora DDI 55 e o 9º dígito).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone text := COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone);
  v_digits text := regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g');
  v_trial interval := interval '7 days';
BEGIN
  IF length(v_digits) >= 8 AND EXISTS (
    SELECT 1 FROM public.whatsapp_events
    WHERE kind = 'stand_lead'
      AND created_at > now() - interval '90 days'
      AND right(regexp_replace(from_phone, '\D', '', 'g'), 8) = right(v_digits, 8)
  ) THEN
    v_trial := interval '30 days';  -- brinde do stand
  END IF;

  INSERT INTO public.users (id, phone, name, email, trial_started_at, trial_ends_at, subscription_status, referred_by, created_at, updated_at)
  VALUES (
    NEW.id,
    v_phone,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Proprietário'),
    COALESCE(NEW.raw_user_meta_data->>'email', NEW.email),
    NOW(), NOW() + v_trial, 'trial',
    NULLIF(NEW.raw_user_meta_data->>'referred_by', ''),
    NOW(), NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
