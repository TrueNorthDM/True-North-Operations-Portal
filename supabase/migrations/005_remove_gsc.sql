-- 005_remove_gsc.sql
-- Removes the "Indexed in GSC" (Google Search Console) tracking from the
-- confirmations table. The feature was dropped from both AAAF and HFA — no
-- application code references these columns as of this migration.
--
-- DESTRUCTIVE: drops the columns and any data they held. Irreversible.
-- Apply ONLY after the code that stops selecting these columns is deployed,
-- otherwise the live PostgREST `.select(...indexed_in_gsc)` queries will error.

ALTER TABLE confirmations
  DROP COLUMN IF EXISTS indexed_in_gsc,
  DROP COLUMN IF EXISTS gsc_confirmed_at;
