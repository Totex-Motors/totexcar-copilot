-- Cache do "quanto vale meu carro" por placa (não repaga a consulta de placa; FIPE atualiza no mês)
create table if not exists public.valor_cache (
  placa text primary key,
  resultado jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.valor_cache enable row level security;
