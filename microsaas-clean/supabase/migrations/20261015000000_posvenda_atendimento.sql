-- PÓS-VENDA — ATENDIMENTO COM HANDOFF (Fase 1)
-- O Co-pilot atende primeiro; quando precisa de gente da loja, abre um CASO e avisa o GRUPO da equipe
-- (número uazapi do Canal, que só posta em grupo @g.us). Quem toca o link manda "#assumir N" pro
-- Co-pilot e vira a ponte: o que o vendedor escreve vai pro cliente e vice-versa, no mesmo chat.
-- Escada: vendedor da venda (nível 1) → gerente de manutenção (2) → gerente geral (3), SLA por degrau,
-- só conta dentro do horário de atendimento. Tudo service-role (RLS ligado, sem policies).

-- equipe da loja (quem pode assumir casos)
create table if not exists public.posvenda_equipe (
  id uuid primary key default gen_random_uuid(),
  dealership text not null,
  nome text not null,
  phone text not null,                                   -- só dígitos, com 55
  papel text not null default 'vendedor'
    check (papel in ('vendedor', 'gerente_manutencao', 'gerente_geral')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (dealership, phone)
);

-- configuração por loja: grupo do WhatsApp, SLA por degrau e horário de atendimento (BRT)
create table if not exists public.posvenda_config (
  dealership text primary key,
  grupo_id text,                                         -- xxxxx@g.us
  grupo_nome text,
  sla_min int not null default 15,
  horario jsonb not null default
    '{"1":["08:00","18:00"],"2":["08:00","18:00"],"3":["08:00","18:00"],"4":["08:00","18:00"],"5":["08:00","18:00"],"6":["08:00","12:00"]}'::jsonb,
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

-- quem vendeu (liga a venda do pós-venda ao vendedor da equipe)
alter table public.postsale_journeys
  add column if not exists vendedor_id uuid references public.posvenda_equipe(id) on delete set null;

-- casos (atendimentos)
create table if not exists public.posvenda_casos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  dealership text not null,
  customer_phone text not null,
  customer_name text,
  user_id uuid,
  journey_id uuid,
  car_desc text,
  placa text,
  motivo text not null default 'outro',
  resumo text,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  status text not null default 'aberto' check (status in ('aberto', 'em_atendimento', 'encerrado', 'cancelado')),
  vendedor_id uuid references public.posvenda_equipe(id) on delete set null,
  nivel int not null default 1,
  nivel_desde timestamptz not null default now(),
  agente_id uuid references public.posvenda_equipe(id) on delete set null,
  assumido_at timestamptz,
  encerrado_at timestamptz,
  encerrado_por text,
  nota int check (nota between 1 and 5),
  nota_pedida_at timestamptz,
  nota_at timestamptz,
  origem text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists posvenda_casos_numero_uq on public.posvenda_casos (numero);
create index if not exists posvenda_casos_cliente_idx on public.posvenda_casos (customer_phone, status);
create index if not exists posvenda_casos_agente_idx on public.posvenda_casos (agente_id, status);
create index if not exists posvenda_casos_loja_idx on public.posvenda_casos (dealership, status, created_at desc);

-- histórico da conversa do caso (o que passou pela ponte)
create table if not exists public.posvenda_mensagens (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.posvenda_casos(id) on delete cascade,
  de text not null check (de in ('cliente', 'agente', 'copilot', 'sistema')),
  autor text,
  texto text,
  midia text,
  created_at timestamptz not null default now()
);
create index if not exists posvenda_mensagens_caso_idx on public.posvenda_mensagens (caso_id, created_at);

alter table public.posvenda_equipe enable row level security;
alter table public.posvenda_config enable row level security;
alter table public.posvenda_casos enable row level security;
alter table public.posvenda_mensagens enable row level security;

-- ESCADA: a cada 5 min a função posvenda (job=tick) sobe de degrau os casos sem dono há SLA minutos.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'posvenda-escada') then
    perform cron.unschedule('posvenda-escada');
  end if;
end $$;
select cron.schedule('posvenda-escada', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://gkkjhnzkqhpgrwrmofev.supabase.co/functions/v1/posvenda?job=tick&secret='
           || (select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret'),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$cron$);
