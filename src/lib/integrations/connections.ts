/**
 * Whether Google Calendar is connected (Company settings > Integrations, 13A).
 * The credentials live in app_settings, entered by a Super Admin in the
 * portal; only the server reads them, and never sends them to a browser.
 * Until the connection exists, what would go out waits in the outbox as
 * "waiting_connection" and the screens say so.
 *
 * Rippling is not connected (owner, 11 November 2026): it stays the payroll,
 * and Finance enters approved hours and time off there from a portal report.
 *
 * Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { IS_STAGING } from '@/lib/environment'

export interface Connections {
  google: { connected: boolean; account: string | null; teamCalendarId: string | null; connectedBy: string | null; connectedAt: string | null; checkedAt: string | null }
}

export async function loadConnections(): Promise<Connections> {
  const [{ data, error }, { data: office }] = await Promise.all([
    createAdminClient().from('app_settings')
      .select('google_service_account, google_team_calendar_id, google_connected_by, google_connected_at, google_checked_at')
      .eq('singleton_id', 1).maybeSingle(),
    createAdminClient().from('agenda_accounts').select('id').eq('team_calendar', true).eq('source', 'google').eq('status', 'connected').maybeSingle(),
  ])
  if (error) throw new Error(`The connections could not be read: ${error.message}`)
  let account: string | null = null
  if (data?.google_service_account) {
    try { account = (JSON.parse(data.google_service_account) as { client_email?: string }).client_email ?? null } catch { account = null }
  }
  return {
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
