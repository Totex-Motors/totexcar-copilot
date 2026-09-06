-- Fidelidade multi-cliente: cofres isolados por loja para o motor único da fábrica.
-- A J.J continua em jj_state (single-tenant, id=1) e NÃO é tocada por esta migração.
-- Novos clientes (ex.: Brasa Caipira) vivem aqui, isolados pela chave da loja.

create table if not exists public.fidelidade_tenants (
  tenant     text primary key,
  wa_key     text unique not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fidelidade_state (
  tenant     text primary key references public.fidelidade_tenants(tenant) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Só a edge function (service role) acessa. RLS ligada sem policies = nega anon/auth.
alter table public.fidelidade_tenants enable row level security;
alter table public.fidelidade_state   enable row level security;

-- Primeiro cliente multi-tenant: Brasa Caipira Assados.
insert into public.fidelidade_tenants (tenant, wa_key)
values ('brasa-caipira', '5aeb3548e106741127d1bc3fe9c0f39c')
on conflict (tenant) do update set wa_key = excluded.wa_key, active = true;
