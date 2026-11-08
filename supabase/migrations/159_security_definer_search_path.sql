-- 159_security_definer_search_path.sql
--
-- Security audit (owner, 8 November 2026): the two SECURITY DEFINER functions
-- still without a fixed search_path get one. A function that runs with its
-- owner's rights and looks names up through the caller's search_path could be
-- pointed at a look-alike table or function by someone able to create objects
-- in another schema. Both functions only use tables in public, so public (then
-- pg_temp, last) is their search path. Nothing else about them changes.
-- Safe to run again.

ALTER FUNCTION public.is_admin(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_target_change() SET search_path = public, pg_temp;
