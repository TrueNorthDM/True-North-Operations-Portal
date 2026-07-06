-- Migration 023: per-project budget HOURS (a guide, one level below the client).
--
-- The client-level budget ($ + extra) lives in tr_budgets. This adds the lower
-- level the ops team asked for: budgeted HOURS per i7 project (Wagner Meters,
-- Bessemeter, MME, i7 Marketing) — the projects are groupings of the "1 - i7
-- Code" custom field, so they're identified by name, not a tr_clients row.
--
-- Versioned like tr_assignments: setting a new value closes the previous one
-- (effective_to) so history is preserved; the active row has effective_to NULL.

CREATE TABLE IF NOT EXISTS tr_project_budgets (
  id               SERIAL PRIMARY KEY,
  client_id        INT NOT NULL REFERENCES tr_clients(id) ON DELETE CASCADE,
  project          TEXT NOT NULL,               -- 'Wagner Meters (WM)', 'Bessemeter', …
  hours_allocated  NUMERIC NOT NULL,
  effective_from   DATE NOT NULL,
  effective_to     DATE,
  justification    TEXT NOT NULL,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tr_project_budgets_client ON tr_project_budgets(client_id, project);
