-- =====================================================================
-- RADAR DE SERVIÇOS — TotexCar Co-pilot
-- Encontra oficina/borracharia/guincho/chaveiro/autoelétrica perto do
-- motorista, com os dados REAIS do carro dele.
--
-- NÃO É CRM. Estabelecimento descoberto NÃO é lead, prospect ou negócio:
-- é uma OPÇÃO DE SERVIÇO apresentada ao motorista, que escolhe livremente.
-- Nada aqui gera abordagem comercial, pipeline ou etapa de venda.
--
-- Adaptado de database/schema.sql do pacote radar-servicos-v2:
--  - sem postgis (distância = haversine em TS; volume não justifica GIST)
--  - sem tenant_id (TCF é single-tenant)
--  - RLS no padrão do projeto (auth.uid() = user_id)
-- =====================================================================

-- ---------------------------------------------------------------------
-- service_searches — 1 linha por busca. Também é o log de custo de API
-- (padrão herdado do prospeccao_uso_api: registra mesmo quando falha).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_searches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id      uuid,
  query           text NOT NULL,
  service_type    text NOT NULL,
  location_text   text,
  latitude        double precision,
  longitude       double precision,
  radius_km       numeric(8,2) NOT NULL DEFAULT 15,
  filters         jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count    integer NOT NULL DEFAULT 0,
  sources         jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost            numeric(12,6) NOT NULL DEFAULT 0,
  duration_ms     integer,
  ok              boolean NOT NULL DEFAULT true,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_searches_user    ON public.service_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_service_searches_created ON public.service_searches(created_at DESC);
-- cache: "mesma categoria + mesma região nas últimas N horas"
CREATE INDEX IF NOT EXISTS idx_service_searches_cache
  ON public.service_searches(service_type, latitude, longitude, created_at DESC);

-- ---------------------------------------------------------------------
-- discovered_providers — estabelecimento descoberto (público ou parceiro).
-- Cache compartilhado entre motoristas: quem busca "borracharia em
-- Barueri" reaproveita o que já foi descoberto por outro.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discovered_providers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_source    text NOT NULL,
  external_id        text,
  name               text NOT NULL,
  normalized_name    text,
  category           text,
  provider_status    text NOT NULL DEFAULT 'publico'
    CHECK (provider_status IN ('publico', 'parceiro_totex', 'assistencia_contratada')),
  dealership         text,          -- preenchido quando provider_status='parceiro_totex'
  phone              text,
  phone_normalized   text,
  whatsapp           text,
  website            text,
  domain             text,
  address            text,
  city               text,
  state              text,
  latitude           double precision,
  longitude          double precision,
  rating             numeric(3,2),
  review_count       integer,
  opening_hours      jsonb,
  service_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence         numeric(4,3),
  first_seen_at      timestamptz NOT NULL DEFAULT now(),
  last_checked_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_providers_category ON public.discovered_providers(category);
CREATE INDEX IF NOT EXISTS idx_providers_city     ON public.discovered_providers(city);
CREATE INDEX IF NOT EXISTS idx_providers_latlon   ON public.discovered_providers(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_providers_status   ON public.discovered_providers(provider_status);
-- chaves de deduplicação (ordem do radar-servicos.md: fonte > telefone > domínio > nome+coords)
CREATE INDEX IF NOT EXISTS idx_providers_phone_norm ON public.discovered_providers(phone_normalized)
  WHERE phone_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_providers_domain     ON public.discovered_providers(domain)
  WHERE domain IS NOT NULL;

-- ---------------------------------------------------------------------
-- provider_services — o que cada estabelecimento atende.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       uuid NOT NULL REFERENCES public.discovered_providers(id) ON DELETE CASCADE,
  service_type      text NOT NULL,
  description       text,
  mobile_service    boolean,
  emergency_service boolean,
  open_24h          boolean,
  supports_ev       boolean,
  supports_hybrid   boolean,
  price_from        numeric(12,2),
  currency          text DEFAULT 'BRL',
  source            text,
  last_checked_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, service_type)
);

