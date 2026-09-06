-- Bucket público de fotos do cardápio (multi-cliente). Leitura pública (para <img src>),
-- escrita só pela edge function `fidelidade` (service role). Caminho: <tenant>/<uuid>.<ext>.
insert into storage.buckets (id, name, public)
values ('fidelidade-fotos', 'fidelidade-fotos', true)
on conflict (id) do update set public = true;
