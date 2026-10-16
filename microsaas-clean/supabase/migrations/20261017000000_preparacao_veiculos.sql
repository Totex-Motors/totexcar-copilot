-- PREPARAÇÃO DO CARRO ANTES DA VENDA (oficina da loja — gerente de manutenção).
-- A troca de óleo + filtro (e o km) feita na preparação é o PONTO ZERO do motor de manutenção do
-- Co-pilot: na venda, ela vira o lembrete "Troca de óleo e filtro" do cliente (última troca = km da
-- preparação), então o Co-pilot já sabe quando avisar a próxima — desde o primeiro dia.
-- Service-role (RLS ligado, sem policies).

create table if not exists public.preparacao_veiculos (
  id uuid primary key default gen_random_uuid(),
  dealership text not null,
  vehicle_id text,                         -- id do anúncio no estoque (marketplace); null = carro fora do estoque
  car_desc text,
  placa text,
  data date not null default current_date,
  km int not null check (km > 0),
  oleo boolean not null default true,
  oleo_tipo text,                          -- ex.: 5W30 sintético
  filtro_oleo boolean not null default true,
  filtro_ar boolean not null default false,
  filtro_combustivel boolean not null default false,
  filtro_cabine boolean not null default false,
  intervalo_km int not null default 10000 check (intervalo_km between 1000 and 30000),
  obs text,
  feito_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists preparacao_loja_veiculo_idx on public.preparacao_veiculos (dealership, vehicle_id, data desc);
create index if not exists preparacao_loja_placa_idx on public.preparacao_veiculos (dealership, placa);

-- a venda guarda qual preparação o carro teve; prep_aplicada = já virou lembrete no Co-pilot do cliente
alter table public.postsale_journeys
  add column if not exists preparacao_id uuid references public.preparacao_veiculos(id) on delete set null,
  add column if not exists prep_aplicada boolean not null default false;

alter table public.preparacao_veiculos enable row level security;
