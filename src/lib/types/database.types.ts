/**
 * TypeScript types that mirror the Supabase schema.
 * Keep in sync with supabase/migrations/001_initial_schema.sql
 *
 * NOTE: Row types are plain `type` aliases (not `interface`) so they satisfy
 * `Record<string, unknown>` in conditional types. Interfaces without an
 * explicit index signature do NOT extend `Record<string, unknown>`, which
 * causes Supabase's `GenericTable` constraint to fail and query results to
 * resolve to `never`.
 */

export type SiteCode = 'aaaf' | 'hfa'
export type LanguageCode = 'en' | 'pt' | 'es' | 'sw'

// ── Row types (what comes back from SELECT) ──────────────────

export type SiteRow = {
  id: string
  code: SiteCode
  name: string
  domain: string
  languages: LanguageCode[]
  language_paths: Record<LanguageCode, string>
  monday_board_id: string | null
  monday_column_ids: Record<string, unknown> | null
  wp_dev_url: string | null
  wp_live_url: string | null
  created_at: string
}

export type MondayStatus = 'pending' | 'in_progress' | 'done'

export type PageRow = {
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

export type PageUrlRow = {
  id: string
  page_id: string
  language_code: LanguageCode
  url: string
  monday_item_id: string | null
  created_at: string
  updated_at: string
}

export type ConfirmationRow = {
  id: string
  page_id: string
  language_code: LanguageCode
  confirmed_on_live: boolean
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

// ── Composite types (joins used in the UI) ───────────────────

export type PageWithUrls = PageRow & {
  site: SiteRow
  urls: PageUrlRow[]
  confirmations: ConfirmationRow[]
}

// ── Database type (used by createBrowserClient / createServerClient) ─
//
// Each table requires a `Relationships` array to satisfy GenericTable in
// @supabase/postgrest-js. Without it the SDK returns `never` for every
// query result, even plain selects with no joins.

export type Database = {
  public: {
    Tables: {
      sites: {
        Row: SiteRow
        Insert: Omit<SiteRow, 'id' | 'created_at'>
        Update: Partial<Omit<SiteRow, 'id' | 'created_at'>>
        Relationships: []
      }
      pages: {
        Row: PageRow
        Insert: Omit<PageRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PageRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'pages_site_id_fkey'
            columns: ['site_id']
            isOneToOne: false
            referencedRelation: 'sites'
            referencedColumns: ['id']
          },
        ]
      }
      page_urls: {
        Row: PageUrlRow
        Insert: Omit<PageUrlRow, 'id' | 'created_at' | 'updated_at' | 'monday_item_id'> & { monday_item_id?: string | null }
        Update: Partial<Omit<PageUrlRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'page_urls_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      confirmations: {
        Row: ConfirmationRow
        Insert: Omit<ConfirmationRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ConfirmationRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'confirmations_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
        ]
      }
      app_settings: {
        Row: { singleton_id: number; monday_api_token: string | null; updated_at: string }
        Insert: { singleton_id?: number; monday_api_token?: string | null; updated_at?: string }
        Update: { monday_api_token?: string | null; updated_at?: string }
        Relationships: []
      }
      monday_events: {
        Row: { id: string; board_id: string; received_at: string; monday_item_id: string | null; result: string | null }
        Insert: { id?: string; board_id: string; received_at?: string; monday_item_id?: string | null; result?: string | null }
        Update: { result?: string | null }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
