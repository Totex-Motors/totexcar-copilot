-- NINA DA EQUIPE no grupo do WhatsApp: grupos extras (além do de atendimento) onde ela responde consultas
-- do time. Formato: [{"id":"1203...@g.us","nome":"Garantia"}]. Sem esta coluna, vale só o grupo de atendimento.
alter table public.posvenda_config add column if not exists nina_grupos jsonb not null default '[]'::jsonb;
