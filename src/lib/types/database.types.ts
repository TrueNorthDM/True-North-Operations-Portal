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

import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'

export type SiteCode = 'aaaf' | 'hfa'
export type LanguageCode = 'en' | 'pt' | 'es' | 'sw'

// ── Row types (what comes back from SELECT) ──────────────────

export type SiteRow = {
  id: string
  code: SiteCode
  name: string
  domain: string
  languages: LanguageCode[]
  paused_languages: LanguageCode[]
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
  // Directory person fields (migration 029)
  employment_type: string | null
  schedule: string | null
  weekly_hours: number | null
  internal_rate: number | null
  monthly_salary: number | null
  reports_to_manager: string | null
  also_reports_to_id: string | null
  email_true_north: string | null
  email_goodnews: string | null
  email_coe: string | null
  email_personal: string | null
  phone: string | null
  location: string | null
  onboarding_status: string | null   // 'not_started' | 'in_progress' | 'completed' (migration 043)
  offboarding_status: string | null  // 'not_started' | 'in_progress' | 'completed' (migration 043)
  date_of_birth: string | null
  hire_date: string | null
  left_on: string | null
  employment_history: string | null
  // i7 budget roster (migration 032): which i7 projects the person works on.
  i7_projects: string[] | null
  // HR fields brought over from the True North Team Monday board (migration 033).
  last_name: string | null
  manager_name_text: string | null    // free-text manager (board question)
  whatsapp_same_number: string | null // 'yes' | 'no'
  monday_item_id: string | null       // board item id, importer idempotency
  monday_docs: string | null          // text of the person's "History" Monday Doc (migration 034)
  role_type: string                   // 'user'|'admin'|'admin_assistant'|'team_leader' (migration 035)
  avatar_url: string | null           // profile photo public URL (migration 036)
  address: PersonAddress | null       // structured mailing address, JSON (migration 042)
  milestones: PersonMilestone[] | null // career timeline, JSON array (migration 044)
}

// The "History" file attachments on a person, held in the private person-files
// Storage bucket (migration 033). Imported from the board + uploaded in-portal.
export type PersonAttachmentRow = {
  id: string
  person_id: string
  file_name: string
  storage_path: string
  mime: string | null
  size_bytes: number | null
  monday_asset_id: string | null
  uploaded_at: string
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
  position: string // 'team_leader' | 'collaborator' (migration 040)
  created_at: string
}

// Time Report settings (migration 021), job codes cached from TSheets,
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

// i7 monthly $ budget (base + extra), the bank-account ledger's inflows.
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

// Portal access log (migration 045): one row per visit/session.
export type AccessLogRow = {
  id: string
  profile_id: string | null
  person_id: string | null
  email: string | null
  name: string | null
  user_agent: string | null
  accessed_at: string
}


// ── Time Clock rows (migrations 057, 058) ───────────────────────────────────
//
// Declared as `type`, not `interface`, and that is load-bearing. postgrest-js
// constrains a table's Insert and Update to Record<string, unknown>. A type
// alias gets an implicit index signature and satisfies it; an interface does
// not, so Partial<SomeInterface> fails the constraint and the SDK silently
// resolves EVERY query in the app to `never`, not just this table's.

export type TcSettingsRow = {
  singleton_id: number
  timezone: string
  week_start: number
  period_type: string
  round_enabled: boolean
  round_minutes: number
  round_direction: string
  auto_clockout_hours: number | null
  split_at_midnight: boolean
  calculate_overtime: boolean
  daily_regular_hours: number
  weekly_regular_hours: number
  import_cutoff_date: string | null
  updated_at: string
}

export type TcJobcodeRow = {
  id: number
  external_id: number | null
  parent_id: number | null
  name: string
  kind: 'regular' | 'pto' | 'unpaid'
  billable: boolean
  active: boolean
  imported_at: string | null
  created_at: string
}

export type TcFieldRow = {
  id: number
  external_id: number | null
  name: string
  position: number
  required: boolean
  active: boolean
  created_at: string
}

export type TcFieldOptionRow = {
  id: number
  field_id: number
  external_id: number | null
  label: string
  position: number
  active: boolean
}

