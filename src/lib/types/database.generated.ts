// GENERATED from the production schema by deploy/db/gen-types.sh. Do not edit by
// hand: change the database with a migration, then run the script again.
// Hand-made refinements (JSON shapes, value unions) live in database.types.ts.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      access_changes: {
        Row: {
          actor_id: string | null
          at: string
          changes: Json
          id: number
          impact: Json | null
          kind: string
          reason: string
          summary: string
          undoes: number | null
          undone_by: number | null
        }
        Insert: {
          actor_id?: string | null
          at?: string
          changes: Json
          id?: number
          impact?: Json | null
          kind: string
          reason: string
          summary: string
          undoes?: number | null
          undone_by?: number | null
        }
        Update: {
          actor_id?: string | null
          at?: string
          changes?: Json
          id?: number
          impact?: Json | null
          kind?: string
          reason?: string
          summary?: string
          undoes?: number | null
          undone_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "access_changes_actor_id_fkey"
            columns: ["actor_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_changes_undoes_fkey"
            columns: ["undoes"]
            referencedRelation: "access_changes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_changes_undone_by_fkey"
            columns: ["undone_by"]
            referencedRelation: "access_changes"
            referencedColumns: ["id"]
          },
        ]
      }
      access_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          effect: string
          ended_at: string | null
          ended_by: string | null
          id: string
          item_key: string
          person_id: string
          reason: string
          until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effect: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          item_key: string
          person_id: string
          reason: string
          until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effect?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          item_key?: string
          person_id?: string
          reason?: string
          until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_exceptions_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_exceptions_ended_by_fkey"
            columns: ["ended_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_exceptions_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      access_level_pages: {
        Row: {
          allowed: boolean
          created_at: string
          role_type: string
          surface_key: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          role_type: string
          surface_key: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          role_type?: string
          surface_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_log: {
        Row: {
          accessed_at: string
          email: string | null
          id: string
          name: string | null
          person_id: string | null
          profile_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string
          email?: string | null
          id?: string
          name?: string | null
          person_id?: string | null
          profile_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string
          email?: string | null
          id?: string
          name?: string | null
          person_id?: string | null
          profile_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_log_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_log_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      access_rules: {
        Row: {
          allowed: boolean
          item_key: string
          level: string
          updated_at: string
        }
        Insert: {
          allowed: boolean
          item_key: string
          level: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          item_key?: string
          level?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_tool_scope: {
        Row: {
          every_team: boolean
          item_key: string
          updated_at: string
        }
        Insert: {
          every_team?: boolean
          item_key: string
          updated_at?: string
        }
        Update: {
          every_team?: boolean
          item_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      access_tool_teams: {
        Row: {
          audience: string
          item_key: string
          team_id: string
        }
        Insert: {
          audience: string
          item_key: string
          team_id: string
        }
        Update: {
          audience?: string
          item_key?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_tool_teams_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_events: {
        Row: {
          add_to_google: boolean
          audience_team_ids: string[] | null
          calendar_state: string | null
          client: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          ends_at: string | null
          google_event_id: string | null
          id: number
          kind: string
          place: string | null
          start_date: string
          starts_at: string | null
          team_id: string | null
          time_zone: string | null
          title: string
        }
        Insert: {
          add_to_google?: boolean
          audience_team_ids?: string[] | null
          calendar_state?: string | null
          client?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          ends_at?: string | null
          google_event_id?: string | null
          id?: number
          kind: string
          place?: string | null
          start_date: string
          starts_at?: string | null
          team_id?: string | null
          time_zone?: string | null
          title: string
        }
        Update: {
          add_to_google?: boolean
          audience_team_ids?: string[] | null
          calendar_state?: string | null
          client?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          ends_at?: string | null
          google_event_id?: string | null
          id?: number
          kind?: string
          place?: string | null
          start_date?: string
          starts_at?: string | null
          team_id?: string | null
          time_zone?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_good_news: {
        Row: {
          description: string | null
          end_date: string
          ends_at: string | null
          google_event_id: string
          html_link: string | null
          start_date: string
          starts_at: string | null
          synced_at: string
          title: string
        }
        Insert: {
          description?: string | null
          end_date: string
          ends_at?: string | null
          google_event_id: string
          html_link?: string | null
          start_date: string
          starts_at?: string | null
          synced_at?: string
          title: string
        }
        Update: {
          description?: string | null
          end_date?: string
          ends_at?: string | null
          google_event_id?: string
          html_link?: string | null
          start_date?: string
          starts_at?: string | null
          synced_at?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          clocky_reminders: Json
          good_news_synced_at: string | null
          google_checked_at: string | null
          google_connected_at: string | null
          google_connected_by: string | null
          google_good_news_calendar_id: string | null
          google_service_account: string | null
          google_team_calendar_id: string | null
          monday_account_slug: string | null
          monday_api_token: string | null
          monday_hide_stale_boards: boolean
          monday_webhook_secret: string | null
          rippling_api_token: string | null
          rippling_checked_at: string | null
          rippling_connected_as: string | null
          rippling_connected_at: string | null
          rippling_connected_by: string | null
          singleton_id: number
          tsheets_api_token: string | null
          tsheets_synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          clocky_reminders?: Json
          good_news_synced_at?: string | null
          google_checked_at?: string | null
          google_connected_at?: string | null
          google_connected_by?: string | null
          google_good_news_calendar_id?: string | null
          google_service_account?: string | null
          google_team_calendar_id?: string | null
          monday_account_slug?: string | null
          monday_api_token?: string | null
          monday_hide_stale_boards?: boolean
          monday_webhook_secret?: string | null
          rippling_api_token?: string | null
          rippling_checked_at?: string | null
          rippling_connected_as?: string | null
          rippling_connected_at?: string | null
          rippling_connected_by?: string | null
          singleton_id?: number
          tsheets_api_token?: string | null
          tsheets_synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          clocky_reminders?: Json
          good_news_synced_at?: string | null
          google_checked_at?: string | null
          google_connected_at?: string | null
          google_connected_by?: string | null
          google_good_news_calendar_id?: string | null
          google_service_account?: string | null
          google_team_calendar_id?: string | null
          monday_account_slug?: string | null
          monday_api_token?: string | null
          monday_hide_stale_boards?: boolean
          monday_webhook_secret?: string | null
          rippling_api_token?: string | null
          rippling_checked_at?: string | null
          rippling_connected_as?: string | null
          rippling_connected_at?: string | null
          rippling_connected_by?: string | null
          singleton_id?: number
          tsheets_api_token?: string | null
          tsheets_synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_google_connected_by_fkey"
            columns: ["google_connected_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_rippling_connected_by_fkey"
            columns: ["rippling_connected_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          id: string
          user_email: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          id?: string
          user_email?: string | null
        }
        Relationships: []
      }
      confirmations: {
        Row: {
          confirmed_at: string | null
          confirmed_on_live: boolean | null
          created_at: string | null
          id: string
          language_code: string
          page_id: string
          updated_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_on_live?: boolean | null
          created_at?: string | null
          id?: string
          language_code: string
          page_id: string
          updated_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          confirmed_on_live?: boolean | null
          created_at?: string | null
          id?: string
          language_code?: string
          page_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_hours_requests: {
        Row: {
          asked_at: string
          asked_by: string | null
          client: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          hours: number
          id: number
          period: string
          period_end: string
          period_start: string
          person_id: string
          reason: string
          state: string
        }
        Insert: {
          asked_at?: string
          asked_by?: string | null
          client?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          hours: number
          id?: number
          period: string
          period_end: string
          period_start: string
          person_id: string
          reason: string
          state?: string
        }
        Update: {
          asked_at?: string
          asked_by?: string | null
          client?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          hours?: number
          id?: number
          period?: string
          period_end?: string
          period_start?: string
          person_id?: string
          reason?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_hours_requests_asked_by_fkey"
            columns: ["asked_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_hours_requests_decided_by_fkey"
            columns: ["decided_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_hours_requests_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          href: string
          label: string
          position: number
          profile_id: string
        }
        Insert: {
          created_at?: string
          href: string
          label: string
          position?: number
          profile_id: string
        }
        Update: {
          created_at?: string
          href?: string
          label?: string
          position?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grants: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: string
          subject_id: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role: string
          subject_id: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          subject_id?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grants_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      i7_monthly_budget: {
        Row: {
          budget_amount: number
          created_at: string
          created_by: string | null
          extra_amount: number
          id: number
          justification: string
          month: string
        }
        Insert: {
          budget_amount: number
          created_at?: string
          created_by?: string | null
          extra_amount?: number
          id?: number
          justification: string
          month: string
        }
        Update: {
          budget_amount?: number
          created_at?: string
          created_by?: string | null
          extra_amount?: number
          id?: number
          justification?: string
          month?: string
        }
        Relationships: []
      }
      i7_project_month_hours: {
        Row: {
          client_id: number
          created_at: string
          created_by: string | null
          hours_allocated: number
          id: number
          justification: string
          month: string
          project: string
          rate: number
        }
        Insert: {
          client_id: number
          created_at?: string
          created_by?: string | null
          hours_allocated: number
          id?: number
          justification: string
          month: string
          project: string
          rate?: number
        }
        Update: {
          client_id?: number
          created_at?: string
          created_by?: string | null
          hours_allocated?: number
          id?: number
          justification?: string
          month?: string
          project?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "i7_project_month_hours_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "tr_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      i7_report_notes: {
        Row: {
          month: string
          note: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          month: string
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          month?: string
          note?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      integration_jobs: {
        Row: {
          attempts: number
          created_at: string
          done_at: string | null
          id: number
          idempotency_key: string
          kind: string
          last_error: string | null
          next_at: string
          payload: Json
          ref_id: number
          ref_table: string
          state: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          done_at?: string | null
          id?: number
          idempotency_key: string
          kind: string
          last_error?: string | null
          next_at?: string
          payload?: Json
          ref_id: number
          ref_table: string
          state?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          done_at?: string | null
          id?: number
          idempotency_key?: string
          kind?: string
          last_error?: string | null
          next_at?: string
          payload?: Json
          ref_id?: number
          ref_table?: string
          state?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          amount: number
          client: string | null
          description: string
          hours_seconds: number | null
          id: number
          invoice_id: number
          kind: string
          rate: number | null
          reimbursement_id: number | null
          sort: number
        }
        Insert: {
          amount: number
          client?: string | null
          description: string
          hours_seconds?: number | null
          id?: number
          invoice_id: number
          kind: string
          rate?: number | null
          reimbursement_id?: number | null
          sort?: number
        }
        Update: {
          amount?: number
          client?: string | null
          description?: string
          hours_seconds?: number | null
          id?: number
          invoice_id?: number
          kind?: string
          rate?: number | null
          reimbursement_id?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_reimbursement_fk"
            columns: ["reimbursement_id"]
            referencedRelation: "reimbursements"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          billing_name: string | null
          default_approver: string | null
          deputy_director: string | null
          finance: string[]
          invoice_approvers: string[]
          next_number: number
          number_year: number | null
          payment_days: number
          prefix: string
          rmb_next_number: number
          rmb_number_year: number | null
          rmb_prefix: string
          singleton_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          billing_name?: string | null
          default_approver?: string | null
          deputy_director?: string | null
          finance?: string[]
          invoice_approvers?: string[]
          next_number?: number
          number_year?: number | null
          payment_days?: number
          prefix?: string
          rmb_next_number?: number
          rmb_number_year?: number | null
          rmb_prefix?: string
          singleton_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          billing_name?: string | null
          default_approver?: string | null
          deputy_director?: string | null
          finance?: string[]
          invoice_approvers?: string[]
          next_number?: number
          number_year?: number | null
          payment_days?: number
          prefix?: string
          rmb_next_number?: number
          rmb_number_year?: number | null
          rmb_prefix?: string
          singleton_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_default_approver_fkey"
            columns: ["default_approver"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_settings_deputy_director_fkey"
            columns: ["deputy_director"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_settings_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          due_on: string
          from_snapshot: Json
          id: number
          issued_on: string
          kind: string
          number: string
          paid_by: string | null
          paid_note: string | null
          paid_on: string | null
          paid_ref: string | null
          period_end: string
          period_start: string
          person_id: string
          state: string
          submission_id: number | null
          to_snapshot: Json
          total: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          due_on: string
          from_snapshot: Json
          id?: number
          issued_on: string
          kind: string
          number: string
          paid_by?: string | null
          paid_note?: string | null
          paid_on?: string | null
          paid_ref?: string | null
          period_end: string
          period_start: string
          person_id: string
          state?: string
          submission_id?: number | null
          to_snapshot: Json
          total: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          due_on?: string
          from_snapshot?: Json
          id?: number
          issued_on?: string
          kind?: string
          number?: string
          paid_by?: string | null
          paid_note?: string | null
          paid_on?: string | null
          paid_ref?: string | null
          period_end?: string
          period_start?: string
          person_id?: string
          state?: string
          submission_id?: number | null
          to_snapshot?: Json
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_approved_by_fkey"
            columns: ["approved_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_paid_by_fkey"
            columns: ["paid_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_submission_id_fkey"
            columns: ["submission_id"]
            referencedRelation: "tc_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_assignment_events: {
        Row: {
          board_id: number
          detected_at: string
          due_date: string | null
          event: string
          from_value: string | null
          id: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done: boolean | null
          to_value: string | null
        }
        Insert: {
          board_id: number
          detected_at?: string
          due_date?: string | null
          event: string
          from_value?: string | null
          id?: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done?: boolean | null
          to_value?: string | null
        }
        Update: {
          board_id?: number
          detected_at?: string
          due_date?: string | null
          event?: string
          from_value?: string | null
          id?: number
          item_id?: number
          monday_user_id?: number
          occurred_at?: string
          people_col?: string
          status_done?: boolean | null
          to_value?: string | null
        }
        Relationships: []
      }
      monday_assignment_events_reserve_103: {
        Row: {
          board_id: number
          detected_at: string
          due_date: string | null
          event: string
          from_value: string | null
          id: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done: boolean | null
          to_value: string | null
        }
        Insert: {
          board_id: number
          detected_at?: string
          due_date?: string | null
          event: string
          from_value?: string | null
          id?: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done?: boolean | null
          to_value?: string | null
        }
        Update: {
          board_id?: number
          detected_at?: string
          due_date?: string | null
          event?: string
          from_value?: string | null
          id?: number
          item_id?: number
          monday_user_id?: number
          occurred_at?: string
          people_col?: string
          status_done?: boolean | null
          to_value?: string | null
        }
        Relationships: []
      }
      monday_assignment_events_reserve_105: {
        Row: {
          board_id: number
          detected_at: string
          due_date: string | null
          event: string
          from_value: string | null
          id: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done: boolean | null
          to_value: string | null
          why: string | null
        }
        Insert: {
          board_id: number
          detected_at?: string
          due_date?: string | null
          event: string
          from_value?: string | null
          id?: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done?: boolean | null
          to_value?: string | null
          why?: string | null
        }
        Update: {
          board_id?: number
          detected_at?: string
          due_date?: string | null
          event?: string
          from_value?: string | null
          id?: number
          item_id?: number
          monday_user_id?: number
          occurred_at?: string
          people_col?: string
          status_done?: boolean | null
          to_value?: string | null
          why?: string | null
        }
        Relationships: []
      }
      monday_assignments: {
        Row: {
          board_id: number
          due_col: string | null
          due_date: string | null
          group_title: string | null
          id: number
          item_id: number
          item_language: string | null
          item_name: string
          item_updated_at: string | null
          monday_user_id: number
          parent_board_id: number | null
          parent_item_id: number | null
          parent_item_name: string | null
          people_col: string
          status_col: string | null
          status_color: string | null
          status_done: boolean | null
          status_index: number | null
          status_text: string | null
          synced_at: string
        }
        Insert: {
          board_id: number
          due_col?: string | null
          due_date?: string | null
          group_title?: string | null
          id?: number
          item_id: number
          item_language?: string | null
          item_name: string
          item_updated_at?: string | null
          monday_user_id: number
          parent_board_id?: number | null
          parent_item_id?: number | null
          parent_item_name?: string | null
          people_col: string
          status_col?: string | null
          status_color?: string | null
          status_done?: boolean | null
          status_index?: number | null
          status_text?: string | null
          synced_at?: string
        }
        Update: {
          board_id?: number
          due_col?: string | null
          due_date?: string | null
          group_title?: string | null
          id?: number
          item_id?: number
          item_language?: string | null
          item_name?: string
          item_updated_at?: string | null
          monday_user_id?: number
          parent_board_id?: number | null
          parent_item_id?: number | null
          parent_item_name?: string | null
          people_col?: string
          status_col?: string | null
          status_color?: string | null
          status_done?: boolean | null
          status_index?: number | null
          status_text?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_assignments_board_id_fkey"
            columns: ["board_id"]
            referencedRelation: "monday_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_assignments_staging: {
        Row: {
          batch: string
          board_id: number
          due_col: string | null
          due_date: string | null
          group_title: string | null
          id: number
          item_id: number
          item_language: string | null
          item_name: string
          item_updated_at: string | null
          monday_user_id: number
          parent_board_id: number | null
          parent_item_id: number | null
          parent_item_name: string | null
          people_col: string
          status_col: string | null
          status_color: string | null
          status_done: boolean | null
          status_index: number | null
          status_text: string | null
          synced_at: string
        }
        Insert: {
          batch: string
          board_id: number
          due_col?: string | null
          due_date?: string | null
          group_title?: string | null
          id?: number
          item_id: number
          item_language?: string | null
          item_name: string
          item_updated_at?: string | null
          monday_user_id: number
          parent_board_id?: number | null
          parent_item_id?: number | null
          parent_item_name?: string | null
          people_col: string
          status_col?: string | null
          status_color?: string | null
          status_done?: boolean | null
          status_index?: number | null
          status_text?: string | null
          synced_at?: string
        }
        Update: {
          batch?: string
          board_id?: number
          due_col?: string | null
          due_date?: string | null
          group_title?: string | null
          id?: number
          item_id?: number
          item_language?: string | null
          item_name?: string
          item_updated_at?: string | null
          monday_user_id?: number
          parent_board_id?: number | null
          parent_item_id?: number | null
          parent_item_name?: string | null
          people_col?: string
          status_col?: string | null
          status_color?: string | null
          status_done?: boolean | null
          status_index?: number | null
          status_text?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      monday_board_steps: {
        Row: {
          baseline_pending: boolean
          board_id: number
          people_col: string
          people_title: string
          position: number
          source: string
          stages: Json | null
          status_col: string | null
          step_name: string
          updated_at: string
        }
        Insert: {
          baseline_pending?: boolean
          board_id: number
          people_col: string
          people_title: string
          position: number
          source?: string
          stages?: Json | null
          status_col?: string | null
          step_name: string
          updated_at?: string
        }
        Update: {
          baseline_pending?: boolean
          board_id?: number
          people_col?: string
          people_title?: string
          position?: number
          source?: string
          stages?: Json | null
          status_col?: string | null
          step_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_board_steps_board_id_fkey"
            columns: ["board_id"]
            referencedRelation: "monday_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_boards: {
        Row: {
          assignments_count: number | null
          baseline_pending: boolean
          board_updated_at: string | null
          date_col: string | null
          date_title: string | null
          gone_at: string | null
          id: number
          included: boolean
          included_pinned: boolean
          is_subitem_board: boolean
          items_count: number | null
          items_synced_at: string | null
          kind: string | null
          last_activity_at: string | null
          name: string
          priority: string
          synced_at: string | null
          tc_jobcode_id: number | null
          workspace_id: number | null
          workspace_name: string | null
        }
        Insert: {
          assignments_count?: number | null
          baseline_pending?: boolean
          board_updated_at?: string | null
          date_col?: string | null
          date_title?: string | null
          gone_at?: string | null
          id: number
          included?: boolean
          included_pinned?: boolean
          is_subitem_board?: boolean
          items_count?: number | null
          items_synced_at?: string | null
          kind?: string | null
          last_activity_at?: string | null
          name: string
          priority?: string
          synced_at?: string | null
          tc_jobcode_id?: number | null
          workspace_id?: number | null
          workspace_name?: string | null
        }
        Update: {
          assignments_count?: number | null
          baseline_pending?: boolean
          board_updated_at?: string | null
          date_col?: string | null
          date_title?: string | null
          gone_at?: string | null
          id?: number
          included?: boolean
          included_pinned?: boolean
          is_subitem_board?: boolean
          items_count?: number | null
          items_synced_at?: string | null
          kind?: string | null
          last_activity_at?: string | null
          name?: string
          priority?: string
          synced_at?: string | null
          tc_jobcode_id?: number | null
          workspace_id?: number | null
          workspace_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monday_boards_tc_jobcode_id_fkey"
            columns: ["tc_jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_events: {
        Row: {
          board_id: string | null
          column_id: string | null
          delivery_key: string | null
          event_type: string
          id: string
          monday_item_id: string | null
          new_value: Json | null
          old_value: Json | null
          processed_at: string | null
          raw_payload: Json | null
          received_at: string
          result: string | null
          user_id: string | null
        }
        Insert: {
          board_id?: string | null
          column_id?: string | null
          delivery_key?: string | null
          event_type: string
          id?: string
          monday_item_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          processed_at?: string | null
          raw_payload?: Json | null
          received_at?: string
          result?: string | null
          user_id?: string | null
        }
        Update: {
          board_id?: string | null
          column_id?: string | null
          delivery_key?: string | null
          event_type?: string
          id?: string
          monday_item_id?: string | null
          new_value?: Json | null
          old_value?: Json | null
          processed_at?: string | null
          raw_payload?: Json | null
          received_at?: string
          result?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      monday_priority_grants: {
        Row: {
          granted_at: string
          granted_by: string | null
          person_id: string
          scope: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          person_id: string
          scope: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          person_id?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_priority_grants_granted_by_fkey"
            columns: ["granted_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monday_priority_grants_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_snapshot: {
        Row: {
          board_id: string
          data: Json
          ingested_at: string
          published_items: Json | null
        }
        Insert: {
          board_id: string
          data: Json
          ingested_at?: string
          published_items?: Json | null
        }
        Update: {
          board_id?: string
          data?: Json
          ingested_at?: string
          published_items?: Json | null
        }
        Relationships: []
      }
      monday_sync_lock: {
        Row: {
          expires_at: string | null
          holder: string | null
          id: number
        }
        Insert: {
          expires_at?: string | null
          holder?: string | null
          id: number
        }
        Update: {
          expires_at?: string | null
          holder?: string | null
          id?: number
        }
        Relationships: []
      }
      monday_sync_runs: {
        Row: {
          assignments: number
          boards_read: number
          chained: string | null
          error: string | null
          failed: Json
          finished_at: string | null
          gone: number
          hop: number
          id: number
          items: number
          remaining: number | null
          since: string
          started_at: string
        }
        Insert: {
          assignments?: number
          boards_read?: number
          chained?: string | null
          error?: string | null
          failed?: Json
          finished_at?: string | null
          gone?: number
          hop: number
          id?: number
          items?: number
          remaining?: number | null
          since: string
          started_at?: string
        }
        Update: {
          assignments?: number
          boards_read?: number
          chained?: string | null
          error?: string | null
          failed?: Json
          finished_at?: string | null
          gone?: number
          hop?: number
          id?: number
          items?: number
          remaining?: number | null
          since?: string
          started_at?: string
        }
        Relationships: []
      }
      monday_team_priority: {
        Row: {
          board_order: Json
          pinned: Json
          step_order: Json
          team_id: string
          updated_at: string
          updated_by: string | null
          workspace_order: Json
        }
        Insert: {
          board_order?: Json
          pinned?: Json
          step_order?: Json
          team_id: string
          updated_at?: string
          updated_by?: string | null
          workspace_order?: Json
        }
        Update: {
          board_order?: Json
          pinned?: Json
          step_order?: Json
          team_id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_order?: Json
        }
        Relationships: [
          {
            foreignKeyName: "monday_team_priority_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monday_team_priority_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_user_links: {
        Row: {
          created_at: string
          linked_by: string
          monday_user_id: number
          person_id: string
        }
        Insert: {
          created_at?: string
          linked_by?: string
          monday_user_id: number
          person_id: string
        }
        Update: {
          created_at?: string
          linked_by?: string
          monday_user_id?: number
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monday_user_links_monday_user_id_fkey"
            columns: ["monday_user_id"]
            referencedRelation: "monday_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monday_user_links_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_users: {
        Row: {
          auto_link: boolean
          email: string | null
          enabled: boolean
          hidden: boolean
          id: number
          is_external: boolean
          is_guest: boolean
          name: string
          synced_at: string
        }
        Insert: {
          auto_link?: boolean
          email?: string | null
          enabled?: boolean
          hidden?: boolean
          id: number
          is_external?: boolean
          is_guest?: boolean
          name: string
          synced_at?: string
        }
        Update: {
          auto_link?: boolean
          email?: string | null
          enabled?: boolean
          hidden?: boolean
          id?: number
          is_external?: boolean
          is_guest?: boolean
          name?: string
          synced_at?: string
        }
        Relationships: []
      }
      notification_digests: {
        Row: {
          attempts: number
          category: string
          error: string | null
          items: number
          local_day: string
          person_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          category: string
          error?: string | null
          items?: number
          local_day: string
          person_id: string
          status: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          category?: string
          error?: string | null
          items?: number
          local_day?: string
          person_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_digests_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          channel: string | null
          enabled: boolean | null
          person_id: string
          timing: string | null
          type_key: string
          updated_at: string
        }
        Insert: {
          channel?: string | null
          enabled?: boolean | null
          person_id: string
          timing?: string | null
          type_key: string
          updated_at?: string
        }
        Update: {
          channel?: string | null
          enabled?: boolean | null
          person_id?: string
          timing?: string | null
          type_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          channel: string
          enabled: boolean
          fix_channel: boolean
          fix_enabled: boolean
          fix_timing: boolean
          timing: string
          type_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          channel?: string
          enabled?: boolean
          fix_channel?: boolean
          fix_enabled?: boolean
          fix_timing?: boolean
          timing: string
          type_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          channel?: string
          enabled?: boolean
          fix_channel?: boolean
          fix_enabled?: boolean
          fix_timing?: boolean
          timing?: string
          type_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_state: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string
          deliver_at: string
          done_note: string | null
          emailed_at: string | null
          href: string | null
          id: string
          person_id: string
          read_at: string | null
          timing: string
          title: string
          type_key: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key: string
          deliver_at?: string
          done_note?: string | null
          emailed_at?: string | null
          href?: string | null
          id?: string
          person_id: string
          read_at?: string | null
          timing: string
          title: string
          type_key: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string
          deliver_at?: string
          done_note?: string | null
          emailed_at?: string | null
          href?: string | null
          id?: string
          person_id?: string
          read_at?: string | null
          timing?: string
          title?: string
          type_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      page_urls: {
        Row: {
          created_at: string | null
          id: string
          language_code: string
          monday_item_id: string | null
          page_id: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          language_code: string
          monday_item_id?: string | null
          page_id: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          language_code?: string
          monday_item_id?: string | null
          page_id?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_urls_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          confirmed_done_at: string | null
          created_at: string | null
          id: string
          monday_item_id: string | null
          monday_item_name: string | null
          name: string
          needs_hreflang_update: boolean | null
          not_relevant: boolean
          site_id: string
          updated_at: string | null
        }
        Insert: {
          confirmed_done_at?: string | null
          created_at?: string | null
          id?: string
          monday_item_id?: string | null
          monday_item_name?: string | null
          name: string
          needs_hreflang_update?: boolean | null
          not_relevant?: boolean
          site_id: string
          updated_at?: string | null
        }
        Update: {
          confirmed_done_at?: string | null
          created_at?: string | null
          id?: string
          monday_item_id?: string | null
          monday_item_name?: string | null
          name?: string
          needs_hreflang_update?: boolean | null
          not_relevant?: boolean
          site_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_site_id_fkey"
            columns: ["site_id"]
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_terms: {
        Row: {
          allowance_hours: number | null
          allowance_period: string | null
          pays_as: string | null
          person_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowance_hours?: number | null
          allowance_period?: string | null
          pays_as?: string | null
          person_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowance_hours?: number | null
          allowance_period?: string | null
          pays_as?: string | null
          person_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_terms_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_terms_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_terms_changes: {
        Row: {
          after: Json
          before: Json | null
          changed_at: string
          changed_by: string | null
          id: number
          person_id: string
          reason: string | null
        }
        Insert: {
          after: Json
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: number
          person_id: string
          reason?: string | null
        }
        Update: {
          after?: Json
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: number
          person_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_terms_changes_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_terms_changes_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          access_level: string | null
          address: Json | null
          also_reports_to_id: string | null
          avatar_url: string | null
          be_rate: number | null
          created_at: string
          date_of_birth: string | null
          email_coe: string | null
          email_goodnews: string | null
          email_personal: string | null
          email_true_north: string | null
          employment_history: string | null
          employment_type: string | null
          full_name: string
          hire_date: string | null
          i7_projects: string[]
          id: string
          internal_rate: number | null
          last_name: string | null
          left_on: string | null
          location: string | null
          manager_id: string | null
          manager_name_text: string | null
          milestones: Json | null
          monday_docs: string | null
          monday_item_id: string | null
          monthly_salary: number | null
          offboarding_status: string | null
          onboarding_status: string | null
          phone: string | null
          portal_invited_at: string | null
          portal_invited_by: string | null
          profile_id: string | null
          reports_to_manager: string | null
          role_type: string
          schedule: string | null
          sort_order: number
          status: string
          title: string | null
          tsheets_only: boolean
          tsheets_user_id: number | null
          updated_at: string
          weekly_hours: number | null
          whatsapp_same_number: string | null
        }
        Insert: {
          access_level?: string | null
          address?: Json | null
          also_reports_to_id?: string | null
          avatar_url?: string | null
          be_rate?: number | null
          created_at?: string
          date_of_birth?: string | null
          email_coe?: string | null
          email_goodnews?: string | null
          email_personal?: string | null
          email_true_north?: string | null
          employment_history?: string | null
          employment_type?: string | null
          full_name: string
          hire_date?: string | null
          i7_projects?: string[]
          id?: string
          internal_rate?: number | null
          last_name?: string | null
          left_on?: string | null
          location?: string | null
          manager_id?: string | null
          manager_name_text?: string | null
          milestones?: Json | null
          monday_docs?: string | null
          monday_item_id?: string | null
          monthly_salary?: number | null
          offboarding_status?: string | null
          onboarding_status?: string | null
          phone?: string | null
          portal_invited_at?: string | null
          portal_invited_by?: string | null
          profile_id?: string | null
          reports_to_manager?: string | null
          role_type?: string
          schedule?: string | null
          sort_order?: number
          status?: string
          title?: string | null
          tsheets_only?: boolean
          tsheets_user_id?: number | null
          updated_at?: string
          weekly_hours?: number | null
          whatsapp_same_number?: string | null
        }
        Update: {
          access_level?: string | null
          address?: Json | null
          also_reports_to_id?: string | null
          avatar_url?: string | null
          be_rate?: number | null
          created_at?: string
          date_of_birth?: string | null
          email_coe?: string | null
          email_goodnews?: string | null
          email_personal?: string | null
          email_true_north?: string | null
          employment_history?: string | null
          employment_type?: string | null
          full_name?: string
          hire_date?: string | null
          i7_projects?: string[]
          id?: string
          internal_rate?: number | null
          last_name?: string | null
          left_on?: string | null
          location?: string | null
          manager_id?: string | null
          manager_name_text?: string | null
          milestones?: Json | null
          monday_docs?: string | null
          monday_item_id?: string | null
          monthly_salary?: number | null
          offboarding_status?: string | null
          onboarding_status?: string | null
          phone?: string | null
          portal_invited_at?: string | null
          portal_invited_by?: string | null
          profile_id?: string | null
          reports_to_manager?: string | null
          role_type?: string
          schedule?: string | null
          sort_order?: number
          status?: string
          title?: string | null
          tsheets_only?: boolean
          tsheets_user_id?: number | null
          updated_at?: string
          weekly_hours?: number | null
          whatsapp_same_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_also_reports_to_id_fkey"
            columns: ["also_reports_to_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_manager_id_fkey"
            columns: ["manager_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      people_merges: {
        Row: {
          id: number
          loser_id: string
          loser_name: string
          loser_tsheets_user_id: number | null
          merged_at: string
          moved: Json
          winner_id: string
        }
        Insert: {
          id?: number
          loser_id: string
          loser_name: string
          loser_tsheets_user_id?: number | null
          merged_at?: string
          moved: Json
          winner_id: string
        }
        Update: {
          id?: number
          loser_id?: string
          loser_name?: string
          loser_tsheets_user_id?: number | null
          merged_at?: string
          moved?: Json
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_merges_winner_id_fkey"
            columns: ["winner_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      people_type_changes: {
        Row: {
          applied_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          effective_on: string
          id: number
          note: string | null
          person_id: string
          scheduled_at: string
          scheduled_by: string | null
          state: string
          to_type: string
        }
        Insert: {
          applied_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          effective_on: string
          id?: number
          note?: string | null
          person_id: string
          scheduled_at?: string
          scheduled_by?: string | null
          state?: string
          to_type: string
        }
        Update: {
          applied_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          effective_on?: string
          id?: number
          note?: string | null
          person_id?: string
          scheduled_at?: string
          scheduled_by?: string | null
          state?: string
          to_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_type_changes_cancelled_by_fkey"
            columns: ["cancelled_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_type_changes_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_type_changes_scheduled_by_fkey"
            columns: ["scheduled_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_attachments: {
        Row: {
          file_name: string
          id: string
          mime: string | null
          monday_asset_id: string | null
          person_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          id?: string
          mime?: string | null
          monday_asset_id?: string | null
          person_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          id?: string
          mime?: string | null
          monday_asset_id?: string | null
          person_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_attachments_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      person_settings: {
        Row: {
          favourites: string[]
          hidden_columns: Json
          person_id: string
          show_anniversary: boolean
          show_birthday: boolean
          start_page: string | null
          summary_hour: number | null
          time_zone: string | null
          updated_at: string
        }
        Insert: {
          favourites?: string[]
          hidden_columns?: Json
          person_id: string
          show_anniversary?: boolean
          show_birthday?: boolean
          start_page?: string | null
          summary_hour?: number | null
          time_zone?: string | null
          updated_at?: string
        }
        Update: {
          favourites?: string[]
          hidden_columns?: Json
          person_id?: string
          show_anniversary?: boolean
          show_birthday?: boolean
          start_page?: string | null
          summary_hour?: number | null
          time_zone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_settings_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      publishing_publishers: {
        Row: {
          added_by: string | null
          created_at: string
          name: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          name: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          name?: string
        }
        Relationships: []
      }
      publishing_target_periods: {
        Row: {
          board_id: string
          id: number
          language: string
          target_value: number
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          board_id: string
          id?: number
          language: string
          target_value: number
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          board_id?: string
          id?: number
          language?: string
          target_value?: number
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      publishing_targets: {
        Row: {
          board_id: string
          board_short: string | null
          created_at: string
          id: string
          language: string
          period_type: string
          target_value: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          board_id: string
          board_short?: string | null
          created_at?: string
          id?: string
          language: string
          period_type?: string
          target_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          board_id?: string
          board_short?: string | null
          created_at?: string
          id?: string
          language?: string
          period_type?: string
          target_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reimbursement_documents: {
        Row: {
          created_at: string
          id: number
          number: string
          paid_by: string | null
          paid_note: string | null
          paid_on: string | null
          paid_ref: string | null
          person_id: string
          state: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          number: string
          paid_by?: string | null
          paid_note?: string | null
          paid_on?: string | null
          paid_ref?: string | null
          person_id: string
          state?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          number?: string
          paid_by?: string | null
          paid_note?: string | null
          paid_on?: string | null
          paid_ref?: string | null
          person_id?: string
          state?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_documents_paid_by_fkey"
            columns: ["paid_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursement_documents_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursement_reports: {
        Row: {
          created_at: string
          id: number
          name: string | null
          person_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          name?: string | null
          person_id: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursement_reports_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          asked_at: string
          billable: boolean
          category: string
          client: string | null
          currency: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          document_id: number | null
          id: number
          invoice_id: number | null
          person_id: string
          purpose: string
          receipt_name: string | null
          receipt_path: string
          receipt_size: number | null
          report_id: number | null
          spent_on: string
          state: string
        }
        Insert: {
          amount: number
          asked_at?: string
          billable?: boolean
          category: string
          client?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          document_id?: number | null
          id?: number
          invoice_id?: number | null
          person_id: string
          purpose: string
          receipt_name?: string | null
          receipt_path: string
          receipt_size?: number | null
          report_id?: number | null
          spent_on: string
          state?: string
        }
        Update: {
          amount?: number
          asked_at?: string
          billable?: boolean
          category?: string
          client?: string | null
          currency?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          document_id?: number | null
          id?: number
          invoice_id?: number | null
          person_id?: string
          purpose?: string
          receipt_name?: string | null
          receipt_path?: string
          receipt_size?: number | null
          report_id?: number | null
          spent_on?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_decided_by_fkey"
            columns: ["decided_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "reimbursement_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_invoice_id_fkey"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_report_id_fkey"
            columns: ["report_id"]
            referencedRelation: "reimbursement_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_change_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          actor_person_id: string | null
          at: string
          id: number
          setting: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          actor_person_id?: string | null
          at?: string
          id?: number
          setting: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_person_id?: string | null
          at?: string
          id?: number
          setting?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          code: string
          created_at: string | null
          domain: string | null
          id: string
          language_paths: Json
          languages: string[]
          monday_board_id: string | null
          monday_column_ids: Json | null
          name: string
          paused_languages: string[]
          target_cycle_start: string | null
          target_cycle_weeks: number
          wp_dev_url: string | null
          wp_live_url: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          domain?: string | null
          id?: string
          language_paths?: Json
          languages: string[]
          monday_board_id?: string | null
          monday_column_ids?: Json | null
          name: string
          paused_languages?: string[]
          target_cycle_start?: string | null
          target_cycle_weeks?: number
          wp_dev_url?: string | null
          wp_live_url?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          domain?: string | null
          id?: string
          language_paths?: Json
          languages?: string[]
          monday_board_id?: string | null
          monday_column_ids?: Json | null
          name?: string
          paused_languages?: string[]
          target_cycle_start?: string | null
          target_cycle_weeks?: number
          wp_dev_url?: string | null
          wp_live_url?: string | null
        }
        Relationships: []
      }
      system_health_checks: {
        Row: {
          checked_at: string
          detail: string | null
          id: string
          ok: boolean
          service: string
          status: string
        }
        Insert: {
          checked_at?: string
          detail?: string | null
          id?: string
          ok: boolean
          service: string
          status?: string
        }
        Update: {
          checked_at?: string
          detail?: string | null
          id?: string
          ok?: boolean
          service?: string
          status?: string
        }
        Relationships: []
      }
      tc_absence_balances: {
        Row: {
          accrued_hours: number
          carried_hours: number
          id: number
          jobcode_id: number
          person_id: string
          used_hours: number
          year: number
        }
        Insert: {
          accrued_hours?: number
          carried_hours?: number
          id?: number
          jobcode_id: number
          person_id: string
          used_hours?: number
          year: number
        }
        Update: {
          accrued_hours?: number
          carried_hours?: number
          id?: number
          jobcode_id?: number
          person_id?: string
          used_hours?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tc_absence_balances_jobcode_id_fkey"
            columns: ["jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_absence_balances_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_absence_requests: {
        Row: {
          calendar_event_id: string | null
          calendar_state: string | null
          cancel_asked_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string
          entries_written_at: string | null
          hours_per_day: number
          id: number
          jobcode_id: number
          person_id: string
          reason: string | null
          requested_at: string
          rippling_error: string | null
          rippling_sent_at: string | null
          rippling_state: string | null
          start_date: string
          state: string
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_state?: string | null
          cancel_asked_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date: string
          entries_written_at?: string | null
          hours_per_day?: number
          id?: number
          jobcode_id: number
          person_id: string
          reason?: string | null
          requested_at?: string
          rippling_error?: string | null
          rippling_sent_at?: string | null
          rippling_state?: string | null
          start_date: string
          state?: string
        }
        Update: {
          calendar_event_id?: string | null
          calendar_state?: string | null
          cancel_asked_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string
          entries_written_at?: string | null
          hours_per_day?: number
          id?: number
          jobcode_id?: number
          person_id?: string
          reason?: string | null
          requested_at?: string
          rippling_error?: string | null
          rippling_sent_at?: string | null
          rippling_state?: string | null
          start_date?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "tc_absence_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_absence_requests_decided_by_fkey"
            columns: ["decided_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_absence_requests_jobcode_id_fkey"
            columns: ["jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_absence_requests_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_approval_events: {
        Row: {
          action: string
          at: string
          by_person: string | null
          id: number
          invoice_id: number | null
          note: string | null
          step: string
          submission_id: number | null
        }
        Insert: {
          action: string
          at?: string
          by_person?: string | null
          id?: number
          invoice_id?: number | null
          note?: string | null
          step: string
          submission_id?: number | null
        }
        Update: {
          action?: string
          at?: string
          by_person?: string | null
          id?: number
          invoice_id?: number | null
          note?: string | null
          step?: string
          submission_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_approval_events_by_person_fkey"
            columns: ["by_person"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_approval_events_invoice_fk"
            columns: ["invoice_id"]
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_approval_events_submission_id_fkey"
            columns: ["submission_id"]
            referencedRelation: "tc_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_combinations: {
        Row: {
          created_at: string
          fields: Json
          id: number
          jobcode_id: number
          name: string
          notes: string | null
          person_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          id?: number
          jobcode_id: number
          name: string
          notes?: string | null
          person_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fields?: Json
          id?: number
          jobcode_id?: number
          name?: string
          notes?: string | null
          person_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tc_combinations_jobcode_id_fkey"
            columns: ["jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_combinations_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_correction_requests: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          ended_at: string
          entry_date: string
          entry_id: number | null
          fields: Json
          id: number
          jobcode_id: number
          notes: string | null
          person_id: string
          reason: string
          requested_at: string
          started_at: string
          state: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ended_at: string
          entry_date: string
          entry_id?: number | null
          fields?: Json
          id?: number
          jobcode_id: number
          notes?: string | null
          person_id: string
          reason: string
          requested_at?: string
          started_at: string
          state?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ended_at?: string
          entry_date?: string
          entry_id?: number | null
          fields?: Json
          id?: number
          jobcode_id?: number
          notes?: string | null
          person_id?: string
          reason?: string
          requested_at?: string
          started_at?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "tc_correction_requests_decided_by_fkey"
            columns: ["decided_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_correction_requests_entry_id_fkey"
            columns: ["entry_id"]
            referencedRelation: "tc_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_correction_requests_jobcode_id_fkey"
            columns: ["jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_correction_requests_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_entries: {
        Row: {
          auto_stopped_at: string | null
          changed_here_at: string | null
          clocked_out_by: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number
          edited_at: string | null
          edited_by: string | null
          end_confirmed_at: string | null
          end_confirmed_by: string | null
          end_flagged: boolean
          ended_at: string | null
          ended_at_real: string | null
          entry_date: string
          external_id: number | null
          fields: Json
          id: number
          jobcode_id: number | null
          kind: string
          manual_batch: string | null
          manual_line: number | null
          notes: string | null
          person_id: string
          session_started_at: string | null
          source: string
          started_at: string | null
          started_at_real: string | null
          state: string
          updated_at: string
          window_started_at: string | null
        }
        Insert: {
          auto_stopped_at?: string | null
          changed_here_at?: string | null
          clocked_out_by?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          edited_at?: string | null
          edited_by?: string | null
          end_confirmed_at?: string | null
          end_confirmed_by?: string | null
          end_flagged?: boolean
          ended_at?: string | null
          ended_at_real?: string | null
          entry_date: string
          external_id?: number | null
          fields?: Json
          id?: number
          jobcode_id?: number | null
          kind?: string
          manual_batch?: string | null
          manual_line?: number | null
          notes?: string | null
          person_id: string
          session_started_at?: string | null
          source?: string
          started_at?: string | null
          started_at_real?: string | null
          state?: string
          updated_at?: string
          window_started_at?: string | null
        }
        Update: {
          auto_stopped_at?: string | null
          changed_here_at?: string | null
          clocked_out_by?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          edited_at?: string | null
          edited_by?: string | null
          end_confirmed_at?: string | null
          end_confirmed_by?: string | null
          end_flagged?: boolean
          ended_at?: string | null
          ended_at_real?: string | null
          entry_date?: string
          external_id?: number | null
          fields?: Json
          id?: number
          jobcode_id?: number | null
          kind?: string
          manual_batch?: string | null
          manual_line?: number | null
          notes?: string | null
          person_id?: string
          session_started_at?: string | null
          source?: string
          started_at?: string | null
          started_at_real?: string | null
          state?: string
          updated_at?: string
          window_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_entries_clocked_out_by_fkey"
            columns: ["clocked_out_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_entries_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_entries_edited_by_fkey"
            columns: ["edited_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_entries_end_confirmed_by_fkey"
            columns: ["end_confirmed_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_entries_jobcode_id_fkey"
            columns: ["jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_entries_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_entry_audit: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          entry_id: number | null
          id: number
          reason: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entry_id?: number | null
          id?: number
          reason?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entry_id?: number | null
          id?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_entry_audit_changed_by_fkey"
            columns: ["changed_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_entry_audit_entry_id_fkey"
            columns: ["entry_id"]
            referencedRelation: "tc_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_field_options: {
        Row: {
          family: string | null
          active: boolean
          edited_in_portal_at: string | null
          external_id: number | null
          field_id: number
          id: number
          label: string
          position: number
        }
        Insert: {
          family?: string | null
          active?: boolean
          edited_in_portal_at?: string | null
          external_id?: number | null
          field_id: number
          id?: number
          label: string
          position?: number
        }
        Update: {
          family?: string | null
          active?: boolean
          edited_in_portal_at?: string | null
          external_id?: number | null
          field_id?: number
          id?: number
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "tc_field_options_field_id_fkey"
            columns: ["field_id"]
            referencedRelation: "tc_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_fields: {
        Row: {
          structure: number
          active: boolean
          created_at: string
          external_id: number | null
          id: number
          name: string
          position: number
          required: boolean
        }
        Insert: {
          structure?: number
          active?: boolean
          created_at?: string
          external_id?: number | null
          id?: number
          name: string
          position?: number
          required?: boolean
        }
        Update: {
          structure?: number
          active?: boolean
          created_at?: string
          external_id?: number | null
          id?: number
          name?: string
          position?: number
          required?: boolean
        }
        Relationships: []
      }
      tc_import_runs: {
        Row: {
          cursor_date: string | null
          entries_deleted: number
          entries_seen: number
          entries_written: number
          error: string | null
          finished_at: string | null
          id: number
          kind: string
          modified_since: string | null
          started_at: string
          state: string
        }
        Insert: {
          cursor_date?: string | null
          entries_deleted?: number
          entries_seen?: number
          entries_written?: number
          error?: string | null
          finished_at?: string | null
          id?: number
          kind: string
          modified_since?: string | null
          started_at?: string
          state?: string
        }
        Update: {
          cursor_date?: string | null
          entries_deleted?: number
          entries_seen?: number
          entries_written?: number
          error?: string | null
          finished_at?: string | null
          id?: number
          kind?: string
          modified_since?: string | null
          started_at?: string
          state?: string
        }
        Relationships: []
      }
      tc_import_skipped: {
        Row: {
          already_in_entries: boolean
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          deleted_in_tsheets_at: string | null
          duration_seconds: number
          ended_at: string | null
          entry_date: string
          external_id: number
          fields: Json
          first_seen_at: string
          job_path: string | null
          jobcode_id: number | null
          kind: string | null
          last_seen_at: string
          notes: string | null
          person_id: string
          raw: Json
          started_at: string | null
          starts_on: string
          state: string | null
          tsheets_user_id: number
        }
        Insert: {
          already_in_entries?: boolean
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          deleted_in_tsheets_at?: string | null
          duration_seconds?: number
          ended_at?: string | null
          entry_date: string
          external_id: number
          fields?: Json
          first_seen_at?: string
          job_path?: string | null
          jobcode_id?: number | null
          kind?: string | null
          last_seen_at?: string
          notes?: string | null
          person_id: string
          raw: Json
          started_at?: string | null
          starts_on: string
          state?: string | null
          tsheets_user_id: number
        }
        Update: {
          already_in_entries?: boolean
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          deleted_in_tsheets_at?: string | null
          duration_seconds?: number
          ended_at?: string | null
          entry_date?: string
          external_id?: number
          fields?: Json
          first_seen_at?: string
          job_path?: string | null
          jobcode_id?: number | null
          kind?: string | null
          last_seen_at?: string
          notes?: string | null
          person_id?: string
          raw?: Json
          started_at?: string | null
          starts_on?: string
          state?: string | null
          tsheets_user_id?: number
        }
        Relationships: []
      }
      tc_jobcodes: {
        Row: {
          level: string | null
          structure: number
          active: boolean
          billable: boolean
          created_at: string
          default_company: string | null
          default_project: string | null
          edited_in_portal_at: string | null
          external_id: number | null
          folder: boolean
          id: number
          imported_at: string | null
          kind: string
          name: string
          parent_id: number | null
          sort_order: number | null
          when_to_use: string | null
        }
        Insert: {
          level?: string | null
          structure?: number
          active?: boolean
          billable?: boolean
          created_at?: string
          default_company?: string | null
          default_project?: string | null
          edited_in_portal_at?: string | null
          external_id?: number | null
          folder?: boolean
          id?: number
          imported_at?: string | null
          kind?: string
          name: string
          parent_id?: number | null
          sort_order?: number | null
          when_to_use?: string | null
        }
        Update: {
          level?: string | null
          structure?: number
          active?: boolean
          billable?: boolean
          created_at?: string
          default_company?: string | null
          default_project?: string | null
          edited_in_portal_at?: string | null
          external_id?: number | null
          folder?: boolean
          id?: number
          imported_at?: string | null
          kind?: string
          name?: string
          parent_id?: number | null
          sort_order?: number | null
          when_to_use?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_jobcodes_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_pay_period_anchors: {
        Row: {
          anchor: string
          effective_from: string | null
          id: number
          set_at: string
          set_by: string | null
        }
        Insert: {
          anchor: string
          effective_from?: string | null
          id?: number
          set_at?: string
          set_by?: string | null
        }
        Update: {
          anchor?: string
          effective_from?: string | null
          id?: number
          set_at?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_pay_period_anchors_set_by_fkey"
            columns: ["set_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_periods: {
        Row: {
          closed_at: string | null
          end_date: string
          id: number
          kind: string
          start_date: string
        }
        Insert: {
          closed_at?: string | null
          end_date: string
          id?: number
          kind?: string
          start_date: string
        }
        Update: {
          closed_at?: string | null
          end_date?: string
          id?: number
          kind?: string
          start_date?: string
        }
        Relationships: []
      }
      tc_person_cadence: {
        Row: {
          cadence: string
          effective_from: string
          id: number
          one_period: boolean
          person_id: string
          set_at: string
          set_by: string | null
        }
        Insert: {
          cadence: string
          effective_from: string
          id?: number
          one_period?: boolean
          person_id: string
          set_at?: string
          set_by?: string | null
        }
        Update: {
          cadence?: string
          effective_from?: string
          id?: number
          one_period?: boolean
          person_id?: string
          set_at?: string
          set_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_person_cadence_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_person_cadence_set_by_fkey"
            columns: ["set_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_project_donations: {
        Row: {
          amount_usd: number
          created_at: string
          id: number
          month: string
          note: string | null
          project_label: string | null
          updated_at: string
        }
        Insert: {
          amount_usd: number
          created_at?: string
          id?: number
          month: string
          note?: string | null
          project_label?: string | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number
          created_at?: string
          id?: number
          month?: string
          note?: string | null
          project_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tc_project_donations_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          actor_person_id: string | null
          amount_after: number | null
          amount_before: number | null
          at: string
          donation_id: number | null
          id: number
          month: string
          note_after: string | null
          note_before: string | null
          project_label: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          actor_person_id?: string | null
          amount_after?: number | null
          amount_before?: number | null
          at?: string
          donation_id?: number | null
          id?: number
          month: string
          note_after?: string | null
          note_before?: string | null
          project_label?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_person_id?: string | null
          amount_after?: number | null
          amount_before?: number | null
          at?: string
          donation_id?: number | null
          id?: number
          month?: string
          note_after?: string | null
          note_before?: string | null
          project_label?: string | null
        }
        Relationships: []
      }
      tc_project_purchases: {
        Row: {
          amount_usd: number | null
          created_at: string
          hours: number
          id: number
          month: string
          note: string | null
          project_label: string
          rate_usd: number | null
          updated_at: string
        }
        Insert: {
          amount_usd?: number | null
          created_at?: string
          hours: number
          id?: number
          month: string
          note?: string | null
          project_label: string
          rate_usd?: number | null
          updated_at?: string
        }
        Update: {
          amount_usd?: number | null
          created_at?: string
          hours?: number
          id?: number
          month?: string
          note?: string | null
          project_label?: string
          rate_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      tc_project_purchases_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          actor_person_id: string | null
          amount_after: number | null
          amount_before: number | null
          at: string
          hours_after: number | null
          hours_before: number | null
          id: number
          month: string
          note_after: string | null
          note_before: string | null
          project_label: string | null
          purchase_id: number | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          actor_person_id?: string | null
          amount_after?: number | null
          amount_before?: number | null
          at?: string
          hours_after?: number | null
          hours_before?: number | null
          id?: number
          month: string
          note_after?: string | null
          note_before?: string | null
          project_label?: string | null
          purchase_id?: number | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_person_id?: string | null
          amount_after?: number | null
          amount_before?: number | null
          at?: string
          hours_after?: number | null
          hours_before?: number | null
          id?: number
          month?: string
          note_after?: string | null
          note_before?: string | null
          project_label?: string | null
          purchase_id?: number | null
        }
        Relationships: []
      }
      tc_reconciliation: {
        Row: {
          checked_at: string
          id: number
          month: string
          portal_entries: number
          portal_seconds: number
          tsheets_entries: number
          tsheets_seconds: number
        }
        Insert: {
          checked_at?: string
          id?: number
          month: string
          portal_entries?: number
          portal_seconds?: number
          tsheets_entries?: number
          tsheets_seconds?: number
        }
        Update: {
          checked_at?: string
          id?: number
          month?: string
          portal_entries?: number
          portal_seconds?: number
          tsheets_entries?: number
          tsheets_seconds?: number
        }
        Relationships: []
      }
      tc_rollout_people: {
        Row: {
          person_id: string
          set_at: string
          set_by: string | null
          wave: number
        }
        Insert: {
          person_id: string
          set_at?: string
          set_by?: string | null
          wave: number
        }
        Update: {
          person_id?: string
          set_at?: string
          set_by?: string | null
          wave?: number
        }
        Relationships: []
      }
      tc_rollout_waves: {
        Row: {
          starts_on: string | null
          updated_at: string
          updated_by: string | null
          wave: number
        }
        Insert: {
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
          wave: number
        }
        Update: {
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
          wave?: number
        }
        Relationships: []
      }
      tc_safety_events: {
        Row: {
          allowance: string | null
          at: string
          confirmed_at: string | null
          confirmed_end_at: string | null
          entry_id: number | null
          flagged: boolean
          id: number
          jobcode_id: number | null
          kind: string
          person_id: string
          session_started_at: string | null
          stopped_at: string | null
          window_started_at: string
        }
        Insert: {
          allowance?: string | null
          at?: string
          confirmed_at?: string | null
          confirmed_end_at?: string | null
          entry_id?: number | null
          flagged?: boolean
          id?: number
          jobcode_id?: number | null
          kind: string
          person_id: string
          session_started_at?: string | null
          stopped_at?: string | null
          window_started_at: string
        }
        Update: {
          allowance?: string | null
          at?: string
          confirmed_at?: string | null
          confirmed_end_at?: string | null
          entry_id?: number | null
          flagged?: boolean
          id?: number
          jobcode_id?: number | null
          kind?: string
          person_id?: string
          session_started_at?: string | null
          stopped_at?: string | null
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tc_safety_events_entry_id_fkey"
            columns: ["entry_id"]
            referencedRelation: "tc_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_safety_events_jobcode_id_fkey"
            columns: ["jobcode_id"]
            referencedRelation: "tc_jobcodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_safety_events_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_settings: {
        Row: {
          structure_switch_date: string | null
          auto_clockout_hours: number | null
          calculate_overtime: boolean
          daily_regular_hours: number
          default_cadence: string
          import_cutoff_date: string | null
          pay_period_anchor: string | null
          period_type: string
          round_direction: string
          round_enabled: boolean
          round_minutes: number
          singleton_id: number
          split_at_midnight: boolean
          timezone: string
          updated_at: string
          week_start: number
          weekly_regular_hours: number
        }
        Insert: {
          structure_switch_date?: string | null
          auto_clockout_hours?: number | null
          calculate_overtime?: boolean
          daily_regular_hours?: number
          default_cadence?: string
          import_cutoff_date?: string | null
          pay_period_anchor?: string | null
          period_type?: string
          round_direction?: string
          round_enabled?: boolean
          round_minutes?: number
          singleton_id?: number
          split_at_midnight?: boolean
          timezone?: string
          updated_at?: string
          week_start?: number
          weekly_regular_hours?: number
        }
        Update: {
          structure_switch_date?: string | null
          auto_clockout_hours?: number | null
          calculate_overtime?: boolean
          daily_regular_hours?: number
          default_cadence?: string
          import_cutoff_date?: string | null
          pay_period_anchor?: string | null
          period_type?: string
          round_direction?: string
          round_enabled?: boolean
          round_minutes?: number
          singleton_id?: number
          split_at_midnight?: boolean
          timezone?: string
          updated_at?: string
          week_start?: number
          weekly_regular_hours?: number
        }
        Relationships: []
      }
      tc_submissions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          hours_approved_at: string | null
          hours_approved_by: string | null
          id: number
          note: string | null
          period_id: number
          person_id: string
          state: string
          submitted_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          hours_approved_at?: string | null
          hours_approved_by?: string | null
          id?: number
          note?: string | null
          period_id: number
          person_id: string
          state?: string
          submitted_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          hours_approved_at?: string | null
          hours_approved_by?: string | null
          id?: number
          note?: string | null
          period_id?: number
          person_id?: string
          state?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tc_submissions_approved_by_fkey"
            columns: ["approved_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_submissions_hours_approved_by_fkey"
            columns: ["hours_approved_by"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_submissions_period_id_fkey"
            columns: ["period_id"]
            referencedRelation: "tc_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_submissions_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tc_tsheets_archives: {
        Row: {
          archived_at: string | null
          last_error: string | null
          person_id: string
          starts_on: string
          tried_at: string
          tsheets_user_id: number
        }
        Insert: {
          archived_at?: string | null
          last_error?: string | null
          person_id: string
          starts_on: string
          tried_at?: string
          tsheets_user_id: number
        }
        Update: {
          archived_at?: string | null
          last_error?: string | null
          person_id?: string
          starts_on?: string
          tried_at?: string
          tsheets_user_id?: number
        }
        Relationships: []
      }
      tc_user_links: {
        Row: {
          created_at: string
          is_primary: boolean
          person_id: string
          tsheets_user_id: number
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          person_id: string
          tsheets_user_id: number
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          person_id?: string
          tsheets_user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "tc_user_links_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          is_primary: boolean
          person_id: string
          position: string
          team_id: string
        }
        Insert: {
          created_at?: string
          is_primary?: boolean
          person_id: string
          position?: string
          team_id: string
        }
        Update: {
          created_at?: string
          is_primary?: boolean
          person_id?: string
          position?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_tool_grants: {
        Row: {
          audience: string
          created_at: string
          team_id: string
          tool_key: string
          updated_at: string
        }
        Insert: {
          audience?: string
          created_at?: string
          team_id: string
          tool_key: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          team_id?: string
          tool_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_tool_grants_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          id: string
          leader_person_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          leader_person_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          leader_person_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_leader_person_id_fkey"
            columns: ["leader_person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tr_assignments: {
        Row: {
          active: boolean
          client_id: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          hourly_rate: number
          id: number
          justification: string
          person_id: string | null
          tsheets_user_id: number | null
        }
        Insert: {
          active?: boolean
          client_id: number
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          hourly_rate: number
          id?: number
          justification: string
          person_id?: string | null
          tsheets_user_id?: number | null
        }
        Update: {
          active?: boolean
          client_id?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          hourly_rate?: number
          id?: number
          justification?: string
          person_id?: string | null
          tsheets_user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tr_assignments_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "tr_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tr_assignments_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      tr_audit_log: {
        Row: {
          action: string
          after_data: Json
          before_data: Json | null
          changed_at: string
          changed_by: string | null
          entity_id: number
          entity_type: string
          id: number
          justification: string
        }
        Insert: {
          action: string
          after_data: Json
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          entity_id: number
          entity_type: string
          id?: number
          justification: string
        }
        Update: {
          action?: string
          after_data?: Json
          before_data?: Json | null
          changed_at?: string
          changed_by?: string | null
          entity_id?: number
          entity_type?: string
          id?: number
          justification?: string
        }
        Relationships: []
      }
      tr_budgets: {
        Row: {
          budget_amount: number | null
          budget_end_date: string | null
          client_id: number
          created_at: string
          created_by: string | null
          end_date: string | null
          extra_budget: number
          extra_end_date: string | null
          extra_start_date: string | null
          hours_allocated: number | null
          id: number
          justification: string
          start_date: string
        }
        Insert: {
          budget_amount?: number | null
          budget_end_date?: string | null
          client_id: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          extra_budget?: number
          extra_end_date?: string | null
          extra_start_date?: string | null
          hours_allocated?: number | null
          id?: number
          justification: string
          start_date: string
        }
        Update: {
          budget_amount?: number | null
          budget_end_date?: string | null
          client_id?: number
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          extra_budget?: number
          extra_end_date?: string | null
          extra_start_date?: string | null
          hours_allocated?: number | null
          id?: number
          justification?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tr_budgets_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "tr_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      tr_clients: {
        Row: {
          active: boolean
          created_at: string
          id: number
          name: string
          parent_id: number | null
          tsheets_jobcode_id: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: number
          name: string
          parent_id?: number | null
          tsheets_jobcode_id: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: number
          name?: string
          parent_id?: number | null
          tsheets_jobcode_id?: number
        }
        Relationships: []
      }
      tr_project_budgets: {
        Row: {
          client_id: number
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          hours_allocated: number
          id: number
          justification: string
          project: string
        }
        Insert: {
          client_id: number
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          hours_allocated: number
          id?: number
          justification: string
          project: string
        }
        Update: {
          client_id?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          hours_allocated?: number
          id?: number
          justification?: string
          project?: string
        }
        Relationships: [
          {
            foreignKeyName: "tr_project_budgets_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "tr_clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      monday_assignment_events_since: {
        Row: {
          events: number | null
          started_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      access_commit: {
        Args: { p_expected: Json; p_log: Json; p_ops: Json }
        Returns: number
      }
      access_level_of: { Args: { p_person: string }; Returns: string }
      access_sync_role_type: { Args: { p_person: string }; Returns: undefined }
      db_protections_check: { Args: never; Returns: string[] }
      is_admin: { Args: { uid: string }; Returns: boolean }
      merge_monday_links: {
        Args: { loser: string; winner: string }
        Returns: number
      }
      merge_people: { Args: { loser: string; winner: string }; Returns: Json }
      monday_assignment_counts: { Args: never; Returns: Json }
      monday_swap_board_assignments: {
        Args: { p_batch: string; p_board: number }
        Returns: number
      }
      monday_write_board: {
        Args: { p_batch: string; p_board: number; p_events: Json }
        Returns: number
      }
      my_person_id: { Args: never; Returns: string }
      my_work_list: {
        Args: {
          p_accounts: number[]
          p_board_ids: number[]
          p_done_since: string
          p_hidden_accounts: number[]
          p_limit: number
          p_open_only: boolean
        }
        Returns: Json
      }
      next_document_number: { Args: { p_kind: string }; Returns: string }
      portal_can_sign_in: { Args: { p_email: string }; Returns: boolean }
      portal_end_sessions: { Args: { p_user: string }; Returns: undefined }
      portal_two_step_status: {
        Args: { p_user?: string }
        Returns: {
          account_created: string
          cutoff: string
          factor_since: string
          launch: string
          user_id: string
        }[]
      }
      prune_monday_events: { Args: never; Returns: number }
      publishing_remove_target: {
        Args: { p_actor: string; p_id: string; p_week: string }
        Returns: boolean
      }
      publishing_set_target: {
        Args: {
          p_actor: string
          p_board: string
          p_language: string
          p_short: string
          p_value: number
          p_week: string
        }
        Returns: undefined
      }
      report_counted_events: {
        Args: { p_accounts: number[] }
        Returns: {
          board_id: number
          detected_at: string
          due_date: string | null
          event: string
          from_value: string | null
          id: number
          item_id: number
          monday_user_id: number
          occurred_at: string
          people_col: string
          status_done: boolean | null
          to_value: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "monday_assignment_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      report_flow_events: {
        Args: { p_accounts: number[]; p_since: string }
        Returns: Json
      }
      report_hours: {
        Args: { p_people: string[]; p_since: string }
        Returns: Json
      }
      report_jobcode_hours: {
        Args: { p_codes: number[]; p_since: string }
        Returns: Json
      }
      report_open_since: { Args: { p_accounts: number[] }; Returns: Json }
      report_person_hours: {
        Args: { p_person: string; p_since: string }
        Returns: Json
      }
      report_span_events: {
        Args: { p_accounts: number[]; p_since: string }
        Returns: Json
      }
      set_person_teams: {
        Args: { p_person: string; p_teams: Json }
        Returns: undefined
      }
      tc_approves_for: { Args: { target: string }; Returns: boolean }
      tc_field_option_use: {
        Args: { p_field_id: number }
        Returns: {
          entries: number
          label: string
        }[]
      }
      tc_i_approve_hours: { Args: never; Returns: boolean }
      tc_job_field_defaults: {
        Args: { p_keys: string[]; p_since: string }
        Returns: Json
      }
      tc_people_i_approve: { Args: never; Returns: string[] }
      tc_rename_field_option: {
        Args: { p_label: string; p_option_id: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
