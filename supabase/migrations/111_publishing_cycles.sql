-- 111_publishing_cycles.sql
--
-- Bessemeters on Publishing Goals, counted in two-week cycles (approved by
-- Arnaldo, 15 October 2026).
--
-- 1. A board's rhythm lives on its site: target_cycle_weeks is 1 (a target per
--    week, every board until now) or 2 (a target per two-week cycle), and
--    target_cycle_start is the Monday the first cycle starts (null for a
--    weekly board). The rule is lib/boards/publishing-cycles.ts, mirrored in
--    public/boards.html. The target history (publishing_target_periods) stays
--    keyed by week: a cycle is held to the target in force in its first week.
--
-- 2. Bessemeters gets a sites row, for the language Settings reads (English
--    only) and its rhythm. It has no domain and is not an Href Links site, so
--    sites.domain may now be empty. Href Links and Settings > Sites &
--    languages list their own two sites only (isSiteCode).
--
-- 3. Its English target: 1 page per cycle, from the cycle starting Monday
--    12 October 2026, unless a target was set already. The approval named
--    13 October, which is the Tuesday of that week; a cycle starts on a Monday,
--    and a target dated the Tuesday would not be in force for the cycle that
--    starts the day before. publishing_targets.period_type stays 'weekly': it
--    names how the history is kept, by week, not how the board is counted.
--
-- sites is server-only already (migration 107) and no function is added, so
-- no grant changes.

BEGIN;

-- ── 1. The rhythm ──────────────────────────────────────────────────────────
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS target_cycle_weeks SMALLINT NOT NULL DEFAULT 1
    CHECK (target_cycle_weeks IN (1, 2)),
  ADD COLUMN IF NOT EXISTS target_cycle_start DATE;

-- Two weeks always has its start, a Monday; one week never has one.
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_target_cycle_rule;
ALTER TABLE sites ADD CONSTRAINT sites_target_cycle_rule CHECK (
  (target_cycle_weeks = 1 AND target_cycle_start IS NULL)
  OR (target_cycle_weeks = 2 AND target_cycle_start IS NOT NULL AND EXTRACT(ISODOW FROM target_cycle_start) = 1)
);

-- ── 2. Bessemeters ─────────────────────────────────────────────────────────
ALTER TABLE sites ALTER COLUMN domain DROP NOT NULL;

INSERT INTO sites (code, name, domain, languages, monday_board_id)
VALUES ('bm', 'Bessemeters', NULL, '{en}', '1764094550')
ON CONFLICT (code) DO NOTHING;

UPDATE sites SET target_cycle_weeks = 2, target_cycle_start = DATE '2026-10-12'
 WHERE code = 'bm' AND target_cycle_weeks = 1;

-- ── 3. Its English target ──────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publishing_targets
                  WHERE board_id = '1764094550' AND language = 'English' AND period_type = 'weekly') THEN
    PERFORM public.publishing_set_target('1764094550', 'BM-P', 'English', 1,
                                         'Arnaldo (approved 15 October 2026)', DATE '2026-10-12');
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
