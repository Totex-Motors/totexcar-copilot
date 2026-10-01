-- REGRA DO TOPO (Clube de Parceiros): ninguém paga pra subir; quem dá o maior benefício (R$) fica no topo
-- (até 3 por categoria/cidade); quem não honra o benefício desce.
alter table public.service_partners
  add column if not exists benefit_value numeric not null default 0,      -- valor estimado do benefício pro cliente (R$)
  add column if not exists honored_count integer not null default 0,       -- cliente confirmou que o benefício foi aplicado
  add column if not exists not_honored_count integer not null default 0;   -- cliente disse que NÃO foi aplicado

-- feedback do cliente após o resgate (pergunta "o benefício foi aplicado?")
alter table public.driver_provider_actions drop constraint if exists driver_provider_actions_action_type_check;
alter table public.driver_provider_actions add constraint driver_provider_actions_action_type_check
  check (action_type = any (array['viewed','opened_route','opened_phone','opened_whatsapp','opened_website','requested_quote','redeemed_benefit','benefit_honored','benefit_not_honored']));
