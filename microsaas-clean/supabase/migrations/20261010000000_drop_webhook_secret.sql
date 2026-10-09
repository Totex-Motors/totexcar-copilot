-- Troca do WEBHOOK_SECRET (exposição no repositório público): o fallback no banco deixa de existir.
-- Todas as funções (?secret=) passam a exigir o env WEBHOOK_SECRET (fail-closed, _shared/secret.ts).
alter table public.app_settings drop column if exists webhook_secret;
