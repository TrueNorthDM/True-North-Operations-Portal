-- 073_split_my_work_surfaces.sql
--
-- My Work, Report and My Team become three grants instead of one.
--
-- They started as one row because they were one page with two tabs. Report
-- made that three views of different things: what is on my plate now, what the
-- team delivered over 90 days, and who the team is. Those are not the same
-- question and not the same audience, so they stop being the same switch.
--
-- THE ONLY DANGEROUS PART is what happens to access already configured.
-- access_level_pages holds a row only where an admin has decided something;
-- absent means "use the default". Adding two keys with no rows would hand both
-- new surfaces their defaults, which for a level that had been switched OFF
-- would silently switch it back on.
--
-- So every explicit my-work decision is copied to both new keys. After this,
-- the three rows say exactly what the one row said, and an admin changes them
-- apart from there. Nobody gains or loses anything today.

BEGIN;

INSERT INTO access_level_pages (role_type, surface_key, allowed)
SELECT role_type, 'report', allowed
FROM access_level_pages
WHERE surface_key = 'my-work'
ON CONFLICT (role_type, surface_key) DO NOTHING;

INSERT INTO access_level_pages (role_type, surface_key, allowed)
SELECT role_type, 'my-team', allowed
FROM access_level_pages
WHERE surface_key = 'my-work'
ON CONFLICT (role_type, surface_key) DO NOTHING;

COMMIT;

-- What the three now say. Expect one line per level per key, and the three
-- keys agreeing with each other until somebody changes one.
SELECT surface_key, role_type, allowed
FROM access_level_pages
WHERE surface_key IN ('my-work', 'report', 'my-team')
ORDER BY surface_key, role_type;
