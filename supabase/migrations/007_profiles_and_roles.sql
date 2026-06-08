-- Profiles + role-based access (admin / viewer).
--
-- Brought in from the COE Dashboard's admin system as part of the merge.
-- The portal previously had no role concept — every authenticated user was
-- equal. This adds an admin/viewer distinction, used (for now) to gate editing
-- of publishing targets in the Boards Review section.
--
-- Idempotent: safe to run against a project whose exact state isn't fully
-- captured in this migrations folder (some of the portal's schema was created
-- via the Supabase dashboard).

BEGIN;

-- One row per auth user, linking to a role.
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh — reuses the portal's existing helper from 001
-- (update_updated_at), instead of the COE's separate touch_updated_at().
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- is_admin(uuid): used by RLS policies on other tables. SECURITY DEFINER so it
-- reads profiles without tripping that table's own RLS (avoids recursion).
CREATE OR REPLACE FUNCTION is_admin(uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = uid AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- On new auth user: create their profile and auto-promote the named admin.
-- Mirrors the COE behavior (arnaldo.oliveira@me.com is the primary admin).
-- NOTE: arnaldo.oliveira@me.com can only sign up once the email-domain gate
-- allows that address (see the Step 6 / enforce_email_domain migration);
-- until then this trigger simply never fires for him.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email = 'arnaldo.oliveira@me.com' THEN 'admin' ELSE 'viewer' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill: give existing auth users a profile, and ensure the named admin is
-- promoted even if they signed up before this migration.
INSERT INTO profiles (id, email, role)
SELECT u.id, u.email,
       CASE WHEN u.email = 'arnaldo.oliveira@me.com' THEN 'admin' ELSE 'viewer' END
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

UPDATE profiles SET role = 'admin' WHERE email = 'arnaldo.oliveira@me.com';

-- RLS: a user reads their own profile; admins read all; only admins write.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_self_or_admin ON profiles;
CREATE POLICY profiles_select_self_or_admin
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin(auth.uid()));

DROP POLICY IF EXISTS profiles_admin_write ON profiles;
CREATE POLICY profiles_admin_write
  ON profiles FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

COMMIT;
