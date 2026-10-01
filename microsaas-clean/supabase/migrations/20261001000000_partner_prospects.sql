-- Prospecção de parceiros a partir do Radar (discovered_providers → convite 1 a 1 pelo WhatsApp).
-- Guarda o estágio de cada estabelecimento descoberto: novo → contatado → respondeu → cadastrou / recusou.
create table if not exists public.partner_prospects (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique references public.discovered_providers(id) on delete cascade,
  status text not null default 'novo' check (status in ('novo','contatado','respondeu','cadastrou','recusou','sem_whatsapp')),
  ref text,                       -- número/pessoa que prospectou (zap1, zap2…)
  notes text,
  touches integer not null default 0,
  contacted_at timestamptz,
  last_touch_at timestamptz,
  partner_id uuid references public.service_partners(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_prospects_status_idx on public.partner_prospects(status);
alter table public.partner_prospects enable row level security; -- sem policies: só service role (admin-api / parceiro)
