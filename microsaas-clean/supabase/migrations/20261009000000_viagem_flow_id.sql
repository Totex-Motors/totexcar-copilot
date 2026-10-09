-- Modo Viagem: id do WhatsApp Flow trocável sem redeploy (versão nova publicada pela função meta-flow).
-- Vazio = usa o secret VIAGEM_FLOW_ID.
alter table public.app_settings add column if not exists viagem_flow_id text;
