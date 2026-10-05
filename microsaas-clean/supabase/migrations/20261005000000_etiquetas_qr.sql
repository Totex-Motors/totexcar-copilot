-- ETIQUETAS QR DO PARA-BRISA (jeito 2: cada adesivo tem código próprio, vinculado ao carro na entrega).
-- O QR impresso aponta para {app_url}/q/<token>; o número curto impresso (label, ex.: CV-0001) é o que o
-- vendedor digita no pós-venda pra vincular. Nada do cliente vai no adesivo.
-- Fluxo: lote impresso (status livre) → vínculo na entrega (vinculada) → cliente escaneia e confirma (ativa)
-- → carro revendido: novo dono escaneia e assume (transferida → ativa de novo, com o telefone novo).
create table if not exists public.car_tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,                 -- impresso embaixo do QR (CV-0001)
  token text not null unique,                 -- vai no QR (/q/<token>), aleatório, não adivinhável
  dealership text,                            -- loja dona do lote (nome, igual users.dealership)
  batch text,                                 -- identificação do lote impresso
  status text not null default 'livre' check (status in ('livre','vinculada','ativa','inativa')),
  journey_id uuid references public.postsale_journeys(id) on delete set null,
  user_id uuid,                               -- dono atual no Co-pilot (users.id)
  account_id uuid,                            -- carro atual (accounts.id)
  customer_phone text,                        -- telefone do dono no vínculo (só dígitos) — é o que o scan compara
  customer_name text,
  car_desc text,
  placa text,
  km_entrega integer,
  bound_at timestamptz,
  bound_by uuid,
  activated_at timestamptz,                   -- cliente confirmou "sim, começar"
  transfers integer not null default 0,       -- quantas vezes trocou de dono pelo scan
  scans integer not null default 0,
  last_scan_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists car_tags_dealership_idx on public.car_tags (dealership, status);
create index if not exists car_tags_phone_idx on public.car_tags (customer_phone);

alter table public.car_tags enable row level security;  -- sem política: só service role (edge functions)
