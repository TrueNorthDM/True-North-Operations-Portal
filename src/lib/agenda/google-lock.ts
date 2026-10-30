/**
 * The new Agenda with Google Calendar (owner, 30 October 2026, migration 134):
 * its code runs in production, but nobody sees it there until a Super Admin
 * opens it in Company settings > Integrations.
 *
 * One switch, app_settings.agenda_google_open. While it is off the Agenda
 * works exactly as before (the New event window, today's rights and the team
 * calendar copy), Agenda settings and booking pages are not found, and every
 * action of the new Agenda refuses.
 *
 * Fails closed: an unreadable setting (or a database without the column) is
 * "not open".
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

export const AGENDA_GOOGLE_CLOSED = 'The new Agenda is not open yet.'

/** The setting as read: open only when the row says so and nothing went wrong. Pure. */
export function openFrom(data: { agenda_google_open?: boolean | null } | null | undefined, error: unknown): boolean {
  return !error && data?.agenda_google_open === true
}

/** Whether the new Agenda is open, once per request. Never throws: any failure reads as closed. */
export const agendaGoogleOpen = cache(async (): Promise<boolean> => {
  try {
    const { data, error } = await createAdminClient().from('app_settings').select('agenda_google_open').eq('singleton_id', 1).maybeSingle()
    if (error) console.error('[agenda-google-lock]', error.message)
    return openFrom(data, error)
  } catch (e) {
    console.error('[agenda-google-lock]', e instanceof Error ? e.message : e)
    return false
  }
})

/** For a write action: the refusal while closed, else null. `fail` keeps each file's own error shape. */
export async function closedRefusal<F>(fail: (error: string) => F): Promise<F | null> {
  return (await agendaGoogleOpen()) ? null : fail(AGENDA_GOOGLE_CLOSED)
}
