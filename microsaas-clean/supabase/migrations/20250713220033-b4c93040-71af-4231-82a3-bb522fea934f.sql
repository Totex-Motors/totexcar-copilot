-- Trigger para enviar webhook de boas-vindas após cadastro
CREATE OR REPLACE FUNCTION public.send_welcome_webhook_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Chamar edge function para enviar webhook
  PERFORM net.http_post(
    url := 'https://knznbwolrfellinmrgyj.supabase.co/functions/v1/send-welcome-webhook',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtuem5id29scmZlbGxpbm1yZ3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2Nzk2NTcsImV4cCI6MjA2NzI1NTY1N30.Y_oGhj-BAEAM3ap9Zf0FRvtLEy1gHi6dh4IddZ8Bfh4"}'::jsonb,
    body := json_build_object(
      'userId', NEW.id,
      'userData', json_build_object(
        'email', (SELECT email FROM auth.users WHERE id = NEW.id),
        'name', NEW.name,
        'phone', NEW.phone
      )
    )::jsonb
  );
  
  RETURN NEW;
END;
$$;

-- Criar trigger no insert de usuários
DROP TRIGGER IF EXISTS on_user_created_webhook ON public.users;
CREATE TRIGGER on_user_created_webhook
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_webhook_trigger();