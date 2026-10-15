-- PÓS-VENDA — FASE 3: oportunidades que nascem do pós-venda + respostas padrão da loja.
--  • posvenda_oportunidades: garantia acabando, FIPE em queda seguida (troca), 1 ano de compra…
--    vão pro VENDEDOR da venda pelo grupo da equipe; a loja acompanha o andamento no painel.
--  • posvenda_respostas: perguntas frequentes com a resposta OFICIAL da loja — o Co-pilot usa antes
--    de abrir atendimento (resolve sozinho o que a loja já respondeu uma vez).
-- Service-role (RLS ligado, sem policies).

create table if not exists public.posvenda_oportunidades (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  dealership text not null,
  tipo text not null check (tipo in ('garantia_vencendo', 'troca_fipe', 'aniversario', 'indicacao', 'outro')),
  customer_phone text not null,
  customer_name text,
  car_desc text,
  journey_id uuid,
  vendedor_id uuid references public.posvenda_equipe(id) on delete set null,
  detalhe text,
  status text not null default 'nova' check (status in ('nova', 'em_contato', 'ganha', 'perdida')),
  valor numeric,
  obs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists posvenda_oport_numero_uq on public.posvenda_oportunidades (numero);
create index if not exists posvenda_oport_loja_idx on public.posvenda_oportunidades (dealership, status, created_at desc);
create index if not exists posvenda_oport_cliente_idx on public.posvenda_oportunidades (customer_phone, tipo, created_at desc);

create table if not exists public.posvenda_respostas (
  id uuid primary key default gen_random_uuid(),
  dealership text not null,
  pergunta text not null,
  resposta text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posvenda_respostas_loja_idx on public.posvenda_respostas (dealership, ativo);

alter table public.posvenda_oportunidades enable row level security;
alter table public.posvenda_respostas enable row level security;