-- ---------------------------------------------------------------------
-- provider_search_results — o que foi mostrado, em que ordem e por quê.
-- Auditoria do ranking (garante que dá pra provar que não ordenamos por
-- comissão escondida).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_search_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id       uuid NOT NULL REFERENCES public.service_searches(id) ON DELETE CASCADE,
  provider_id     uuid NOT NULL REFERENCES public.discovered_providers(id) ON DELETE CASCADE,
  distance_km     numeric(8,2),
  rank_score      numeric(6,3),
  rank_position   integer,
  matched_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (search_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_search_results_search ON public.provider_search_results(search_id);

-- ---------------------------------------------------------------------
-- driver_provider_actions — TELEMETRIA DE PRODUTO, não CRM.
-- Registra que o motorista abriu rota/telefone/WhatsApp. NÃO cria
-- cadastro do motorista no estabelecimento.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_provider_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id  uuid,
  search_id   uuid REFERENCES public.service_searches(id) ON DELETE SET NULL,
  provider_id uuid NOT NULL REFERENCES public.discovered_providers(id) ON DELETE CASCADE,
  action_type text NOT NULL
    CHECK (action_type IN (
      'viewed', 'opened_route', 'opened_phone',
      'opened_whatsapp', 'opened_website', 'requested_quote'
    )),
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_actions_user     ON public.driver_provider_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_actions_provider ON public.driver_provider_actions(provider_id);

-- ---------------------------------------------------------------------
-- provider_quote_requests — pedido de orçamento. Efeito externo:
-- só existe com consentimento explícito + lista dos dados compartilhados.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_quote_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id    uuid,
  service_type  text NOT NULL,
  provider_ids  uuid[] NOT NULL,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  shared_fields text[] NOT NULL DEFAULT '{}',
  consent_text  text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'answered', 'failed', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- consentimento não é opcional: sem texto de autorização e sem dizer
  -- QUAIS dados vão, a linha não entra.
  CONSTRAINT quote_requires_consent
    CHECK (length(btrim(consent_text)) >= 10 AND array_length(shared_fields, 1) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_user ON public.provider_quote_requests(user_id);

-- =====================================================================
-- RLS
-- discovered_providers / provider_services = catálogo público (leitura
-- livre pra autenticado; escrita só service role, via edge function).
-- O resto é do dono.
-- =====================================================================
ALTER TABLE public.service_searches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_providers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_provider_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own searches" ON public.service_searches;
CREATE POLICY "Users manage their own searches" ON public.service_searches
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can read providers" ON public.discovered_providers;
CREATE POLICY "Authenticated can read providers" ON public.discovered_providers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read provider services" ON public.provider_services;
CREATE POLICY "Authenticated can read provider services" ON public.provider_services
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users read their own search results" ON public.provider_search_results;
CREATE POLICY "Users read their own search results" ON public.provider_search_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.service_searches s
      WHERE s.id = provider_search_results.search_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage their own actions" ON public.driver_provider_actions;
CREATE POLICY "Users manage their own actions" ON public.driver_provider_actions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage their own quote requests" ON public.provider_quote_requests;
CREATE POLICY "Users manage their own quote requests" ON public.provider_quote_requests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- Localização habitual do motorista.
-- O projeto não guardava cidade em lugar nenhum (nem em users, nem em
-- accounts). Sem isso o radar teria que perguntar "onde você está?" em
-- TODA busca. Guardamos a última informada para usar como padrão —
-- o motorista pode sobrescrever a qualquer momento.
-- =====================================================================
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf     text;

-- =====================================================================
-- Config do módulo (app_settings, linha única id=1)
-- =====================================================================
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS radar_enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS radar_cache_hours    integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS radar_default_radius numeric(6,2) NOT NULL DEFAULT 15,
  -- provider de busca: 'search_preview' (padrão, gpt-4o-search-preview) | 'google_places'
  ADD COLUMN IF NOT EXISTS radar_search_provider text NOT NULL DEFAULT 'search_preview',
  ADD COLUMN IF NOT EXISTS google_places_api_key text;
