-- pages.(site_id, name) as unique key.
--
-- We agreed in the Monday integration design discussion that page name
-- (exact match) is the grouping key across the N sibling items (one per
-- language) on Monday. The Run Link webhook handler uses ON CONFLICT
-- (site_id, name) to upsert pages — that requires a unique constraint.
--
-- The original schema had UNIQUE(site_id, monday_item_id), which doesn't
-- fit anymore: each language is a separate Monday item, so site+item is
-- per-language, not per-page.

ALTER TABLE pages
  ADD CONSTRAINT pages_site_id_name_uniq UNIQUE (site_id, name);
