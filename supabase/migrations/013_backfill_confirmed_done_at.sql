-- 013_backfill_confirmed_done_at.sql
--
-- One-time backfill for pages that are fully confirmed live (every site
-- language has confirmed_on_live = TRUE) but whose `confirmed_done_at` was
-- never stamped — so they show the green "✓ Done" pill yet stay stuck in the
-- On-going group with "—" in the All Live column.
--
-- Root cause: confirmed_done_at is only ever stamped by the Monday webhook /
-- manual toggle, the moment the LAST language flips live, and only if it
-- wasn't already set (see src/lib/monday/handlers.ts:271). Pages whose
-- confirmations were written in bulk during the sheet import bypassed that
-- path: the per-language confirmations exist (→ green pill, driven by the
-- `confirmations` table) but the page-level timestamp was never written
-- (→ On-going group + "—" All Live, both driven by `pages.confirmed_done_at`).
--
-- Fix: stamp confirmed_done_at = the real completion date = the latest
-- per-language `confirmed_at`. Falls back to the confirmation row's created_at,
-- then now(), so no eligible page is left unstamped when confirmed_at is null.
--
-- Idempotent + safe: only touches rows where confirmed_done_at IS NULL, skips
-- "not relevant" pages, and only stamps pages where EVERY required site
-- language is confirmed live (`live_langs @> sites.languages`).

WITH page_conf AS (
  SELECT
    page_id,
    array_agg(language_code) FILTER (WHERE confirmed_on_live) AS live_langs,
    max(confirmed_at)        FILTER (WHERE confirmed_on_live) AS max_confirmed_at,
    max(created_at)          FILTER (WHERE confirmed_on_live) AS max_created_at
  FROM confirmations
  GROUP BY page_id
)
UPDATE pages p
SET confirmed_done_at = COALESCE(pc.max_confirmed_at, pc.max_created_at, now())
FROM page_conf pc, sites s
WHERE pc.page_id = p.id
  AND s.id = p.site_id
  AND p.confirmed_done_at IS NULL
  AND p.not_relevant IS NOT TRUE
  AND pc.live_langs @> s.languages;   -- every required site language is live
