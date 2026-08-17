-- Lista de leads individuais do stand (nome + contato) pra exportar e fazer campanha.
-- 1 linha por pessoa (último scan), com flags de presente/conversa/ativação.
-- (aplicada em produção em 2026-08-17 via MCP)
CREATE OR REPLACE FUNCTION public.stand_leads(p_loja text DEFAULT NULL)
RETURNS TABLE(
  telefone text, nome text, loja text, promotor text,
  quando timestamptz, presente boolean, conversou boolean, ativou boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH leads AS (
    SELECT DISTINCT ON (from_phone)
      from_phone,
      nullif(parsed->>'nome','') AS nome,
      lower(coalesce(nullif(parsed->>'loja',''),'geral')) AS loja,
      lower(coalesce(nullif(parsed->>'promotor',''),'(sem promotor)')) AS promotor,
      created_at
    FROM whatsapp_events WHERE kind='stand_lead'
    ORDER BY from_phone, created_at DESC
  ),
  gift AS (SELECT DISTINCT from_phone FROM whatsapp_events WHERE kind='stand_gift'),
  convs AS (SELECT DISTINCT from_phone FROM whatsapp_events WHERE kind='text' AND parsed->>'action'='stand_followup'),
  acts AS (SELECT DISTINCT right(regexp_replace(phone,'\D','','g'),8) AS p8 FROM users WHERE email ILIKE '%@totexcarfinance.app' AND phone IS NOT NULL)
  SELECT l.from_phone, l.nome, l.loja, l.promotor, l.created_at,
    (g.from_phone IS NOT NULL), (c.from_phone IS NOT NULL), (a.p8 IS NOT NULL)
  FROM leads l
  LEFT JOIN gift g ON g.from_phone=l.from_phone
  LEFT JOIN convs c ON c.from_phone=l.from_phone
  LEFT JOIN acts a ON a.p8 = right(regexp_replace(l.from_phone,'\D','','g'),8)
  WHERE p_loja IS NULL OR l.loja = lower(p_loja)
  ORDER BY l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.stand_leads(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stand_leads(text) TO service_role;
