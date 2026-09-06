-- Fábrica do Cartão Fidelidade: chave de admin que protege o endpoint de
-- provisionamento (fidelidade-fabrica). Só o operador da Totex conhece a chave.
create table if not exists public.fidelidade_admin (
  id integer primary key default 1,
  admin_key text not null,
  name text default 'Totex',
  updated_at timestamptz default now(),
  constraint fidelidade_admin_singleton check (id = 1)
);
alter table public.fidelidade_admin enable row level security;
-- sem policies: só a service role (edge function) acessa; anon/authenticated não leem a chave.
-- A chave inicial é semeada fora do versionamento (não fica no git).
