-- The 2026 job structure (David's "Time-Tracking Structure", owner's changes
-- of 26 and 27 October 2026) beside the TSheets one, in the same tables.
--
--   tc_jobcodes.structure  1 = the TSheets job tree (every entry before the
--                          switch date keeps it for good), 2 = the 2026
--                          structure: Client > Division > Project.
--   tc_jobcodes.level      client, division or project (structure 2 only;
--                          True North Internal has projects right under the
--                          client). Projects are what people clock into; the
--                          billable flag of a project is the entry's Billable.
--   tc_fields.structure    the 2026 Activity is its own field (26 values), so
--                          the old "3 Activity" values stay as they were.
--   tc_field_options.family  the group an activity shows under (Content, SEO...).
--   tc_settings.structure_switch_date  the day the 2026 structure starts. Empty:
--                          not decided, only the TSheets structure is offered.
--
-- Nothing is rewritten: old entries keep their job and fields.

BEGIN;

ALTER TABLE tc_jobcodes ADD COLUMN IF NOT EXISTS structure SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE tc_jobcodes ADD COLUMN IF NOT EXISTS level TEXT;
DO $$ BEGIN
  ALTER TABLE tc_jobcodes ADD CONSTRAINT tc_jobcodes_structure_check CHECK (structure IN (1, 2));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE tc_jobcodes ADD CONSTRAINT tc_jobcodes_level_check CHECK (
    (structure = 1 AND level IS NULL) OR (structure = 2 AND level IN ('client', 'division', 'project')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- One name per place in the 2026 tree (the seed and the catalogue rely on it).
CREATE UNIQUE INDEX IF NOT EXISTS tc_jobcodes_v2_place
  ON tc_jobcodes (COALESCE(parent_id, 0), lower(name)) WHERE structure = 2;

ALTER TABLE tc_fields ADD COLUMN IF NOT EXISTS structure SMALLINT NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE tc_fields ADD CONSTRAINT tc_fields_structure_check CHECK (structure IN (1, 2));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tc_field_options ADD COLUMN IF NOT EXISTS family TEXT;

ALTER TABLE tc_settings ADD COLUMN IF NOT EXISTS structure_switch_date DATE;

COMMIT;
