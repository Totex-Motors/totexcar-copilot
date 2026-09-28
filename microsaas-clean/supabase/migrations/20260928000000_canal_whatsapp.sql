-- Canal do WhatsApp (carro do dia + links curtos + "eu garanto") — tabelas e colunas que estavam
-- aplicadas em produção via MCP mas ainda não versionadas. Idempotente (IF NOT EXISTS).

-- Links curtos do Canal: /o/<code> -> carro do marketplace (esconde o id gigante do cliente)
create table if not exists public.oferta_links (
  code text primary key,
  car_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists oferta_links_car_idx on public.oferta_links (car_id);
alter table public.oferta_links enable row level security;

-- Log dos posts do "carro do dia" no canal (rotação de 14 dias + auditoria)
create table if not exists public.canal_posts (
  id uuid primary key default gen_random_uuid(),
  car_id text not null,
  code text,
  ok boolean not null default false,
  raw jsonb,
  posted_at timestamptz not null default now()
);
create index if not exists canal_posts_car_idx on public.canal_posts (car_id, posted_at desc);
alter table public.canal_posts enable row level security;

-- "Eu garanto o estado": lojista marca no painel → o post pode afirmar conservação/pintura
create table if not exists public.car_vouch (
  car_id text primary key,
  vouched_by text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.car_vouch enable row level security;

-- Config do Canal (postagem automática via uazapi — número NÃO-oficial, admin do canal)
alter table public.app_settings
  add column if not exists canal_uazapi_url text not null default '',
  add column if not exists canal_uazapi_token text not null default '',
  add column if not exists canal_newsletter_id text not null default '',
  add column if not exists canal_autopost boolean not null default false,
  add column if not exists comunidade_link text not null default '';
