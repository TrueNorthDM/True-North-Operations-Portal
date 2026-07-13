-- Directory: all the extra person fields the Directory table, Emails tab, and
-- the person detail modal show. `title` (Job title), `manager_id` (Reports to),
-- `status`, and team membership already exist; this adds the rest.
--
-- Keep in sync with the Directory fetch in
-- src/app/(app)/admin/directory/page.tsx and the PersonForm.

BEGIN;

ALTER TABLE people
  -- Employment
  ADD COLUMN IF NOT EXISTS employment_type   text,      -- "Type": 'us' | 'contractor'
  ADD COLUMN IF NOT EXISTS schedule          text,      -- "Time": 'full' | 'part'
  ADD COLUMN IF NOT EXISTS weekly_hours       numeric,   -- "Weekly hours"
  ADD COLUMN IF NOT EXISTS internal_rate      numeric,   -- "Internal rate" ($/hr)
  -- Reporting (manager_id already exists = "Reports to")
  ADD COLUMN IF NOT EXISTS reports_to_manager text,      -- "Do you report to a manager?": 'yes' | 'no' | 'sometimes'
  ADD COLUMN IF NOT EXISTS also_reports_to_id uuid REFERENCES people(id) ON DELETE SET NULL,
  -- Emails (the four mailboxes on the Emails tab)
  ADD COLUMN IF NOT EXISTS email_true_north   text,
  ADD COLUMN IF NOT EXISTS email_goodnews     text,
  ADD COLUMN IF NOT EXISTS email_coe          text,
  ADD COLUMN IF NOT EXISTS email_personal     text,
  -- Contact
  ADD COLUMN IF NOT EXISTS phone              text,      -- "Phone / WhatsApp"
  ADD COLUMN IF NOT EXISTS location           text,
  -- Onboarding (tri-state chips, not booleans)
  ADD COLUMN IF NOT EXISTS company_email      text,      -- "Company email": 'yes' | 'notyet'
  ADD COLUMN IF NOT EXISTS uses_system        text,      -- "Uses the system": 'yes' | 'notyet' | 'no'
  -- Dates
  ADD COLUMN IF NOT EXISTS date_of_birth      date,
  ADD COLUMN IF NOT EXISTS hire_date          date,      -- "Joined on" (created_at is the import date)
  ADD COLUMN IF NOT EXISTS left_on            date,      -- "Left on" (offboarding)
  -- History
  ADD COLUMN IF NOT EXISTS employment_history text;

COMMIT;
