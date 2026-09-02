-- 078_person_break_even_rate.sql
--
-- The break-even rate, one figure per person.
--
-- A third rate, and the three are genuinely different questions:
--   tr_assignments.hourly_rate  what a client is billed for an hour
--   people.internal_rate        what the hour costs us
--   people.be_rate              what the hour has to earn to break even
--
-- The last one carries the overhead a person does not see on their own payslip,
-- which is why it is higher than the cost rate and why it cannot be derived
-- from it here.
--
-- These are the 2026 figures, from the finance workbook of August 2026. They
-- are stored WITHOUT a year, which is a debt worth naming: when 2027 figures
-- arrive and somebody overwrites this column, every 2026 cost the reports have
-- already shown will quietly recompute with the new number. The fix, when it
-- matters, is a dated table like tr_assignments rather than a column.
--
-- Matched on a surname fragment rather than the full name. The workbook spells
-- three of them differently from the directory (Oliviera, Noehimi, and
-- "Teixeira De Queiroz" for the person the portal calls Jônatas Queiroz), and a
-- first-name match would be one collision away from putting somebody else's
-- rate on somebody's row.
--
-- A fragment is a substring, so it collides too: on the first run 'Manzi' found
-- Samuel Manzi and also Rafiki Mureramanzi, who has left. The `hits = 1` guard
-- caught it and wrote neither, which is the whole reason it is there. Both
-- narrowings below exist because of that one row: active people only, and still
-- only where exactly one of them matches.

ALTER TABLE people ADD COLUMN IF NOT EXISTS be_rate NUMERIC(8,2);

COMMENT ON COLUMN people.be_rate IS
  'Break-even rate, USD per hour. The 2026 figures, loaded from the finance workbook. Not what the hour costs (internal_rate) and not what a client pays (tr_assignments).';

-- Only where the fragment identifies exactly one person. A fragment that
-- matches two would otherwise write a rate onto a stranger, and there is
-- nothing on the screen afterwards that would look wrong.
WITH src(frag, rate) AS (
  VALUES
    ('Sommerville', 57.40)   -- Alyssa Sommerville, Writers, employee,
    ('Prindle', 69.36)   -- Amy Prindle, Writers, employee,
    ('Wilson', 60.39)   -- Cheyenne Wilson, Writers, employee,
    ('Nixon', 65.90)   -- Clarise Nixon, Writers, employee,
    ('Sharpe', 85.73)   -- David Sharpe, Admin, employee,
    ('Owens', 73.81)   -- Jeannette Owens, SEO, employee,
    ('Aguilar', 62.25)   -- Kathleen Aguilar, SEO, employee,
    ('Ames', 77.77)   -- Kevin Ames, Special Projects, employee,
    ('Hein', 59.12)   -- Lana Hein, Writers, employee,
    ('Hale', 62.60)   -- Olivia Hale, Writers, employee,
    ('Gennette', 60.00)   -- Tina Gennette, Admin, employee,
    ('Cacka', 69.14)   -- Wendy Cacka, Web, employee,
    ('Oliveira', 73.19)   -- Arnaldo Oliveira, Admin, contractor,
    ('Lwimbo', 31.53)   -- Ashery Lwimbo, Translator, contractor,
    ('Owili', 32.16)   -- Barack Owili, Writer, contractor,
    ('Okindo', 31.79)   -- Benjamin Okindo, Admin, contractor,
    ('Moturi', 30.36)   -- Hosea Moturi, Writer, contractor,
    ('Queiroz', 38.81)   -- Jonatas Queiroz, Admin, contractor,
    ('Buhatwa', 31.53)   -- Joyner Buhatwa, Translator, contractor,
    ('Tsofa', 31.53)   -- Justus Tsofa, Writer, contractor,
    ('Belandria', 44.01)   -- Noehimi Belandria, Graphics, contractor,
    ('Kai', 35.76)   -- Rock Kai, Admin, contractor,
    ('Fidimaye', 31.28)   -- Saheed Fidimaye, Writer, contractor,
    ('Manzi', 32.00)   -- Samuel Manzi, Web, contractor,
    ('Aguirre', 56.90)   -- Stephanie Aguirre, Graphics, contractor
),
m AS (
  SELECT s.frag, s.rate, p.id, count(*) OVER (PARTITION BY s.frag) AS hits
  FROM src s
  -- Active only. Every name in the workbook is current staff, and a leaver can
  -- carry a surname that contains somebody else's: 'Manzi' reaches both Samuel
  -- Manzi and Rafiki Mureramanzi, who left.
  JOIN people p ON p.full_name ILIKE '%' || s.frag || '%' AND p.status = 'active'
)
UPDATE people p SET be_rate = m.rate
FROM m
WHERE m.id = p.id AND m.hits = 1;

