-- 090_two_step.sql
--
-- Two-step sign-in (migration plan, step p4-2fa). The second step itself is
-- Supabase's own MFA (TOTP, an authenticator app); this adds what the portal
-- needs around it to decide when the step becomes required.
--
-- The rule, decided on 28 September 2026: everyone gets one week to set it up.
--   * People whose account is created after two-step sign-in ships
--     (two_step_launch): a week from their first sign-in.
--   * People who already had an account: a week from the cutoff
--     (two_step_cutoff), set once the move to the new server is finished (plan
--     step p7-2fa-cutoff). Until it is set they are not required to.
-- Anyone who has set it up is asked for the code at every sign-in, whatever
-- the dates say.
--
-- Read by src/lib/auth/two-step.ts (the page gate) and the Directory.

BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_settings (
  key        text PRIMARY KEY,
  value      timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No policies: only the service role reads or writes these.
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.portal_settings (key, value) VALUES ('two_step_launch', now())
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.portal_settings (key, value) VALUES ('two_step_cutoff', NULL)
ON CONFLICT (key) DO NOTHING;

-- Per account: when it was created (its first sign-in) and since when it has a
-- verified second step, with the two dates of the rule alongside. One call for
-- one person (p_user) or everyone (NULL).
CREATE OR REPLACE FUNCTION public.portal_two_step_status(p_user uuid DEFAULT NULL)
RETURNS TABLE (user_id uuid, account_created timestamptz, factor_since timestamptz, launch timestamptz, cutoff timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
         u.created_at,
         (SELECT min(f.created_at) FROM auth.mfa_factors f
           WHERE f.user_id = u.id AND f.status = 'verified'),
         (SELECT value FROM public.portal_settings WHERE key = 'two_step_launch'),
         (SELECT value FROM public.portal_settings WHERE key = 'two_step_cutoff')
    FROM auth.users u
   WHERE p_user IS NULL OR u.id = p_user;
$$;

REVOKE ALL ON FUNCTION public.portal_two_step_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_two_step_status(uuid) TO service_role;

COMMIT;
