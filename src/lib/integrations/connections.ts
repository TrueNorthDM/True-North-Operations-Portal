/**
 * Whether Rippling and Google Calendar are connected (Company settings >
 * Integrations, 13A). The credentials live in app_settings, entered by a
 * Super Admin in the portal; only the server reads them, and never sends them
 * to a browser. Until a connection exists, what would go out waits in the
 * outbox as "waiting_connection" and the screens say so.
 *
 * Rippling: what the portal must send there (time off, hours by day) is an
 * open question for the owner, so a saved token does not yet make it
 * "connected": the jobs keep waiting instead of failing one by one. When the
 * calls are written, RIPPLING_CALLS_WRITTEN turns true in the same change.
 *
 * Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { IS_STAGING } from '@/lib/environment'

export const RIPPLING_CALLS_WRITTEN = false

export interface Connections {
  rippling: { connected: boolean; tokenSaved: boolean; tokenEnd: string | null; connectedBy: string | null; connectedAt: string | null }
  google: { connected: boolean; account: string | null; teamCalendarId: string | null; connectedBy: string | null; connectedAt: string | null; checkedAt: string | null }
}

export async function loadConnections(): Promise<Connections> {
  const [{ data, error }, { data: office }] = await Promise.all([
    createAdminClient().from('app_settings')
      .select('rippling_api_token, rippling_connected_by, rippling_connected_at, google_service_account, google_team_calendar_id, google_connected_by, google_connected_at, google_checked_at')
      .eq('singleton_id', 1).maybeSingle(),
    createAdminClient().from('agenda_accounts').select('id').eq('team_calendar', true).eq('source', 'google').eq('status', 'connected').maybeSingle(),
  ])
  if (error) throw new Error(`The connections could not be read: ${error.message}`)
  let account: string | null = null
  if (data?.google_service_account) {
    try { account = (JSON.parse(data.google_service_account) as { client_email?: string }).client_email ?? null } catch { account = null }
  }
  return {
    rippling: {
      connected: !!data?.rippling_api_token && RIPPLING_CALLS_WRITTEN, tokenSaved: !!data?.rippling_api_token,
      tokenEnd: data?.rippling_api_token ? data.rippling_api_token.slice(-4) : null, connectedBy: data?.rippling_connected_by ?? null, connectedAt: data?.rippling_connected_at ?? null,
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
