-- ROTINA DE KM — a cada 10 dias o Co-pilot pede a atualização do hodômetro e CONTROLA quem registrou.
-- Pedido (D0) → reforço com a imagem "registro de km pendente" (D+2) → ignorado (D+10, abre o próximo ciclo).
-- Qualquer leitura (foto do painel, km digitado, gasto com km, troca de óleo) fecha o pedido como respondido.

create table if not exists public.km_pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  account_id uuid,
  pedido_em timestamptz not null default now(),
  reforco_em timestamptz,
  respondido_em timestamptz,
  km_resposta int,
  status text not null default 'pendente' check (status in ('pendente', 'respondido', 'ignorado')),
  created_at timestamptz not null default now()
);
create index if not exists km_pedidos_user_idx on public.km_pedidos (user_id, pedido_em desc);
-- no máximo 1 pedido aberto por cliente (o cron pode rodar 2x sem duplicar)
create unique index if not exists km_pedidos_um_pendente on public.km_pedidos (user_id) where status = 'pendente';
alter table public.km_pedidos enable row level security;

-- cliente que ignora 3 pedidos seguidos vira aviso pra loja
alter table public.posvenda_oportunidades drop constraint if exists posvenda_oportunidades_tipo_check;
alter table public.posvenda_oportunidades add constraint posvenda_oportunidades_tipo_check
  check (tipo in ('garantia_vencendo', 'troca_fipe', 'aniversario', 'indicacao', 'troca_oleo', 'km_sem_registro', 'outro'));
