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
      app_settings: {
        Row: {
          monday_account_slug: string | null
          monday_api_token: string | null
          monday_hide_stale_boards: boolean
          monday_webhook_secret: string | null
          singleton_id: number
          tsheets_api_token: string | null
          tsheets_synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          monday_account_slug?: string | null
          monday_api_token?: string | null
          monday_hide_stale_boards?: boolean
          monday_webhook_secret?: string | null
          singleton_id?: number
          tsheets_api_token?: string | null
          tsheets_synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          monday_account_slug?: string | null
          monday_api_token?: string | null
          monday_hide_stale_boards?: boolean
          monday_webhook_secret?: string | null
          singleton_id?: number
          tsheets_api_token?: string | null
          tsheets_synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      sites: {
        Row: {
          code: string
          created_at: string | null
          domain: string
          id: string
          language_paths: Json
          languages: string[]
          monday_board_id: string | null
          monday_column_ids: Json | null
          name: string
          paused_languages: string[]
          wp_dev_url: string | null
          wp_live_url: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          domain: string
          id?: string
          language_paths?: Json
          languages: string[]
          monday_board_id?: string | null
          monday_column_ids?: Json | null
          name: string
          paused_languages?: string[]
          wp_dev_url?: string | null
          wp_live_url?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          domain?: string
          id?: string
          language_paths?: Json
          languages?: string[]
          monday_board_id?: string | null
          monday_column_ids?: Json | null
          name?: string
          paused_languages?: string[]
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
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          end_date: string
          hours_per_day: number
          id: number
          jobcode_id: number
          person_id: string
          reason: string | null
          requested_at: string
          start_date: string
          state: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date: string
          hours_per_day?: number
          id?: number
          jobcode_id: number
          person_id: string
          reason?: string | null
          requested_at?: string
          start_date: string
          state?: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          end_date?: string
          hours_per_day?: number
          id?: number
          jobcode_id?: number
          person_id?: string
          reason?: string | null
          requested_at?: string
          start_date?: string
          state?: string
        }
        Relationships: [
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
      tc_entries: {
        Row: {
          created_at: string
          created_by: string | null
          duration_seconds: number
          ended_at: string | null
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
          source: string
          started_at: string | null
          state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          ended_at?: string | null
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
          source?: string
          started_at?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number
          ended_at?: string | null
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
          source?: string
          started_at?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tc_entries_created_by_fkey"
            columns: ["created_by"]
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
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entry_id?: number | null
          id?: number
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          entry_id?: number | null
          id?: number
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
          active: boolean
          external_id: number | null
          field_id: number
          id: number
          label: string
          position: number
        }
        Insert: {
          active?: boolean
          external_id?: number | null
          field_id: number
          id?: number
          label: string
          position?: number
        }
        Update: {
          active?: boolean
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
          active: boolean
          created_at: string
          external_id: number | null
          id: number
          name: string
          position: number
          required: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          external_id?: number | null
          id?: number
          name: string
          position?: number
          required?: boolean
        }
        Update: {
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
      tc_jobcodes: {
        Row: {
          active: boolean
          billable: boolean
          created_at: string
          external_id: number | null
          id: number
          imported_at: string | null
          kind: string
          name: string
          parent_id: number | null
        }
        Insert: {
          active?: boolean
          billable?: boolean
          created_at?: string
          external_id?: number | null
          id?: number
          imported_at?: string | null
          kind?: string
          name: string
          parent_id?: number | null
        }
        Update: {
          active?: boolean
          billable?: boolean
          created_at?: string
          external_id?: number | null
          id?: number
          imported_at?: string | null
          kind?: string
          name?: string
          parent_id?: number | null
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
      tc_periods: {
        Row: {
          closed_at: string | null
          end_date: string
          id: number
          start_date: string
        }
        Insert: {
          closed_at?: string | null
          end_date: string
          id?: number
          start_date: string
        }
        Update: {
          closed_at?: string | null
          end_date?: string
          id?: number
          start_date?: string
        }
        Relationships: []
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
      tc_settings: {
        Row: {
          auto_clockout_hours: number | null
          calculate_overtime: boolean
          daily_regular_hours: number
          import_cutoff_date: string | null
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
          auto_clockout_hours?: number | null
          calculate_overtime?: boolean
          daily_regular_hours?: number
          import_cutoff_date?: string | null
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
          auto_clockout_hours?: number | null
          calculate_overtime?: boolean
          daily_regular_hours?: number
          import_cutoff_date?: string | null
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
      accessible_site_ids: {
        Args: { uid: string }
        Returns: {
          site_id: string
        }[]
      }
      db_protections_check: { Args: never; Returns: string[] }
      is_admin: { Args: { uid: string }; Returns: boolean }
      merge_monday_links: {
        Args: { loser: string; winner: string }
        Returns: number
      }
      merge_people: { Args: { loser: string; winner: string }; Returns: Json }
      monday_swap_board_assignments: {
        Args: { p_batch: string; p_board: number }
        Returns: number
      }
      my_person_id: { Args: never; Returns: string }
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
      tc_i_approve_hours: { Args: never; Returns: boolean }
      tc_people_i_approve: { Args: never; Returns: string[] }
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
