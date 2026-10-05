-- Etiqueta QR do para-brisa: logo da loja na FRENTE (lado do vidro). URL por loja (absoluta ou caminho em /public).
alter table public.dealership_settings add column if not exists tag_logo_url text;

insert into public.dealership_settings (dealership, tag_logo_url, updated_at)
values ('Cardoso Veículos', '/etiqueta/cardoso-veiculos.png', now())
on conflict (dealership) do update set tag_logo_url = excluded.tag_logo_url, updated_at = now();
