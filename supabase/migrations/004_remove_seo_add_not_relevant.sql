-- Drop the HFA SEO metadata feature entirely.
-- The fields are no longer used in the workflow — keeping them around just
-- creates schema noise and surprises future code. Dropping with CASCADE so
-- any default/check constraint goes with them.
ALTER TABLE pages DROP COLUMN IF EXISTS cluster;
ALTER TABLE pages DROP COLUMN IF EXISTS primary_keyword;
ALTER TABLE pages DROP COLUMN IF EXISTS tracked;
ALTER TABLE pages DROP COLUMN IF EXISTS secondary_keyphrases;

-- Add the "not relevant" flag.
-- Pages marked not_relevant are intentionally excluded from the workflow
-- (e.g. legacy pages we're not going to translate). They count as DONE
-- for the project's progress bar so the team's effort isn't artificially
-- diluted by pages that were never going to ship.
ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS not_relevant BOOLEAN NOT NULL DEFAULT FALSE;

-- Quick sanity check
SELECT
  (SELECT COUNT(*) FROM pages) AS total_pages,
  (SELECT COUNT(*) FROM pages WHERE not_relevant) AS not_relevant_count;
