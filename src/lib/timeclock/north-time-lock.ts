/**
 * North Time open (owner, 29 October 2026, migration 132): North Time's code
 * runs in production, but nobody uses it there until the owner opens it.
 *
 * One switch, app_settings.north_time_open, changed only by a Super Admin in
 * Company settings > North Time rollout. While it is off:
 *   - every action that records or decides hours refuses, for everyone,
 *     Super Admins included (clock, Add time, week grid, requests, approvals,
 *     invoices, Count it on set-aside TSheets entries);
 *   - North Time's scheduled jobs do nothing, and the import ignores the wave
 *     dates, so it keeps taking every TSheets entry;
 *   - the top-bar clock, Home's clock and timesheet cards and the person-facing
 *     North Time rows are not shown (a Super Admin still opens the pages).
 *
 * Fails closed: an unreadable setting (or a database without the column) is
 * "not open".
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

export const NORTH_TIME_CLOSED = 'North Time is not open yet. Keep recording your hours in TSheets.'

/** What the scheduled jobs answer while North Time is closed. */
export const CLOSED_SKIP = { skipped: 'North Time is not open.' } as const

/** The setting as read: open only when the row says so and nothing went wrong. Pure. */
export function openFrom(data: { north_time_open?: boolean | null } | null | undefined, error: unknown): boolean {
  return !error && data?.north_time_open === true
}

/** Whether North Time is open, once per request. Never throws: any failure reads as closed. */
export const northTimeOpen = cache(async (): Promise<boolean> => {
  try {
    const { data, error } = await createAdminClient().from('app_settings').select('north_time_open').eq('singleton_id', 1).maybeSingle()
    if (error) console.error('[north-time-lock]', error.message)
    return openFrom(data, error)
  } catch (e) {
    console.error('[north-time-lock]', e instanceof Error ? e.message : e)
    return false
  }
})

/** For a write action: the refusal while closed, else null. `fail` keeps each file's own error shape. */
export async function closedRefusal<F>(fail: (error: string) => F): Promise<F | null> {
  return (await northTimeOpen()) ? null : fail(NORTH_TIME_CLOSED)
}
