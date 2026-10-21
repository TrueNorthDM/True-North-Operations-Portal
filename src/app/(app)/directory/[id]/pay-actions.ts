'use server'

/**
 * Saving "Pay and hours" (Clocky part 2, frame 10A-1) from a person's Work
 * tab, and the same values from Rates & Costs (10A-2). Whoever keeps Rates &
 * Costs (d-rates) changes them, as the real person signed in, never during a
 * View Stage preview. The money is where Rates & Costs keeps it: the hourly
 * rate is people.internal_rate ("Rate / cost"), the fixed amount
 * people.monthly_salary ("Month / salary"); Pays as and the allowance are
 * pay_terms. Every change keeps its before and after in pay_terms_changes.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaysAs } from '@/lib/timeclock/routing'

type Result = { ok: true } | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAYS: readonly PaysAs[] = ['hourly', 'fixed_monthly', 'fixed_no_timesheet']

export interface PayInput {
  /** Contractors only; null for an employee (only the allowance is theirs to set). */
  paysAs: PaysAs | null
  /** The rate an hour (hourly) or the amount a month (fixed). */
  amount: number | null
  allowance: { hours: number; period: 'week' | 'month' } | null
  reason?: string
}

export async function savePayTerms(personId: string, input: PayInput): Promise<Result> {
  if (await getViewAs()) return { ok: false, error: 'View Stage is only a preview. Close it to save.' }
  const access = await writerAccess()
  if (!access) return { ok: false, error: 'Sign in again to save.' }
  if (!access.can('directory') || !access.can('d-rates')) return { ok: false, error: 'Only whoever keeps Rates & Costs changes pay.' }
  if (!UUID.test(personId)) return { ok: false, error: 'Person not found.' }

  const c = createAdminClient()
  const { data: person, error: pErr } = await c.from('people').select('id, employment_type, internal_rate, monthly_salary').eq('id', personId).maybeSingle()
  if (pErr) return { ok: false, error: 'Not saved. Try again in a moment.' }
  if (!person) return { ok: false, error: 'Person not found.' }
  const contractor = person.employment_type === 'contractor'

  // What may be saved for whom.
  const paysAs = contractor ? input.paysAs : null
  if (contractor && (!paysAs || !PAYS.includes(paysAs))) return { ok: false, error: 'Choose how they are paid.' }
  const amount = input.amount === null ? null : Math.round(Number(input.amount) * 100) / 100
  if (contractor && (amount === null || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000)) {
    return { ok: false, error: paysAs === 'hourly' ? 'Type the rate an hour.' : 'Type the amount a month.' }
  }
  const al = input.allowance
  if (al && (!['week', 'month'].includes(al.period) || !Number.isFinite(al.hours) || al.hours <= 0 || al.hours > (al.period === 'week' ? 168 : 744))) {
    return { ok: false, error: 'Type the hours of the allowance.' }
  }

  const { data: before } = await c.from('pay_terms').select('pays_as, allowance_hours, allowance_period').eq('person_id', personId).maybeSingle()
  const hourly = paysAs === 'hourly'
  const row = {
    person_id: personId,
    pays_as: paysAs,
    allowance_hours: al ? al.hours : null,
    allowance_period: al ? al.period : null,
    updated_by: access.personId,
    updated_at: new Date().toISOString(),
  }
  const { error: tErr } = await c.from('pay_terms').upsert(row, { onConflict: 'person_id' })
  if (tErr) return { ok: false, error: 'Not saved. Try again in a moment.' }
  // The other amount is kept, so switching back finds it.
  const moneyCol = hourly ? 'internal_rate' : 'monthly_salary'
  if (contractor && amount !== (person[moneyCol] === null ? null : Number(person[moneyCol]))) {
    const { error: rErr } = await c.from('people').update(hourly ? { internal_rate: amount } : { monthly_salary: amount }).eq('id', personId)
    if (rErr) return { ok: false, error: 'The amount was not saved. Try again in a moment.' }
  }
  const { error: hErr } = await c.from('pay_terms_changes').insert({
    person_id: personId,
    before: { ...(before ?? {}), hourly_rate: person.internal_rate, monthly_amount: person.monthly_salary },
    after: {
      pays_as: row.pays_as, allowance_hours: row.allowance_hours, allowance_period: row.allowance_period,
      hourly_rate: contractor && hourly ? amount : person.internal_rate, monthly_amount: contractor && !hourly ? amount : person.monthly_salary,
    },
    reason: input.reason?.trim() || null,
    changed_by: access.personId,
  })
  if (hErr) console.error('[pay terms] history not written:', hErr.message)

  revalidatePath(`/directory/${personId}`)
  revalidatePath('/directory')
  return { ok: true }
}

/**
 * Rates & Costs (10A-2): Pays as and the allowance only. The rate and the
 * monthly amount are saved by the table's own fields (savePersonCostRate,
 * savePersonMonthlySalary), so this never touches money.
 */
export async function savePaysAndAllowance(personId: string, input: Pick<PayInput, 'paysAs' | 'allowance'>): Promise<Result> {
  if (await getViewAs()) return { ok: false, error: 'View Stage is only a preview. Close it to save.' }
  const access = await writerAccess()
  if (!access) return { ok: false, error: 'Sign in again to save.' }
  if (!access.can('directory') || !access.can('d-rates')) return { ok: false, error: 'Only whoever keeps Rates & Costs changes pay.' }
  if (!UUID.test(personId)) return { ok: false, error: 'Person not found.' }
  const c = createAdminClient()
  const { data: person } = await c.from('people').select('id, full_name, employment_type').eq('id', personId).maybeSingle()
  if (!person) return { ok: false, error: 'Person not found.' }
  const contractor = person.employment_type === 'contractor'
  const paysAs = contractor ? input.paysAs : null
  if (contractor && (!paysAs || !PAYS.includes(paysAs))) return { ok: false, error: `Choose how ${person.full_name} is paid.` }
  const al = input.allowance
  if (al && (!['week', 'month'].includes(al.period) || !Number.isFinite(al.hours) || al.hours <= 0 || al.hours > (al.period === 'week' ? 168 : 744))) {
    return { ok: false, error: 'Type the hours of the allowance.' }
  }
  const { data: before } = await c.from('pay_terms').select('pays_as, allowance_hours, allowance_period').eq('person_id', personId).maybeSingle()
  const row = { person_id: personId, pays_as: paysAs, allowance_hours: al ? al.hours : null, allowance_period: al ? al.period : null, updated_by: access.personId, updated_at: new Date().toISOString() }
  const { error } = await c.from('pay_terms').upsert(row, { onConflict: 'person_id' })
  if (error) return { ok: false, error: 'Not saved. Try again in a moment.' }
  const { error: hErr } = await c.from('pay_terms_changes').insert({
    person_id: personId, before: before ?? null,
    after: { pays_as: row.pays_as, allowance_hours: row.allowance_hours, allowance_period: row.allowance_period },
    reason: 'Updated in Rates & Costs', changed_by: access.personId,
  })
  if (hErr) console.error('[pay terms] history not written:', hErr.message)
  revalidatePath('/directory')
  revalidatePath(`/directory/${personId}`)
  return { ok: true }
}
