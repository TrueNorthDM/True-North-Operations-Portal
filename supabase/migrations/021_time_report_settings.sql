-- Migration 021: Time Report settings tables

-- Job codes cached from TSheets (treated as clients/projects)
CREATE TABLE IF NOT EXISTS tr_clients (
  id                 SERIAL PRIMARY KEY,
  tsheets_jobcode_id INT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  active             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One budget per client per period; creating a new one auto-closes the previous
CREATE TABLE IF NOT EXISTS tr_budgets (
  id               SERIAL PRIMARY KEY,
  client_id        INT NOT NULL REFERENCES tr_clients(id) ON DELETE CASCADE,
  hours_allocated  NUMERIC,
  budget_amount    NUMERIC,
  extra_budget     NUMERIC NOT NULL DEFAULT 0,
  start_date       DATE NOT NULL,
  end_date         DATE,
  justification    TEXT NOT NULL,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, start_date)
);

-- Person x client rate history; closing old row + inserting new preserves history
CREATE TABLE IF NOT EXISTS tr_assignments (
  id               SERIAL PRIMARY KEY,
  tsheets_user_id  INT NOT NULL,
  client_id        INT NOT NULL REFERENCES tr_clients(id) ON DELETE CASCADE,
  hourly_rate      NUMERIC NOT NULL,
  active           BOOLEAN NOT NULL DEFAULT true,
  effective_from   DATE NOT NULL,
  effective_to     DATE,
  justification    TEXT NOT NULL,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable audit trail for every change to budgets and assignments
CREATE TABLE IF NOT EXISTS tr_audit_log (
  id            SERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     INT NOT NULL,
  action        TEXT NOT NULL,
  before_data   JSONB,
  after_data    JSONB NOT NULL,
  justification TEXT NOT NULL,
  changed_by    UUID REFERENCES auth.users(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tr_budgets_client      ON tr_budgets(client_id);
CREATE INDEX IF NOT EXISTS tr_assignments_user    ON tr_assignments(tsheets_user_id, client_id);
CREATE INDEX IF NOT EXISTS tr_audit_log_entity    ON tr_audit_log(entity_type, entity_id);
