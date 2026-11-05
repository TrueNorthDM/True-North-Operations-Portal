-- 154_rollout_no_wave.sql
--
-- North Time rollout, a third group (owner, 5 November 2026): "No wave", for
-- people it is not yet known whether they will use North Time. A Super Admin
-- puts a person there in Company settings > North Time rollout.
--
--   tc_rollout_people.wave   also 0: no wave. The person has no North Time
--                            start date while there: the clock, Switch and
--                            Add time refuse for them, the TSheets import
--                            keeps every entry of theirs, and North Time's
--                            timesheet and invoice reminders leave them out
--                            (src/lib/timeclock/waves.ts).
--
-- tc_rollout_waves is unchanged: "no wave" has no date. Only the CHECK
-- changes; the table stays server only, as migration 129 left it (RLS on,
-- nothing for the anonymous or signed-in role), restated here so a run of
-- this file never loosens it. Safe to run more than once.

BEGIN;

ALTER TABLE tc_rollout_people DROP CONSTRAINT IF EXISTS tc_rollout_people_wave_check;
ALTER TABLE tc_rollout_people ADD CONSTRAINT tc_rollout_people_wave_check CHECK (wave IN (0, 1, 2));
COMMENT ON COLUMN tc_rollout_people.wave IS '1 or 2: the wave a Super Admin moved the person to; 0: no wave (no North Time start date).';

ALTER TABLE tc_rollout_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tc_rollout_people FROM anon, authenticated;

COMMIT;