export type TcEntryRow = {
  id: number
  external_id: number | null
  person_id: string
  jobcode_id: number | null
  started_at: string | null
  ended_at: string | null
  duration_seconds: number
  entry_date: string
  kind: 'clock' | 'manual' | 'absence'
  state: 'open' | 'submitted' | 'approved' | 'locked'
  notes: string | null
  fields: Record<string, string>
  source: 'portal' | 'tsheets'
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TcEntryAuditRow = {
  id: number
  entry_id: number | null
  action: 'create' | 'update' | 'delete'
  changed_by: string | null
  changed_at: string
  before: unknown
  after: unknown
}

export type TcImportRunRow = {
  id: number
  kind: 'full' | 'delta'
  state: 'running' | 'done' | 'failed'
  cursor_date: string | null
  modified_since: string | null
  entries_seen: number
  entries_written: number
  entries_deleted: number
  error: string | null
  started_at: string
  finished_at: string | null
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
        // monday_webhook_secret (migration 053) is the random path segment that
        // authenticates Monday deliveries. It replaced monday_signing_secret,
        // which was for a JWT check that Monday only offers to integration apps.
        Row: { singleton_id: number; monday_api_token: string | null; tsheets_api_token: string | null; monday_webhook_secret: string | null; tsheets_synced_at: string | null; updated_at: string }
        Insert: { singleton_id?: number; monday_api_token?: string | null; tsheets_api_token?: string | null; monday_webhook_secret?: string | null; tsheets_synced_at?: string | null; updated_at?: string }
        Update: { monday_api_token?: string | null; tsheets_api_token?: string | null; monday_webhook_secret?: string | null; tsheets_synced_at?: string | null; updated_at?: string }
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
      person_attachments: {
        Row: PersonAttachmentRow
        Insert: Partial<Omit<PersonAttachmentRow, 'id' | 'uploaded_at'>> & { person_id: string; file_name: string; storage_path: string }
        Update: Partial<Omit<PersonAttachmentRow, 'id' | 'uploaded_at'>>
        Relationships: [
          {
            foreignKeyName: 'person_attachments_person_id_fkey'
            columns: ['person_id']
            isOneToOne: false
            referencedRelation: 'people'
            referencedColumns: ['id']
          },
        ]
      }
      access_log: {
        Row: AccessLogRow
        Insert: Partial<Omit<AccessLogRow, 'id' | 'accessed_at'>>
        Update: Partial<Omit<AccessLogRow, 'id'>>
        Relationships: []
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
        Row: { id: string; subject_type: 'team' | 'person'; subject_id: string; project_id: string; role: 'manager' | 'publisher' | 'editor' | 'viewer'; created_at: string; updated_at: string }
        Insert: { id?: string; subject_type: 'team' | 'person'; subject_id: string; project_id: string; role: 'manager' | 'publisher' | 'editor' | 'viewer'; created_at?: string; updated_at?: string }
        Update: Partial<{ subject_type: 'team' | 'person'; subject_id: string; project_id: string; role: 'manager' | 'publisher' | 'editor' | 'viewer' }>
        Relationships: []
      }
      // Team → tool/dashboard access (migration 037). One audience per team per tool.
      team_tool_grants: {
        Row: { team_id: string; tool_key: string; audience: 'lead' | 'all'; created_at: string; updated_at: string }
        Insert: { team_id: string; tool_key: string; audience?: 'lead' | 'all'; created_at?: string; updated_at?: string }
        Update: Partial<{ team_id: string; tool_key: string; audience: 'lead' | 'all' }>
        Relationships: []
      }
      // Per-level page/capability permissions (migration 049). 'admin' is never
      // stored: a real admin always passes every surface.
      access_level_pages: {
        Row: { role_type: string; surface_key: string; allowed: boolean; created_at: string; updated_at: string }
        Insert: { role_type: string; surface_key: string; allowed?: boolean; created_at?: string; updated_at?: string }
        Update: Partial<{ role_type: string; surface_key: string; allowed: boolean }>
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
      // ── Time Clock (migrations 057, 058) ───────────────────────────────
      // The portal's own clock. Written by hand like the rest of this file, so
      // adding a column to one of these tables means adding it here too or the
      // SDK starts returning `never` for the whole query.
      tc_settings: {
        Row: TcSettingsRow
        Insert: Partial<TcSettingsRow>
        Update: Partial<TcSettingsRow>
        Relationships: []
      }
      tc_jobcodes: {
        Row: TcJobcodeRow
        Insert: Partial<Omit<TcJobcodeRow, 'id'>>
        Update: Partial<Omit<TcJobcodeRow, 'id'>>
        Relationships: []
      }
      tc_fields: {
        Row: TcFieldRow
        Insert: Partial<Omit<TcFieldRow, 'id'>>
        Update: Partial<Omit<TcFieldRow, 'id'>>
        Relationships: []
      }
      tc_field_options: {
        Row: TcFieldOptionRow
        Insert: Partial<Omit<TcFieldOptionRow, 'id'>> & { field_id: number; label: string }
        Update: Partial<Omit<TcFieldOptionRow, 'id'>>
        Relationships: []
      }
      tc_entries: {
        Row: TcEntryRow
        Insert: Partial<Omit<TcEntryRow, 'id' | 'created_at'>> & { person_id: string; entry_date: string }
        Update: Partial<Omit<TcEntryRow, 'id' | 'created_at'>>
        Relationships: []
      }
      tc_entry_audit: {
        Row: TcEntryAuditRow
        Insert: Partial<Omit<TcEntryAuditRow, 'id' | 'changed_at'>> & { action: string }
        Update: Partial<Omit<TcEntryAuditRow, 'id'>>
        Relationships: []
      }
      tc_periods: {
        Row: { id: number; start_date: string; end_date: string; closed_at: string | null }
        Insert: { id?: number; start_date: string; end_date: string; closed_at?: string | null }
        Update: Partial<{ start_date: string; end_date: string; closed_at: string | null }>
        Relationships: []
      }
      tc_submissions: {
        Row: { id: number; person_id: string; period_id: number; state: string; submitted_at: string | null; approved_at: string | null; approved_by: string | null; note: string | null }
        Insert: { id?: number; person_id: string; period_id: number; state?: string; submitted_at?: string | null; approved_at?: string | null; approved_by?: string | null; note?: string | null }
        Update: Partial<{ state: string; submitted_at: string | null; approved_at: string | null; approved_by: string | null; note: string | null }>
        Relationships: []
      }
      tc_absence_requests: {
        Row: { id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; reason: string | null; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null }
        Insert: { id?: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day?: number; state?: string; reason?: string | null; requested_at?: string; decided_by?: string | null; decided_at?: string | null; decision_note?: string | null }
        Update: Partial<{ state: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; start_date: string; end_date: string; hours_per_day: number; reason: string | null }>
        Relationships: []
      }
      tc_absence_balances: {
        Row: { id: number; person_id: string; jobcode_id: number; year: number; accrued_hours: number; used_hours: number; carried_hours: number }
        Insert: { id?: number; person_id: string; jobcode_id: number; year: number; accrued_hours?: number; used_hours?: number; carried_hours?: number }
        Update: Partial<{ accrued_hours: number; used_hours: number; carried_hours: number }>
        Relationships: []
      }
      tc_import_runs: {
        Row: TcImportRunRow
        Insert: Partial<Omit<TcImportRunRow, 'id'>> & { kind: string }
        Update: Partial<Omit<TcImportRunRow, 'id'>>
        Relationships: []
      }
      tc_reconciliation: {
        Row: { id: number; month: string; tsheets_entries: number; tsheets_seconds: number; portal_entries: number; portal_seconds: number; checked_at: string }
        Insert: { id?: number; month: string; tsheets_entries?: number; tsheets_seconds?: number; portal_entries?: number; portal_seconds?: number; checked_at?: string }
        Update: Partial<{ tsheets_entries: number; tsheets_seconds: number; portal_entries: number; portal_seconds: number; checked_at: string }>
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
      // accessible_site_ids(uid), SECURITY DEFINER helper (migration 016).
      // Returns the set of project (site) ids the user can reach.
      accessible_site_ids: {
        Args: { uid: string }
        Returns: { site_id: string }[]
      }
    }
    Enums: Record<string, never>
  }
}
