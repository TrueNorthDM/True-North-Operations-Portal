-- 018_favorites.sql
--
-- Per-user favourites for the Home page (up to 5, enforced in the app). Stored
-- in the DB (not localStorage) so they follow the user across devices. RLS is
-- owner-only: each user reads/writes their own rows; no admin involvement.

CREATE TABLE IF NOT EXISTS favorites (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  href       TEXT NOT NULL,             -- destination route, validated against the app's catalog
  label      TEXT NOT NULL,             -- display label (denormalised from the catalog)
  position   INT  NOT NULL DEFAULT 0,   -- order within the block
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, href)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_owner ON favorites;
CREATE POLICY favorites_owner ON favorites FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
