-- STATUS (stories) do WhatsApp pessoal do dono — instância uazapi DEDICADA, isolada do envio de mensagens.
-- A instância "Totex Motors" (antigo fallback de envio, uazapi_url/token) virou a instância do Status:
-- o webhook dela foi apagado e as credenciais saíram do slot de envio (wa.ts, campanhas, alertas nunca a enxergam).
alter table public.app_settings
  add column if not exists status_uazapi_url text,
  add column if not exists status_uazapi_token text,
  add column if not exists status_autopost boolean not null default false,
  add column if not exists status_dealership_id text;  -- só carros desta loja saem no Status (Cardoso Veículos)

update public.app_settings
   set status_uazapi_url = uazapi_url,
       status_uazapi_token = uazapi_token,
       uazapi_url = null,
       uazapi_token = null
 where id = 1 and uazapi_url ilike '%totexmotors.uazapi.com%';

update public.app_settings
   set status_dealership_id = coalesce(status_dealership_id, 'cmolwv3l105la143rmfkwzs4g')  -- Cardoso Veículos (marketplace)
 where id = 1;

-- CRONS: 10h e 18h BRT (13h e 21h UTC); o das 18h tenta "abaixo da FIPE" primeiro (degrada pro estoque normal)
-- select cron.schedule('totex-status-cardoso-manha', '0 13 * * *', $$ select net.http_post(url := '<carro-do-dia>?secret=…&job=status', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb) $$);
-- select cron.schedule('totex-status-cardoso-tarde', '0 21 * * *', $$ select net.http_post(url := '<carro-do-dia>?secret=…&job=status&tema=fipe', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb) $$);
