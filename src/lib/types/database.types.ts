/**
 * TypeScript types that mirror the Supabase schema.
 * Keep in sync with supabase/migrations/001_initial_schema.sql
 */

export type SiteCode = 'aaaf' | 'hfa'
export type LanguageCode = 'en' | 'pt' | 'es' | 'sw'

// ── Row types (what comes back from SELECT) ──────────────────

export interface SiteRow {
  id: string
  code: SiteCode
  name: string
  domain: string
  languages: LanguageCode[]
  language_paths: Record<LanguageCode, string>
  monday_board_id: string | null
  created_at: string
}

export type MondayStatus = 'pending' | 'in_progress' | 'done'

export interface PageRow {
  id: string
  site_id: string
  name: string
  monday_item_id: string | null
  monday_item_name: string | null
  /** True when the site's language config changed after this page was last updated. */
  needs_hreflang_update: boolean
  /** Intentional opt-out: pages with not_relevant=true count as done in progress. */
  not_relevant: boolean
  /** Overall Monday implementation status (will be updated by Monday API once integrated). */
  monday_status: MondayStatus
  /** Per-language Monday status — keys are language codes, values are booleans (true = done in Monday). */
  monday_lang_status: Record<string, boolean>
  /** ISO timestamp set the first time all languages were confirmed live. Preserved on un-toggle. */
  confirmed_done_at: string | null
  created_at: string
  updated_at: string
}

export interface PageUrlRow {
  id: string
  page_id: string
  language_code: LanguageCode
  url: string
  created_at: string
  updated_at: string
}

export interface ConfirmationRow {
  id: string
  page_id: string
  language_code: LanguageCode
  confirmed_on_live: boolean
  confirmed_at: string | null
  indexed_in_gsc: boolean
  gsc_confirmed_at: string | null
  created_at: string
  updated_at: string
}

// ── Composite types (joins used in the UI) ───────────────────

export interface PageWithUrls extends PageRow {
  site: SiteRow
  urls: PageUrlRow[]
  confirmations: ConfirmationRow[]
}

// ── Database type (used by createBrowserClient / createServerClient) ─

export type Database = {
  public: {
    Tables: {
      sites: {
        Row: SiteRow
        Insert: Omit<SiteRow, 'id' | 'created_at'>
        Update: Partial<Omit<SiteRow, 'id' | 'created_at'>>
      }
      pages: {
        Row: PageRow
        Insert: Omit<PageRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PageRow, 'id' | 'created_at' | 'updated_at'>>
      }
      page_urls: {
        Row: PageUrlRow
        Insert: Omit<PageUrlRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PageUrlRow, 'id' | 'created_at' | 'updated_at'>>
      }
      confirmations: {
        Row: ConfirmationRow
        Insert: Omit<ConfirmationRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ConfirmationRow, 'id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
