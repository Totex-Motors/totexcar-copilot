-- Tabela FIPE local (dataset CC0 fipex-labs) — carros. Populada 1x/mês pela função fipe-sync.
-- Elimina o rate limit da parallelum: placa->valor vira query local instantânea.
create table if not exists public.fipe_tabela (
  codigo_fipe text not null,
  ano_modelo int not null,
  nome_modelo text not null,
  nome_marca text not null,
  nome_combustivel text,
  sigla_combustivel text,
  zero_km boolean default false,
  valor_centavos bigint,
  ref_mes int,
  ref_ano int,
  marca_norm text,
  modelo_norm text
);
create index if not exists fipe_marca_ano_idx on public.fipe_tabela (marca_norm, ano_modelo);
create index if not exists fipe_marca_idx on public.fipe_tabela (marca_norm);
alter table public.fipe_tabela enable row level security;
