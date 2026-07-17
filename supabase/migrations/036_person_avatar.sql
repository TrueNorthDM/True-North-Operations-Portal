-- 036_person_avatar.sql
--
-- Profile photos. people.avatar_url holds the public URL of the person's avatar,
-- stored in a public `avatars` bucket (low-sensitivity, shown everywhere — the
-- top bar, the Directory, person cards). Uploads go through a scoped server
-- action (service role) that only ever writes the signed-in user's own avatar,
-- so no session-write policy is needed; public read is implied by public = true.

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

COMMIT;
