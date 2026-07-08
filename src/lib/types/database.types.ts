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

// ── Boards Review tables (merged from the COE Dashboard) ─────

export type Role = 'admin' | 'viewer'

export type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  created_at: string
  updated_at: string
}

export type PublishingTargetRow = {
  id: string
  board_id: string
  board_short: string | null
  language: string
  target_value: number
  period_type: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type AuditLogRow = {
  id: string
  user_email: string | null
  action: 'insert' | 'update' | 'delete'
  entity_id: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
}

// People & Teams directory (migration 014); tsheets_user_id / tsheets_only
// added in migration 020 to link a person to their TSheets/QuickBooks Time
// user for the Time Report tool.
export type PersonRow = {
  id: string
  full_name: string
  title: string | null
  manager_id: string | null
  profile_id: string | null
  status: 'active' | 'inactive'
  sort_order: number
  tsheets_user_id: number | null
  tsheets_only: boolean
  created_at: string
  updated_at: string
}

export type TeamRow = {
  id: string
  name: string
  leader_person_id: string | null
  color: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type TeamMemberRow = {
  team_id: string
  person_id: string
  created_at: string
}

// Time Report settings (migration 021) — job codes cached from TSheets,
// treated as clients/projects.
export type TrClientRow = {
  id: number
  tsheets_jobcode_id: number
  name: string
  active: boolean
  parent_id: number | null   // TSheets parent jobcode id; NULL = top-level client
  created_at: string
}

// One budget per client per period; creating a new one closes the previous.
export type TrBudgetRow = {
  id: number
  client_id: number
  hours_allocated: number | null
  budget_amount: number | null
  extra_budget: number
  start_date: string                    // base budget start (required)
  budget_end_date: string | null        // base budget end (null = ongoing)
  extra_start_date: string | null       // extra budget start (set when extra > 0)
  extra_end_date: string | null         // extra budget end (null = ongoing)
  end_date: string | null               // internal supersession marker
  justification: string
  created_by: string | null
  created_at: string
}

// Person x client rate history; closing the old row + inserting a new one
// preserves history for past reports.
export type TrAssignmentRow = {
  id: number
  tsheets_user_id: number
  client_id: number
  hourly_rate: number
  active: boolean
  effective_from: string
  effective_to: string | null
  justification: string
  created_by: string | null
  created_at: string
}

// i7 monthly $ budget (base + extra) — the bank-account ledger's inflows.
export type I7MonthlyBudgetRow = {
  id: number
  month: string
  budget_amount: number
  extra_amount: number
  justification: string
  created_by: string | null
  created_at: string
}

// Per-project budgeted HOURS (a guide under the client-level $ budget).
export type TrProjectBudgetRow = {
  id: number
  client_id: number
  project: string
  hours_allocated: number
  effective_from: string
  effective_to: string | null
  justification: string
  created_by: string | null
  created_at: string
}

// Immutable audit trail for every change to tr_budgets / tr_assignments.
export type TrAuditLogRow = {
  id: number
  entity_type: string
  entity_id: number
  action: string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown>
  justification: string
  changed_by: string | null
  changed_at: string
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
        Row: { singleton_id: number; monday_api_token: string | null; tsheets_api_token: string | null; tsheets_synced_at: string | null; updated_at: string }
        Insert: { singleton_id?: number; monday_api_token?: string | null; tsheets_api_token?: string | null; tsheets_synced_at?: string | null; updated_at?: string }
        Update: { monday_api_token?: string | null; tsheets_api_token?: string | null; tsheets_synced_at?: string | null; updated_at?: string }
        Relationships: []
      }
      monday_events: {
        Row: { id: string; board_id: string; received_at: string; monday_item_id: string | null; result: string | null }
        Insert: { id?: string; board_id: string; received_at?: string; monday_item_id?: string | null; result?: string | null }
        Update: { result?: string | null }
        Relationships: []
      }
      profiles: {
        Row: ProfileRow
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
        Update: Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      publishing_targets: {
        Row: PublishingTargetRow
        Insert: Omit<PublishingTargetRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<PublishingTargetRow, 'id' | 'created_at'>>
        Relationships: []
      }
      audit_log: {
        Row: AuditLogRow
        Insert: Omit<AuditLogRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<AuditLogRow, 'id' | 'created_at'>>
        Relationships: []
      }
      people: {
        Row: PersonRow
        Insert: Partial<Omit<PersonRow, 'id' | 'created_at' | 'updated_at'>> & { full_name: string }
        Update: Partial<Omit<PersonRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: [
          {
            foreignKeyName: 'people_manager_id_fkey'
            columns: ['manager_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          },
        ]
      }
      teams: {
        Row: TeamRow
        // Only `name` is required at insert; the rest have DB defaults / are nullable.
        Insert: Partial<Omit<TeamRow, 'id' | 'created_at' | 'updated_at'>> & { name: string }
        Update: Partial<Omit<TeamRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      team_members: {
        Row: TeamMemberRow
        Insert: Omit<TeamMemberRow, 'created_at'> & { created_at?: string }
        Update: Partial<TeamMemberRow>
        Relationships: []
      }
      // Access grants (migration 014). One role per subject per project.
      grants: {
        Row: { id: string; subject_type: 'team' | 'person'; subject_id: string; project_id: string; role: 'admin' | 'member' | 'viewer'; created_at: string; updated_at: string }
        Insert: { id?: string; subject_type: 'team' | 'person'; subject_id: string; project_id: string; role: 'admin' | 'member' | 'viewer'; created_at?: string; updated_at?: string }
        Update: Partial<{ subject_type: 'team' | 'person'; subject_id: string; project_id: string; role: 'admin' | 'member' | 'viewer' }>
        Relationships: []
      }
      tr_clients: {
        Row: TrClientRow
        Insert: Omit<TrClientRow, 'id' | 'created_at' | 'parent_id'> & { id?: number; created_at?: string; parent_id?: number | null }
        Update: Partial<Omit<TrClientRow, 'id' | 'created_at'>>
        Relationships: []
      }
      tr_budgets: {
        Row: TrBudgetRow
        Insert: Omit<TrBudgetRow, 'id' | 'budget_end_date' | 'extra_start_date' | 'extra_end_date' | 'end_date' | 'created_at' | 'created_by'> & {
          id?: number
          budget_end_date?: string | null
          extra_start_date?: string | null
          extra_end_date?: string | null
          end_date?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Omit<TrBudgetRow, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'tr_budgets_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'tr_clients'
            referencedColumns: ['id']
          },
        ]
      }
      tr_assignments: {
        Row: TrAssignmentRow
        Insert: Omit<TrAssignmentRow, 'id' | 'effective_to' | 'created_at' | 'created_by'> & {
          id?: number
          effective_to?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Omit<TrAssignmentRow, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'tr_assignments_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'tr_clients'
            referencedColumns: ['id']
          },
        ]
      }
      i7_monthly_budget: {
        Row: I7MonthlyBudgetRow
        Insert: Omit<I7MonthlyBudgetRow, 'id' | 'created_at' | 'created_by'> & {
          id?: number
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Omit<I7MonthlyBudgetRow, 'id' | 'created_at'>>
        Relationships: []
      }
      tr_project_budgets: {
        Row: TrProjectBudgetRow
        Insert: Omit<TrProjectBudgetRow, 'id' | 'effective_to' | 'created_at' | 'created_by'> & {
          id?: number
          effective_to?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Omit<TrProjectBudgetRow, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'tr_project_budgets_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'tr_clients'
            referencedColumns: ['id']
          },
        ]
      }
      tr_audit_log: {
        Row: TrAuditLogRow
        Insert: Omit<TrAuditLogRow, 'id' | 'changed_at' | 'changed_by'> & {
          id?: number
          changed_at?: string
          changed_by?: string | null
        }
        Update: Partial<Omit<TrAuditLogRow, 'id' | 'changed_at'>>
        Relationships: []
      }
      tsheets_timesheets: {
        Row: { id: number; user_id: number; jobcode_id: number; duration: number; date: string; i7_code: string | null; activity: string | null; synced_at: string }
        Insert: { id: number; user_id: number; jobcode_id: number; duration: number; date: string; i7_code?: string | null; activity?: string | null; synced_at?: string }
        Update: Partial<{ id: number; user_id: number; jobcode_id: number; duration: number; date: string; i7_code: string | null; activity: string | null; synced_at: string }>
        Relationships: []
      }
      i7_project_month_hours: {
        Row: { id: number; client_id: number; project: string; month: string; hours_allocated: number; justification: string; created_by: string | null; created_at: string }
        Insert: { id?: number; client_id: number; project: string; month: string; hours_allocated: number; justification: string; created_by?: string | null; created_at?: string }
        Update: Partial<{ id: number; client_id: number; project: string; month: string; hours_allocated: number; justification: string; created_by: string | null; created_at: string }>
        Relationships: []
      }
      i7_report_notes: {
        Row: { month: string; note: string; updated_by: string | null; updated_at: string }
        Insert: { month: string; note?: string; updated_by?: string | null; updated_at?: string }
        Update: Partial<{ month: string; note: string; updated_by: string | null; updated_at: string }>
        Relationships: []
      }
      // Per-user Home favourites (migration 018). RLS: owner-only.
      favorites: {
        Row: { profile_id: string; href: string; label: string; position: number; created_at: string }
        Insert: { profile_id: string; href: string; label: string; position?: number; created_at?: string }
        Update: Partial<{ profile_id: string; href: string; label: string; position: number; created_at: string }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      // accessible_site_ids(uid) — SECURITY DEFINER helper (migration 016).
      // Returns the set of project (site) ids the user can reach.
      accessible_site_ids: {
        Args: { uid: string }
        Returns: { site_id: string }[]
      }
    }
    Enums: Record<string, never>
  }
}
