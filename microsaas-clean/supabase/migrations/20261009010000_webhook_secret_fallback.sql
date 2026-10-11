-- (substituída) O fallback app_settings.webhook_secret foi criado em 09/10/2026 e REMOVIDO em seguida:
-- o valor acabou commitado neste arquivo (repositório público). O secret vive só em Supabase → Edge Functions → Secrets.
-- Mantido apenas pelo histórico de migrations; a coluna é apagada em 20261010000000_drop_webhook_secret.sql.
alter table public.app_settings add column if not exists webhook_secret text;
