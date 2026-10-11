-- FOTO DO CARRO no card "Meu carro": recortada sem fundo (Photoroom) e guardada no Storage.
-- Origem: 'estoque' (foto de capa do anúncio da loja, puxada na venda) ou 'cliente' (enviada pelo dono).
alter table public.accounts add column if not exists foto_url text;
alter table public.accounts add column if not exists foto_fonte text;
alter table public.accounts add column if not exists foto_at timestamptz;

-- pós-venda: liga a venda ao anúncio do estoque e guarda a foto de capa já recortada
alter table public.postsale_journeys add column if not exists vehicle_id text;
alter table public.postsale_journeys add column if not exists foto_url text;

-- chave do Photoroom (recorte do fundo) — só o servidor lê
alter table public.app_settings add column if not exists photoroom_api_key text;

-- pasta pública das fotos (nome aleatório por arquivo; só o servidor grava)
insert into storage.buckets (id, name, public) values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;
