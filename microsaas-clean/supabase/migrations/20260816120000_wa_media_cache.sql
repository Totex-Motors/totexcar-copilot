-- Cache de media_id da Meta por URL de imagem (conversão WebP→PNG da vitrine).
-- Media id da Meta vale 30 dias; reusamos por 25 e reconvertem depois.
-- (aplicada em produção em 2026-08-16 via MCP)
CREATE TABLE IF NOT EXISTS public.wa_media_cache (
  url text PRIMARY KEY,
  media_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_media_cache ENABLE ROW LEVEL SECURITY;
-- só service role usa (webhook/cron); nenhuma policy de leitura pública
