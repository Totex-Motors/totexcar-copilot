-- HISTÓRICO MENSAL DA FIPE (carros): a fipe_tabela é apagada e recarregada todo mês pelo fipe-sync,
-- então o mês anterior se perdia. Aqui fica UMA linha por (código FIPE, ano-modelo, mês de referência)
-- para calcular valorização/depreciação e quedas seguidas (alerta de troca do Co-pilot).
-- ref = AAAAMM (ex.: 202610). Só o service role lê/escreve (RLS ligado, sem policy).
create table if not exists public.fipe_historico (
  codigo_fipe    text    not null,
  ano_modelo     integer not null,
  ref            integer not null,
  valor_centavos bigint  not null,
  primary key (codigo_fipe, ano_modelo, ref)
);
alter table public.fipe_historico enable row level security;

-- vínculo do carro do dono com a FIPE (preenchido sozinho pela placa ou por marca/modelo/ano)
alter table public.accounts add column if not exists fipe_codigo text;
alter table public.accounts add column if not exists fipe_ano integer;

-- chave do alerta mensal automático de queda (começa DESLIGADA; liga depois do teste com o dono)
alter table public.app_settings add column if not exists fipe_alerta_auto boolean not null default false;
