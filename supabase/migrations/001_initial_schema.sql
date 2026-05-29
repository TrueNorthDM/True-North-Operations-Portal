-- ============================================================
-- True North Href Links — Initial Schema
-- ============================================================

-- Sites: AAAF and HFA configurations
CREATE TABLE sites (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,         -- 'aaaf' | 'hfa'
  name        TEXT    NOT NULL,                -- display name
  domain      TEXT    NOT NULL,                -- base domain (no trailing slash)
  languages   TEXT[]  NOT NULL,               -- ordered list: ['en','pt','es','sw']
  -- Maps language code to the URL path prefix used by this site.
  -- e.g. AAAF: {"en":"","pt":"pt","es":"es","sw":"sw"}
  --      HFA:  {"en":"en","sw":"sw"}
  language_paths JSONB NOT NULL DEFAULT '{}',
  monday_board_id TEXT,                        -- Monday.com board ID for sync
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pages: one row per page per site
CREATE TABLE pages (
  id               UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id          UUID  NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name             TEXT  NOT NULL,             -- human-readable page name
  monday_item_id   TEXT,                       -- Monday.com item ID
  monday_item_name TEXT,                       -- Monday.com item label (may differ)
  -- cluster and primary_keyword are HFA-specific but stored here for simplicity
  cluster          TEXT,
  primary_keyword  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, monday_item_id)
);

-- Page URLs: one row per language per page
CREATE TABLE page_urls (
  id            UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id       UUID  NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  language_code TEXT  NOT NULL,               -- 'en' | 'pt' | 'es' | 'sw'
  url           TEXT  NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, language_code)
);

-- Confirmations: tracks live + GSC status per language per page
CREATE TABLE confirmations (
  id                 UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id            UUID  NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  language_code      TEXT  NOT NULL,
  confirmed_on_live  BOOLEAN     DEFAULT FALSE,
  confirmed_at       TIMESTAMPTZ,
  indexed_in_gsc     BOOLEAN     DEFAULT FALSE,   -- HFA only
  gsc_confirmed_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, language_code)
);

-- ============================================================
-- Seed: site configurations
-- ============================================================

INSERT INTO sites (code, name, domain, languages, language_paths, monday_board_id) VALUES
(
  'aaaf',
  'Ask An Adventist Friend',
  'https://www.askanadventistfriend.com',
  ARRAY['en','pt','es','sw'],
  '{"en":"","pt":"pt","es":"es","sw":"sw"}',
  NULL  -- add Monday board ID when available
),
(
  'hfa',
  'Hope For Africa',
  'https://www.hopefor.africa',
  ARRAY['en','sw'],
  '{"en":"en","sw":"sw"}',
  NULL  -- add Monday board ID when available
);

-- ============================================================
-- Helper: auto-update updated_at on row changes
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER page_urls_updated_at
  BEFORE UPDATE ON page_urls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER confirmations_updated_at
  BEFORE UPDATE ON confirmations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
