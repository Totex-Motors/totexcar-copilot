-- FIPE automática: de hora em hora o fipe-sync confere se o dataset publicou um mês novo (o arquivo do
-- mês sai uns dias depois da virada) e, se saiu, recarrega a fipe_tabela + fipe_historico. Assim a
-- tela inicial troca a referência sozinha, em até 1 hora depois de o mês ser publicado.

-- tira agendamentos antigos do fipe-sync (rodavam num dia fixo, antes de o mês sair)
select cron.unschedule(jobid) from cron.job where command ilike '%fipe-sync%';

select cron.schedule('fipe-sync-automatico', '17 * * * *', $cron$
  select net.http_post(
    url := 'https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/fipe-sync?se_mudou=1&secret='
           || (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret'),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$cron$);

-- roda já uma vez (traz o mês que estiver publicado e ainda não carregado)
select net.http_post(
  url := 'https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/fipe-sync?se_mudou=1&secret='
         || (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret'),
  headers := '{"Content-Type":"application/json"}'::jsonb,
  body := '{}'::jsonb,
  timeout_milliseconds := 300000
);
