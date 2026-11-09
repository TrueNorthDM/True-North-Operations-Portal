/**
 * Whether Rippling and Google Calendar are connected (Company settings >
 * Integrations, 13A). The credentials live in app_settings, entered by a
 * Super Admin in the portal; only the server reads them, and never sends them
 * to a browser. Until a connection exists, what would go out waits in the
 * outbox as "waiting_connection" and the screens say so.
 *
 * Rippling (owner, 9 November 2026): approved time off and employees' approved
 * hours go out with the saved token (lib/integrations/rippling-send.ts). Never
 * from staging: its data is a copy, and Rippling is the real payroll.
 *
 * Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { IS_STAGING } from '@/lib/environment'

export const RIPPLING_CALLS_WRITTEN = true

export interface Connections {
  rippling: { connected: boolean; tokenSaved: boolean; tokenEnd: string | null; connectedBy: string | null; connectedAt: string | null; connectedAs: string | null; matched: number; staging: boolean }
  google: { connected: boolean; account: string | null; teamCalendarId: string | null; connectedBy: string | null; connectedAt: string | null; checkedAt: string | null }
}

export async function loadConnections(): Promise<Connections> {
  const [{ data, error }, { data: office }] = await Promise.all([
    createAdminClient().from('app_settings')
      .select('rippling_api_token, rippling_connected_by, rippling_connected_at, rippling_connected_as, google_service_account, google_team_calendar_id, google_connected_by, google_connected_at, google_checked_at')
      .eq('singleton_id', 1).maybeSingle(),
    createAdminClient().from('agenda_accounts').select('id').eq('team_calendar', true).eq('source', 'google').eq('status', 'connected').maybeSingle(),
  ])
  // How many people are matched to their Rippling worker (Match people, Company settings).
  const { count: matched } = await createAdminClient().from('people').select('id', { count: 'exact', head: true }).eq('status', 'active').not('rippling_worker_id', 'is', null)
  if (error) throw new Error(`The connections could not be read: ${error.message}`)
  let account: string | null = null
  if (data?.google_service_account) {
    try { account = (JSON.parse(data.google_service_account) as { client_email?: string }).client_email ?? null } catch { account = null }
  }
  return {
    rippling: {
      connected: !!data?.rippling_api_token && RIPPLING_CALLS_WRITTEN && !IS_STAGING, tokenSaved: !!data?.rippling_api_token,
      tokenEnd: data?.rippling_api_token ? data.rippling_api_token.slice(-4) : null, connectedBy: data?.rippling_connected_by ?? null, connectedAt: data?.rippling_connected_at ?? null,
      connectedAs: data?.rippling_connected_as ?? null, matched: matched ?? 0, staging: IS_STAGING,
    },
    google: {
      // office@ connected by Google sign-in (Agenda settings) is the team calendar too (31 October 2026).
      // Not on staging: its office@ is the real one, and staging's time off carries real names, so
      // it waits there until the owner decides (open question, 31 October 2026).
      connected: (!!data?.google_service_account && !!data.google_team_calendar_id) || (!!office && !IS_STAGING), account,
      teamCalendarId: data?.google_team_calendar_id ?? null,
      connectedBy: data?.google_connected_by ?? null, connectedAt: data?.google_connected_at ?? null, checkedAt: data?.google_checked_at ?? null,
    },
  }
}
