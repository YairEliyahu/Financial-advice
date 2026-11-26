-- Shadow Ledger pilot schema.
-- Every tenant transaction must start with:
--   SELECT set_config('app.tenant_id', '<uuid>', true);
-- Login lookup sets app.login_phone. Session lookup sets app.session_id.
-- FORCE ROW LEVEL SECURITY applies the policies to the table owner as well.

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  monthly_recruitment_target numeric(14, 2) NOT NULL DEFAULT 0,
  annual_recruitment_target numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manufacturers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  name_he text NOT NULL,
  manufacturer_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name_he),
  CHECK (manufacturer_type IN ('INVESTMENT_HOUSE', 'INSURANCE'))
);

CREATE TABLE IF NOT EXISTS agreement_versions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  valid_from date NOT NULL,
  valid_to date,
  vat_rate numeric(8, 4) NOT NULL,
  hq_overhead_rate numeric(8, 4) NOT NULL,
  partner_split_rate numeric(8, 4) NOT NULL,
  meeting_quota integer NOT NULL DEFAULT 10,
  meeting_cost numeric(14, 2) NOT NULL DEFAULT 0,
  vehicle_credit numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  agreement_version_id uuid NOT NULL REFERENCES agreement_versions (id),
  product_type text NOT NULL,
  manufacturer_type text NOT NULL,
  manufacturer_id uuid REFERENCES manufacturers (id),
  scope_rate_type text NOT NULL,
  scope_rate_value numeric(14, 4),
  annual_cap numeric(14, 2),
  ongoing_rate numeric(8, 4) NOT NULL DEFAULT 0,
  calculation_base text NOT NULL,
  payment_frequency text NOT NULL,
  enters_aum boolean NOT NULL,
  requires_manual_amount boolean NOT NULL DEFAULT false,
  CHECK (scope_rate_type IN ('FIXED', 'PERCENT', 'PER_MILLION')),
  CHECK (manufacturer_type IN ('INVESTMENT_HOUSE', 'INSURANCE')),
  CHECK (calculation_base IN ('AUM', 'ANNUAL_DEPOSITS', 'PREMIUM')),
  CHECK (payment_frequency IN ('ONE_TIME', 'ANNUAL', 'MONTHLY'))
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  full_name text NOT NULL,
  id_number_iv text NOT NULL,
  id_number_ciphertext text NOT NULL,
  id_number_auth_tag text NOT NULL,
  birth_date date,
  is_base_portfolio boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  client_id uuid NOT NULL REFERENCES clients (id),
  manufacturer_id uuid NOT NULL REFERENCES manufacturers (id),
  product_type text NOT NULL,
  deal_date date NOT NULL,
  absorbed_on date,
  expected_amount numeric(14, 2) NOT NULL,
  actual_amount numeric(14, 2),
  calculation_base_amount numeric(14, 2),
  manual_amount numeric(14, 2),
  expected_gross_scope numeric(14, 2),
  expected_net_scope numeric(14, 2),
  expected_gross_monthly_ongoing numeric(14, 2),
  expected_net_monthly_ongoing numeric(14, 2),
  expected_annual_pace_gross numeric(14, 2),
  expected_annual_pace_net numeric(14, 2),
  recognized_gross_scope numeric(14, 2),
  recognized_net_scope numeric(14, 2),
  recognized_gross_monthly_ongoing numeric(14, 2),
  recognized_net_monthly_ongoing numeric(14, 2),
  recognized_annual_pace_gross numeric(14, 2),
  recognized_annual_pace_net numeric(14, 2),
  enters_aum boolean NOT NULL DEFAULT true,
  show_separate_base boolean NOT NULL DEFAULT false,
  requires_manual_amount boolean NOT NULL DEFAULT false,
  calculation_base text,
  agreement_version_id uuid REFERENCES agreement_versions (id),
  rule_snapshot jsonb,
  deal_status text NOT NULL,
  reconciliation_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (deal_status IN ('SUBMITTED', 'ABSORBED', 'CHURNED')),
  CHECK (reconciliation_status IN ('PENDING_INTAKE', 'PENDING_REVIEW', 'MATCHED', 'DISCREPANCY')),
  CHECK (calculation_base IS NULL OR calculation_base IN ('AUM', 'ANNUAL_DEPOSITS', 'PREMIUM'))
);

CREATE TABLE IF NOT EXISTS financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  deal_id uuid NOT NULL REFERENCES deals (id),
  event_type text NOT NULL,
  event_date date NOT NULL,
  amount numeric(14, 2) NOT NULL,
  clawback_rate numeric(8, 4),
  clawback_amount numeric(14, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (event_type IN ('WITHDRAWAL', 'FULL_EXIT'))
);

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id),
  title text NOT NULL,
  meeting_date date NOT NULL,
  billing_month date NOT NULL,
  source text NOT NULL,
  billable boolean NOT NULL DEFAULT false,
  cost numeric(14, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_tenant_status_idx ON deals (tenant_id, deal_status);
CREATE INDEX IF NOT EXISTS deals_tenant_reconciliation_idx ON deals (tenant_id, reconciliation_status);
CREATE INDEX IF NOT EXISTS agreement_versions_tenant_idx ON agreement_versions (tenant_id, valid_from);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE manufacturers FORCE ROW LEVEL SECURITY;
ALTER TABLE agreement_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals FORCE ROW LEVEL SECURITY;
ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_events FORCE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_self ON tenants;
CREATE POLICY tenants_self ON tenants
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS users_tenant ON users;
CREATE POLICY users_tenant ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS users_login_lookup ON users;
CREATE POLICY users_login_lookup ON users
  FOR SELECT
  USING (phone = NULLIF(current_setting('app.login_phone', true), ''));

DROP POLICY IF EXISTS sessions_tenant ON sessions;
CREATE POLICY sessions_tenant ON sessions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS sessions_by_cookie ON sessions;
CREATE POLICY sessions_by_cookie ON sessions
  FOR SELECT
  USING (id = NULLIF(current_setting('app.session_id', true), '')::uuid);

DROP POLICY IF EXISTS manufacturers_tenant ON manufacturers;
CREATE POLICY manufacturers_tenant ON manufacturers
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS agreement_versions_tenant ON agreement_versions;
CREATE POLICY agreement_versions_tenant ON agreement_versions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS commission_rules_tenant ON commission_rules;
CREATE POLICY commission_rules_tenant ON commission_rules
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS clients_tenant ON clients;
CREATE POLICY clients_tenant ON clients
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS deals_tenant ON deals;
CREATE POLICY deals_tenant ON deals
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS financial_events_tenant ON financial_events;
CREATE POLICY financial_events_tenant ON financial_events
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS meetings_tenant ON meetings;
CREATE POLICY meetings_tenant ON meetings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
