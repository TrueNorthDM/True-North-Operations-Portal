-- 034_person_monday_docs.sql
--
-- The True North Team board's "History" column holds a rich **Monday Doc** per
-- person (a native document — manager description, tools, meeting list…), NOT a
-- downloadable file. So instead of a Storage attachment, we keep the doc's text
-- directly on the person as `monday_docs`; the importer pulls each doc's content
-- (as markdown) into it, and the Directory shows it in a "Monday Docs" section.
--
-- (The person_attachments table + person-files bucket from 033 stay — they're
-- for real file uploads done in-portal, which these docs are not.)

BEGIN;

ALTER TABLE people ADD COLUMN IF NOT EXISTS monday_docs text;

COMMIT;
