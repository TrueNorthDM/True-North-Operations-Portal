'use server'

/**
 * Clock safety (design handoff of 16 October 2026, SPEC section 10, Clock
 * Safety.dc.html frames 4A and 4B): every automatic clock-out, for Admins and
 * Super Admins (read only below Super Admin). Reading only: nothing on the
 * page changes hours.
 */

import { loadAccess } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadClockSafety, type SafetyPeriod } from '@/lib/timeclock/clocky-safety-data'
import type { ClockSafetyData, Result } from '@/lib/timeclock/clocky-types'

/** "This month | Last 3 months | All", and the person search. */
export async function getClockSafety(input: { period?: SafetyPeriod; q?: string } = {}): Promise<Result<{ data: ClockSafetyData }>> {
  const access = await loadAccess()
  if (!access.can('ck-safety')) return { ok: false, error: 'Clock safety is not open to your access.' }
  const v = await viewerFor(access)
  if (!v) return { ok: false, error: 'Your login is not linked to anyone in the Directory.' }
  const period: SafetyPeriod = input.period === '3m' || input.period === 'all' ? input.period : 'month'
  try {
    const data = await loadClockSafety(v, new Date(), { period, q: input.q })
    return data ? { ok: true, data } : { ok: false, error: 'Clock safety is not open to your access.' }
  } catch (e) {
    console.error('[clocky safety]', (e as Error).message)
    return { ok: false, error: 'Clock safety could not be read. Try again in a moment.' }
  }
}
