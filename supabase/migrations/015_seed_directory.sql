-- 015_seed_directory.sql
--
-- Seeds the People & Teams directory from the company org chart (March 2025
-- restructure + Aug 2025 translation team). Run ONCE, after 014.
--
-- Titles + team memberships are taken straight from the chart. REPORTING LINES
-- (manager_id) are a best-effort guess where the chart didn't draw them
-- explicitly — refine them in the UI; the org chart redraws from this data.
--
-- Idempotent: only seeds when the directory is empty.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM people) THEN
    RAISE NOTICE 'people directory not empty — skipping seed';
    RETURN;
  END IF;

  -- ── People ────────────────────────────────────────────────────────────────
  INSERT INTO people (full_name, title) VALUES
    ('David Sharpe',             'Deputy Director & CISO'),
    ('Kim Wagner',               'VPM'),
    ('Rock',                     'Africa Manager'),
    ('Arnaldo Oliveira',         'VPO'),
    ('Kevin Ames',               'Special Projects'),
    ('Tina Gennette',            'Executive Assistant'),
    ('Jônatas Oliveira',         'AI & Automations Tech'),
    ('Jeannette Owens',          'SEO Team Leader'),
    ('Lauren McKinney',          'Writing Team Leader'),
    ('Amy Prindle',              'Lead Content Strategist'),
    ('Kathleen Aguilar',         'Social Media Team Leader'),
    ('Stephanie Aguirre',        'Graphics Team Leader'),
    ('Wendy Cacka',              'Web Team Leader'),
    ('Joy Deche',                'Africa Strategy & Operations / Translations Team Leader'),
    ('Devon Smith',              'Administrative Assistant'),
    ('Olivia Hale',              'Writer'),
    ('Clarisse Nixon',           'Writer'),
    ('Cheyenne Wilson',          'Writer'),
    ('Lana Hein',                'Writer'),
    ('Alyssa Summerville',       'Writer'),
    ('Saheed Fidimaye',          'Writer'),
    ('Nate Quiambao',            NULL),
    ('Jhumar Calim',             NULL),
    ('Samuel Manzi',             'Web'),
    ('Barack Owili',             NULL),
    ('Benjamin Okindo',          NULL),
    ('Hosea Otwori',             NULL),
    ('Andressa Meira',           'Translator'),
    ('Marie-Michelle Robitaille','Translator'),
    ('Yuliberth González',       'Translator'),
    ('Ashery Lwimbo',            'Translator'),
    ('Joyner Buhatwa',           'Translator'),
    ('Justus Tsofa',             'Translator');

  -- ── Reporting lines (manager_id) — best-effort, refine in the UI ───────────
  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'David Sharpe')
    WHERE full_name IN ('Kim Wagner','Rock','Arnaldo Oliveira','Kevin Ames');

  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Kim Wagner')
    WHERE full_name IN ('Jeannette Owens','Lauren McKinney','Amy Prindle','Kathleen Aguilar','Stephanie Aguirre');

  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Arnaldo Oliveira')
    WHERE full_name IN ('Tina Gennette','Jônatas Oliveira','Wendy Cacka');

  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Rock')
    WHERE full_name = 'Joy Deche';

  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Tina Gennette')
    WHERE full_name = 'Devon Smith';
  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Lauren McKinney')
    WHERE full_name IN ('Olivia Hale','Clarisse Nixon','Cheyenne Wilson','Lana Hein','Alyssa Summerville','Saheed Fidimaye');
  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Kathleen Aguilar')
    WHERE full_name IN ('Nate Quiambao','Jhumar Calim');
  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Wendy Cacka')
    WHERE full_name = 'Samuel Manzi';
  UPDATE people SET manager_id = (SELECT id FROM people WHERE full_name = 'Joy Deche')
    WHERE full_name IN ('Barack Owili','Benjamin Okindo','Hosea Otwori',
                        'Andressa Meira','Marie-Michelle Robitaille','Yuliberth González',
                        'Ashery Lwimbo','Joyner Buhatwa','Justus Tsofa');

  -- ── Teams ──────────────────────────────────────────────────────────────────
  INSERT INTO teams (name, sort_order, color) VALUES
    ('Administrative Assistants', 1, '#9CA3AF'),
    ('SEO Strategists',           2, '#F4C24A'),
    ('Writers',                   3, '#86C06A'),
    ('Philippines Team',          4, '#C58FB0'),
    ('Web Team',                  5, '#A99BD4'),
    ('Africa Team',               6, '#F0A35E'),
    ('Translation Team',          7, '#F0A35E');

  UPDATE teams SET leader_person_id = (SELECT id FROM people WHERE full_name = 'Tina Gennette')    WHERE name = 'Administrative Assistants';
  UPDATE teams SET leader_person_id = (SELECT id FROM people WHERE full_name = 'Jeannette Owens')  WHERE name = 'SEO Strategists';
  UPDATE teams SET leader_person_id = (SELECT id FROM people WHERE full_name = 'Lauren McKinney')  WHERE name = 'Writers';
  UPDATE teams SET leader_person_id = (SELECT id FROM people WHERE full_name = 'Wendy Cacka')      WHERE name = 'Web Team';
  UPDATE teams SET leader_person_id = (SELECT id FROM people WHERE full_name = 'Joy Deche')        WHERE name IN ('Africa Team','Translation Team');

  -- ── Team membership (many-to-many) ─────────────────────────────────────────
  INSERT INTO team_members (team_id, person_id)
  SELECT t.id, p.id FROM teams t JOIN people p ON TRUE
  WHERE (t.name = 'Administrative Assistants' AND p.full_name IN ('Devon Smith'))
     OR (t.name = 'SEO Strategists'           AND p.full_name IN ('Kathleen Aguilar','Stephanie Aguirre','Kevin Ames'))
     OR (t.name = 'Writers'                   AND p.full_name IN ('Olivia Hale','Clarisse Nixon','Cheyenne Wilson','Lana Hein','Alyssa Summerville','Saheed Fidimaye'))
     OR (t.name = 'Philippines Team'          AND p.full_name IN ('Nate Quiambao','Jhumar Calim'))
     OR (t.name = 'Web Team'                  AND p.full_name IN ('Samuel Manzi'))
     OR (t.name = 'Africa Team'               AND p.full_name IN ('Barack Owili','Benjamin Okindo','Hosea Otwori'))
     OR (t.name = 'Translation Team'          AND p.full_name IN ('Andressa Meira','Marie-Michelle Robitaille','Yuliberth González','Ashery Lwimbo','Joyner Buhatwa','Justus Tsofa','Jônatas Oliveira'));

END $$;
