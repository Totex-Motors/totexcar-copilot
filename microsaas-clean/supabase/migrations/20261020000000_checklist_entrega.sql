-- CHECKLIST DE ENTREGA — na entrega, o vendedor ativa a etiqueta com o comprador e o Co-pilot conduz a
-- conferência: foto do painel ligado (km + nenhuma luz de alerta) e o OK do cliente nos itens de entrega.
-- O registro (data, hora, km, foto, itens e o telefone que confirmou) é a prova de que o carro saiu em
-- condições de uso.

create table if not exists public.entrega_checklists (
  id uuid primary key default gen_random_uuid(),
  dealership text,
  tag_id uuid,
  journey_id uuid,
  user_id uuid,
  account_id uuid,
  vendedor_id uuid,
  customer_phone text not null,
  customer_name text,
  car_desc text,
  placa text,
  status text not null default 'aguardando_foto'
    check (status in ('aguardando_foto', 'aguardando_confirmacao', 'ok', 'problema')),
  km int,
  luz_alerta boolean,
  painel_obs text,
  foto_path text,
  itens jsonb,
  problema_texto text,
  iniciado_em timestamptz not null default now(),
  foto_em timestamptz,
  confirmado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists entrega_checklists_phone_idx on public.entrega_checklists (customer_phone, iniciado_em desc);
create index if not exists entrega_checklists_loja_idx on public.entrega_checklists (dealership, iniciado_em desc);
alter table public.entrega_checklists enable row level security;
