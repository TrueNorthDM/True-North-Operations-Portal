'use server'

/**
 * North Time > Reports > Time off balances: Finance loads Rippling's Time off
 * balances report (owner, 23 November 2026; lib/timeclock/rippling-balances.ts).
 * The file is read in the browser; what arrives here is each person's two
 * numbers and the report's day. Super Admins and Finance only, never during a
 * View Stage preview, written with the privileged client.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, loadClockySettings } from '@/lib/timeclock/clocky-context'
import { localDate } from '@/lib/timeclock/format'
import { canSeePayroll } from '@/lib/timeclock/payroll-summary-data'
import { PAID_KINDS } from '@/lib/timeclock/time-off-rules'
import type { Result } from '@/lib/timeclock/clocky-types'

const fail = (error: string) => ({ ok: false as const, error })

export async function saveBalances(input: { asOf: string; people: { personId: string; vacation: number | null; sick: number | null }[] }): Promise<Result<{ toast: string }>> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to load balances.')
  const access = await writerAccess()
  if (!access?.personId) return fail('Sign in again to save.')
  if (!access.can('clocky-reports') || !(await canSeePayroll(access))) return fail('Balances are loaded by Finance and Super Admins.')
  try {
    const asOf = String(input.asOf ?? '')
    const today = localDate(new Date(), (await loadClockySettings()).companyZone)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) return fail('Say the day of the report.')
    if (asOf > today) return fail('The day of the report cannot be after today.')
    const people = Array.isArray(input.people) ? input.people.slice(0, 500) : []
    if (!people.length) return fail('The report has nobody to load.')
    const c = db()
    const ids = [...new Set(people.map(p => String(p.personId)))]
    const { data: known, error: readErr } = await c.from('people').select('id').in('id', ids).eq('employment_type', 'us')
    if (readErr) throw new Error(readErr.message)
    const ok = new Set((known ?? []).map(p => p.id))
    const rows: { person_id: string; kind: string; hours: number; as_of: string; loaded_by: string; loaded_at: string }[] = []
    const now = new Date().toISOString()
    for (const p of people) {
      if (!ok.has(p.personId)) return fail('Someone in the report is not a US employee in the Directory. Load the file again.')
      for (const kind of PAID_KINDS) {
        const hours = p[kind]
        if (hours == null) continue
        if (!Number.isFinite(hours) || hours < -500 || hours > 5000) return fail('A balance in the report is not a number of hours.')
        rows.push({ person_id: p.personId, kind, hours: Math.round(hours * 100) / 100, as_of: asOf, loaded_by: access.personId, loaded_at: now })
      }
    }
    // A person in the report keeps only what the report has: a kind it leaves out (no Vacation yet) is taken away.
    const { error: delErr } = await c.from('tc_time_off_balances').delete().in('person_id', ids)
    if (delErr) throw new Error(delErr.message)
    if (rows.length) {
      const { error } = await c.from('tc_time_off_balances').insert(rows)
      if (error) throw new Error(error.message)
    }
    revalidatePath('/clocky-hours/reports/balances'); revalidatePath('/requests', 'layout'); revalidatePath('/clocky-hours/approvals')
    return { ok: true, toast: `Balances loaded for ${ids.length} ${ids.length === 1 ? 'person' : 'people'}.` }
  } catch (e) {
    console.error('[balances]', e instanceof Error ? e.message : e)
    return fail('Not saved. Try again in a moment.')
  }
}
