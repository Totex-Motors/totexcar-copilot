-- COFRE DOS DOCUMENTOS: chave AES-256 dos documentos/CNH dos clientes (ver _shared/cofre.ts).
-- A chave é gerada AQUI DENTRO do banco e fica no Supabase Vault: ninguém vê, nem quem roda este SQL.
-- ATENÇÃO: nunca apague o segredo 'docs_chave' do Vault — sem ele os documentos cifrados não abrem mais.

-- 1) gera a chave uma única vez (rodar de novo não troca)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'docs_chave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'docs_chave',
      'Chave AES-256 dos documentos e CNH dos clientes (ArquivoZap). NÃO APAGAR.');
  end if;
end $$;

-- 2) só as funções do servidor (service role) leem a chave
create or replace function public.docs_chave() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'docs_chave' limit 1
$$;
revoke all on function public.docs_chave() from public, anon, authenticated;
grant execute on function public.docs_chave() to service_role;

-- 3) a cada 10 min cifra o que ainda estiver aberto (documentos antigos e nº da CNH no cadastro), em lotes
select cron.unschedule(jobid) from cron.job where jobname = 'cofre-documentos';
select cron.schedule('cofre-documentos', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/doc?acao=migrar&secret='
           || (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret'),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
