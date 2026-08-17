-- Funil do stand por loja+promotor. Fonte única pros painéis /admin e /lojista.
-- p_loja opcional (slug) escopa por loja; NULL = todas. SECURITY DEFINER: chamada via service role.
-- (aplicada em produção em 2026-08-17 via MCP)
CREATE OR REPLACE FUNCTION public.stand_report(p_loja text DEFAULT NULL)
RETURNS TABLE(
  loja text, promotor text, escaneios bigint, pessoas bigint,
  presentes bigint, conversaram bigint, ativacoes bigint, ultimo_scan timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH lead_agg AS (
    SELECT from_phone,
      lower(coalesce(nullif(parsed->>'loja',''),'geral')) AS loja,
      lower(coalesce(nullif(parsed->>'promotor',''),'(sem promotor)')) AS promotor,
      count(*) AS escaneios, max(created_at) AS ultimo
    FROM whatsapp_events WHERE kind='stand_lead'
    GROUP BY 1,2,3
  ),
  gift AS (SELECT DISTINCT from_phone FROM whatsapp_events WHERE kind='stand_gift'),
  convs AS (SELECT DISTINCT from_phone FROM whatsapp_events WHERE kind='text' AND parsed->>'action'='stand_followup'),
  acts AS (SELECT DISTINCT right(regexp_replace(phone,'\D','','g'),8) AS p8 FROM users WHERE email ILIKE '%@totexcarfinance.app' AND phone IS NOT NULL)
  SELECT la.loja, la.promotor,
    sum(la.escaneios)::bigint,
    count(*)::bigint,
    count(g.from_phone)::bigint,
    count(c.from_phone)::bigint,
    count(a.p8)::bigint,
    max(la.ultimo)
  FROM lead_agg la
  LEFT JOIN gift g ON g.from_phone = la.from_phone
  LEFT JOIN convs c ON c.from_phone = la.from_phone
  LEFT JOIN acts a ON a.p8 = right(regexp_replace(la.from_phone,'\D','','g'),8)
  WHERE p_loja IS NULL OR la.loja = lower(p_loja)
  GROUP BY 1,2
  ORDER BY 3 DESC;
$$;
REVOKE ALL ON FUNCTION public.stand_report(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stand_report(text) TO service_role;
