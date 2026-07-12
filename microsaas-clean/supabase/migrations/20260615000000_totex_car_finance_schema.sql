-- =====================================================================
-- Totex_CAR_FINANCE — schema completo (ecossistema Totexmotors)
-- Controle financeiro de gastos com veículo (1 carro por usuário).
-- Reaproveita a lógica do FinanceBot: users / accounts(=veículo) /
-- categories / transactions(=gasto), com colunas específicas de carro.
-- Idempotente: pode rodar em projeto novo ou existente.
-- =====================================================================

-- ---------- Extensões ----------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Tabela: users (proprietário) ----------
CREATE TABLE IF NOT EXISTS public.users (
  id                  UUID PRIMARY KEY,
  phone               TEXT,
  name                TEXT,
  email               TEXT,
  currency            TEXT DEFAULT 'BRL',
  timezone            TEXT DEFAULT 'America/Sao_Paulo',
  plan                TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'trial',
  stripe_customer_id  TEXT,
  trial_started_at    TIMESTAMPTZ,
  trial_ends_at       TIMESTAMPTZ,
  is_active           BOOLEAN DEFAULT TRUE,
  -- Carta de habilitação (CNH) do proprietário
  cnh_numero          TEXT,
  cnh_categoria       TEXT,
  cnh_vencimento      DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Garante colunas de CNH/trial caso a tabela já exista
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cnh_numero TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cnh_categoria TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cnh_vencimento DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

-- ---------- Tabela: accounts (=VEÍCULO) ----------
CREATE TABLE IF NOT EXISTS public.accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,          -- apelido do carro
  type                     TEXT DEFAULT 'carro',   -- carro / moto / caminhonete / suv ...
  -- Dados do veículo
  marca                    TEXT,
  modelo                   TEXT,
  ano_fabricacao           INTEGER,
  ano_modelo               INTEGER,
  placa                    TEXT,
  renavam                  TEXT,
  chassi                   TEXT,
  cor                      TEXT,
  combustivel              TEXT,                   -- flex / gasolina / etanol / diesel / gnv / elétrico
  hodometro                NUMERIC DEFAULT 0,      -- km atual
  seguradora               TEXT,
  -- Vencimentos de documentos
  licenciamento_vencimento DATE,
  ipva_vencimento          DATE,
  seguro_vencimento        DATE,
  -- Compatibilidade com a base original (não usados no domínio carro)
  initial_balance          NUMERIC DEFAULT 0,
  current_balance          NUMERIC DEFAULT 0,
  is_active                BOOLEAN DEFAULT TRUE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Garante colunas do veículo caso a tabela já exista
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS marca TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS modelo TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS ano_fabricacao INTEGER;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS ano_modelo INTEGER;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS renavam TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS chassi TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS cor TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS combustivel TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS hodometro NUMERIC DEFAULT 0;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS seguradora TEXT;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS licenciamento_vencimento DATE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS ipva_vencimento DATE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS seguro_vencimento DATE;

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- ---------- Tabela: categories (categorias de gasto/receita) ----------
CREATE TABLE IF NOT EXISTS public.categories (
  id        SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  type      TEXT DEFAULT 'expense',  -- 'expense' | 'income'
  color     TEXT,
  icon      TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  CONSTRAINT categories_name_type_key UNIQUE (name, type)
);

-- ---------- Tabela: transactions (=GASTO do carro) ----------
CREATE TABLE IF NOT EXISTS public.transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES public.users(id) ON DELETE CASCADE,
  account_id       UUID REFERENCES public.accounts(id) ON DELETE CASCADE,  -- veículo
  category_id      INTEGER REFERENCES public.categories(id),
  description      TEXT,
  amount           NUMERIC NOT NULL,
  type             TEXT DEFAULT 'expense',   -- 'expense' | 'income'
  transaction_date DATE DEFAULT CURRENT_DATE,
  odometer         NUMERIC,                  -- hodômetro no momento do gasto
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS odometer NUMERIC;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own data" ON public.users;
CREATE POLICY "Users can manage their own data" ON public.users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Categorias: todos os autenticados leem; só categorias do usuário (não-sistema) podem ser alteradas
DROP POLICY IF EXISTS "Anyone can read categories" ON public.categories;
CREATE POLICY "Anyone can read categories" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert custom categories" ON public.categories;
CREATE POLICY "Users can insert custom categories" ON public.categories
  FOR INSERT WITH CHECK (is_system = false);

DROP POLICY IF EXISTS "Users can update custom categories" ON public.categories;
CREATE POLICY "Users can update custom categories" ON public.categories
  FOR UPDATE USING (is_system = false);

DROP POLICY IF EXISTS "Users can delete custom categories" ON public.categories;
CREATE POLICY "Users can delete custom categories" ON public.categories
  FOR DELETE USING (is_system = false);

-- =====================================================================
-- Trigger: cria linha em public.users + trial de 7 dias no signup
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone, name, email, trial_started_at, trial_ends_at, subscription_status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone),
    COALESCE(NEW.raw_user_meta_data->>'name', 'Proprietário'),
    COALESCE(NEW.raw_user_meta_data->>'email', NEW.email),
    NOW(),
    NOW() + INTERVAL '7 days',
    'trial',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- Funções de trial
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_trial_active(user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN u.plan = 'premium' THEN true
    WHEN u.trial_ends_at IS NULL THEN false
    WHEN u.trial_ends_at > NOW() THEN true
    ELSE false
  END
  FROM public.users u WHERE u.id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.trial_days_remaining(user_id UUID)
RETURNS INTEGER LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN u.plan = 'premium' THEN -1
    WHEN u.trial_ends_at IS NULL THEN 0
    WHEN u.trial_ends_at <= NOW() THEN 0
    ELSE EXTRACT(DAYS FROM (u.trial_ends_at - NOW()))::INTEGER
  END
  FROM public.users u WHERE u.id = user_id;
$$;

-- =====================================================================
-- Seed: categorias de gastos com carro (sistema)
-- =====================================================================
INSERT INTO public.categories (name, type, color, icon, is_system) VALUES
-- Despesas
('Combustível',    'expense', '#f59e0b', 'Fuel',          true),
('Manutenção',     'expense', '#3b82f6', 'Wrench',        true),
('Revisão',        'expense', '#2563eb', 'Settings',      true),
('Peças',          'expense', '#6366f1', 'Cog',           true),
('Pneus',          'expense', '#1f2937', 'CircleDot',     true),
('Seguro',         'expense', '#10b981', 'ShieldCheck',   true),
('IPVA',           'expense', '#ef4444', 'Landmark',      true),
('Licenciamento',  'expense', '#8b5cf6', 'ScrollText',    true),
('Multas',         'expense', '#dc2626', 'AlertTriangle', true),
('Acessórios',     'expense', '#ec4899', 'Sparkles',      true),
('Lavagem',        'expense', '#06b6d4', 'Droplets',      true),
('Estacionamento', 'expense', '#64748b', 'SquareParking', true),
('Pedágio',        'expense', '#0891b2', 'Milestone',     true),
('Financiamento',  'expense', '#f97316', 'Banknote',      true),
('Documentação',   'expense', '#84cc16', 'FileCheck',     true),
('Serviços',       'expense', '#0ea5e9', 'Hammer',        true),
('Outros',         'expense', '#6b7280', 'MoreHorizontal',true),
-- Receitas / reembolsos
('Reembolso',         'income', '#10b981', 'Undo2',     true),
('Venda do Veículo',  'income', '#059669', 'Car',       true),
('Multa Cancelada',   'income', '#0d9488', 'BadgeCheck',true),
('Outras Receitas',   'income', '#0284c7', 'Gift',      true)
ON CONFLICT (name, type) DO NOTHING;
