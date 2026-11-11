-- PEDÁGIOS FREE FLOW (sem cancela): a cobrança que o motorista informa (ou manda a foto) pra Nina lembrar
-- antes de vencer, até ele dizer que pagou. O Co-pilot NÃO descobre passagens sozinho (sem API oficial).
create table if not exists public.pedagios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid,
  placa text,
  concessionaria text,
  rodovia text,
  local text,                       -- pórtico/praça/cidade
  data_passagem date,
  valor numeric(10,2),
  vencimento date,                  -- prazo pra pagar (o que vier na cobrança / no app CNH do Brasil)
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  pago_em timestamptz,
  pago_informado_por text,          -- 'cliente' (ele avisou) — não há confirmação automática da concessionária
  fonte text not null default 'cliente',
  obs text,
  created_at timestamptz not null default now()
);
create index if not exists pedagios_user_status on public.pedagios (user_id, status);

alter table public.pedagios enable row level security;
drop policy if exists "pedagios do dono" on public.pedagios;
create policy "pedagios do dono" on public.pedagios for select to authenticated using (user_id = auth.uid());
drop policy if exists "dono marca pago" on public.pedagios;
create policy "dono marca pago" on public.pedagios for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
