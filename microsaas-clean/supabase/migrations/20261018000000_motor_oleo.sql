-- MOTOR DO ÓLEO — o Co-pilot sabe quando cobrar a troca de óleo.
-- Premissa: ESTIMAR sempre (km de hoje = última leitura + ritmo real × dias), CONFIRMAR o km na hora que
-- importa (pede foto do painel quando a troca se aproxima e a leitura está velha), COBRAR com 1 toque
-- (km OU tempo, o que vier primeiro) e FECHAR O CICLO sozinho (troca registrada zera o lembrete).

-- 1) troca por TEMPO além de km (óleo: 12 meses; uso severo/aplicativo: 6)
alter table public.maintenance_reminders add column if not exists interval_meses int;
update public.maintenance_reminders set interval_meses = 12
  where interval_meses is null and title ~* '(ó|o)leo';

-- 2) quando o km do carro foi lido pela última vez (pra estimar o km de hoje)
alter table public.accounts add column if not exists hodometro_em timestamptz;

-- 3) todas as leituras de hodômetro (foto do painel, gasto, entrega, preparação, troca) → ritmo real
create table if not exists public.odometro_leituras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid,
  km int not null check (km > 0),
  lido_em timestamptz not null default now(),
  fonte text not null,                 -- painel | gasto | entrega | preparacao | troca_oleo | cliente
  created_at timestamptz not null default now()
);
create index if not exists odometro_leituras_user_idx on public.odometro_leituras (user_id, lido_em desc);
alter table public.odometro_leituras enable row level security;

-- histórico: leituras que já existem nos gastos (uma vez só) + data da última leitura de cada carro
insert into public.odometro_leituras (user_id, km, lido_em, fonte)
select t.user_id, round(t.odometer)::int, t.transaction_date::timestamptz, 'gasto'
from public.transactions t
where t.odometer > 0 and t.user_id is not null
  and not exists (select 1 from public.odometro_leituras limit 1);

update public.accounts a set hodometro_em = sub.d
from (select user_id, max(transaction_date)::timestamptz as d from public.transactions where odometer > 0 group by user_id) sub
where a.user_id = sub.user_id and a.hodometro is not null and a.hodometro_em is null;

-- 4) oportunidade pra oficina da loja: cliente com troca de óleo vencida
alter table public.posvenda_oportunidades drop constraint if exists posvenda_oportunidades_tipo_check;
alter table public.posvenda_oportunidades add constraint posvenda_oportunidades_tipo_check
  check (tipo in ('garantia_vencendo', 'troca_fipe', 'aniversario', 'indicacao', 'troca_oleo', 'outro'));
