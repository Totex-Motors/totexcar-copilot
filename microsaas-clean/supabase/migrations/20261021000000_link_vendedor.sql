-- LINK DO VENDEDOR: cada vendedor da equipe tem um link pessoal (/venda/<token>) que abre só o cadastro
-- da venda, sem login. Trocar o link no painel gera outro token e invalida o anterior.
alter table public.posvenda_equipe add column if not exists link_token text;
create unique index if not exists posvenda_equipe_link_token_idx on public.posvenda_equipe (link_token) where link_token is not null;
