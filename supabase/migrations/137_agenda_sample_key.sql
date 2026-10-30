-- The staging seed upserts sample events by sample_key (ON CONFLICT
-- (sample_key)), which needs a plain unique index: the partial one from 136
-- does not match it. A plain unique index still allows any number of NULLs.

BEGIN;
DROP INDEX IF EXISTS agenda_events_sample_key;
CREATE UNIQUE INDEX IF NOT EXISTS agenda_events_sample_key ON agenda_events (sample_key);
COMMIT;