-- ── The column grant, or this leaks ─────────────────────────────────────────
--
-- Migration 054 revoked SELECT on people and re-granted a list of columns built
-- from information_schema, excluding the pay ones. A column added afterwards is
-- not in that list, so it fails closed, which is the right default and is also
-- exactly how a screen goes blank: PostgREST drops the whole query on a column
-- permission error.
--
-- be_rate belongs with the pay columns. It is what an hour has to earn to cover
-- somebody, which is a salary read through one division. Recomputing the list
-- with it excluded is what 054 asks the next person to do.

DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'people'
     AND column_name NOT IN ('internal_rate', 'monthly_salary', 'be_rate');

  EXECUTE 'REVOKE SELECT ON public.people FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.people TO authenticated', cols);
END $$;

-- ── Check before trusting it ────────────────────────────────────────────────

-- 1. How many landed. Expect 25.
SELECT count(*) AS people_with_be_rate FROM people WHERE be_rate IS NOT NULL;

-- 2. Anybody the workbook names that the directory does not, or names twice.
WITH src(frag, rate) AS (
  VALUES
    ('Sommerville', 57.40)   -- Alyssa Sommerville, Writers, employee,
    ('Prindle', 69.36)   -- Amy Prindle, Writers, employee,
    ('Wilson', 60.39)   -- Cheyenne Wilson, Writers, employee,
    ('Nixon', 65.90)   -- Clarise Nixon, Writers, employee,
    ('Sharpe', 85.73)   -- David Sharpe, Admin, employee,
    ('Owens', 73.81)   -- Jeannette Owens, SEO, employee,
    ('Aguilar', 62.25)   -- Kathleen Aguilar, SEO, employee,
    ('Ames', 77.77)   -- Kevin Ames, Special Projects, employee,
    ('Hein', 59.12)   -- Lana Hein, Writers, employee,
    ('Hale', 62.60)   -- Olivia Hale, Writers, employee,
    ('Gennette', 60.00)   -- Tina Gennette, Admin, employee,
    ('Cacka', 69.14)   -- Wendy Cacka, Web, employee,
    ('Oliveira', 73.19)   -- Arnaldo Oliveira, Admin, contractor,
    ('Lwimbo', 31.53)   -- Ashery Lwimbo, Translator, contractor,
    ('Owili', 32.16)   -- Barack Owili, Writer, contractor,
    ('Okindo', 31.79)   -- Benjamin Okindo, Admin, contractor,
    ('Moturi', 30.36)   -- Hosea Moturi, Writer, contractor,
    ('Queiroz', 38.81)   -- Jonatas Queiroz, Admin, contractor,
    ('Buhatwa', 31.53)   -- Joyner Buhatwa, Translator, contractor,
    ('Tsofa', 31.53)   -- Justus Tsofa, Writer, contractor,
    ('Belandria', 44.01)   -- Noehimi Belandria, Graphics, contractor,
    ('Kai', 35.76)   -- Rock Kai, Admin, contractor,
    ('Fidimaye', 31.28)   -- Saheed Fidimaye, Writer, contractor,
    ('Manzi', 32.00)   -- Samuel Manzi, Web, contractor,
    ('Aguirre', 56.90)   -- Stephanie Aguirre, Graphics, contractor
)
SELECT s.frag,
       count(p.id) AS matches,
       CASE WHEN count(p.id) = 0 THEN 'nobody' ELSE 'more than one' END AS problem
FROM src s
LEFT JOIN people p ON p.full_name ILIKE '%' || s.frag || '%' AND p.status = 'active'
GROUP BY s.frag
HAVING count(p.id) <> 1
ORDER BY s.frag;
