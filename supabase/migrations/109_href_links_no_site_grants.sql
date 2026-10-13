-- 109_href_links_no_site_grants.sql
--
-- Href Links: both sites are open to everyone with the tool (decided by
-- Arnaldo, 13 October 2026). Which teams have Href Links, the whole team or
-- only its Leads, is set on the tool in Admin > Access levels, like every
-- other tool; there is no per-site list on top.
--
-- 1. The one per-site grant goes: team Admin Assistants, editor, on AAAF.
--    It was the only row, so AAAF opened to that team and admins alone.
-- 2. accessible_site_ids() goes: the portal no longer calls it.
--
-- The grants table stays, empty: merge_people() still moves a person's rows
-- in it, and nothing reads it any more.

BEGIN;

DELETE FROM grants;

DROP FUNCTION IF EXISTS public.accessible_site_ids(uuid);

COMMIT;

NOTIFY pgrst, 'reload schema';
