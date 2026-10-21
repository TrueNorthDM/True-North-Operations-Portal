/**
 * Whether Rippling and Google Calendar are connected (Company settings >
 * Integrations, 13A). The credentials live in app_settings, entered by a
 * Super Admin in the portal; only the server reads them, and never sends them
 * to a browser. Until a connection exists, what would go out waits in the
 * outbox as "waiting_connection" and the screens say so.
 *
 * Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface Connections {
  rippling: { connected: boolean; connectedAs: string | null; checkedAt: string | null }
  google: { connected: boolean; teamCalendarId: string | null; goodNewsCalendarId: string | null; checkedAt: string | null }
}

export async function loadConnections(): Promise<Connections> {
  const { data, error } = await createAdminClient().from('app_settings')
    .select('rippling_api_token, rippling_connected_as, rippling_checked_at, google_service_account, google_team_calendar_id, google_good_news_calendar_id, google_checked_at')
    .eq('singleton_id', 1).maybeSingle()
  if (error) throw new Error(`The connections could not be read: ${error.message}`)
  return {
    rippling: { connected: !!data?.rippling_api_token, connectedAs: data?.rippling_connected_as ?? null, checkedAt: data?.rippling_checked_at ?? null },
    google: { connected: !!data?.google_service_account, teamCalendarId: data?.google_team_calendar_id ?? null, goodNewsCalendarId: data?.google_good_news_calendar_id ?? null, checkedAt: data?.google_checked_at ?? null },
  }
}
