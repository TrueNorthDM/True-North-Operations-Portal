-- Migration 027: an optional per-month narrative note for the i7 report.
-- Shown on the report and included in the client/internal PDF export.
CREATE TABLE IF NOT EXISTS i7_report_notes (
  month       DATE PRIMARY KEY,            -- first of month
  note        TEXT NOT NULL DEFAULT '',
  updated_by  UUID REFERENCES auth.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
