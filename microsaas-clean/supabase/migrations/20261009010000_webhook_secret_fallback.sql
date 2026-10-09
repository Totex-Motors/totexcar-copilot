-- O secret WEBHOOK_SECRET nunca foi setado nas edge functions (a checagem "if (WEBHOOK_SECRET && …)"
-- ficava desligada → carro-do-dia, whatsapp-webhook e crons aceitavam qualquer chamada).
-- Fallback em app_settings.webhook_secret (mesmo valor das URLs dos crons e do callback do Meta) até o env existir.
alter table public.app_settings add column if not exists webhook_secret text;
update public.app_settings set webhook_secret = 'TCF-uaz-2026-7Kp9Qm3Xv8Rn' where id = 1 and webhook_secret is null;
