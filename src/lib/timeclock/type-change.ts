/**
 * A contractor becoming a US employee (Clocky part 2, Company Settings.dc.html
 * 10A-3 and 10A-4): the days it can start, what happens around that day, the
 * change waiting, and applying it on the day.
 *
 *   until the day   contractor: the last month closes as their last invoice
 *   from the day    every 2 weeks, by pay period; approved hours to Rippling;
 *                   time off in Requests; reimbursements on a document
 *
 * The cadence is written when it is scheduled (tc_person_cadence, from the
 * day), so the periods are right before it happens; the employment type
 * changes on the day (applyTypeChanges, from the hourly reminders job).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { dateLabel, dayLabel, monthLong } from './format'
import { PAY_PERIOD_DAYS, addDays, payPeriodStart, rangeText } from './periods'

export interface TypeChangeOption { value: string; label: string; date: string; steps: { title: string; text: string }[] }

const longDay = (iso: string) => `${dayLabel(iso)}, ${iso.slice(0, 4)}`

/** The days it can start (Company Settings.dc.html MIG): the next 1st, the pay period start just before it, the 1st after. */
export function typeChangeOptions(today: string, anchor: string | null, invoiceApprover: string): TypeChangeOption[] {
  const [y, m] = today.split('-').map(Number)
  const first = (k: number) => new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 10)
  // The pay period start closest to the next 1st, on or before it (and after today).
  const ppStart = anchor ? (() => { const s = payPeriodStart(first(1), anchor); return s > today ? s : null })() : null
  const days: { date: string; kind: 'month' | 'pay' }[] = [{ date: first(1), kind: 'month' }]
  if (ppStart && ppStart !== first(1)) days.push({ date: ppStart, kind: 'pay' })
  days.push({ date: first(2), kind: 'month' })
  const tail = { title: 'From then on', text: 'No more invoices. Time off is asked in Requests, with balances from Rippling. Reimbursements go on a reimbursement document for Finance.' }
  return days.map(({ date, kind }) => {
    const before = addDays(date, -1)
    const monthStartBefore = `${before.slice(0, 7)}-01`
    const onPay = !!anchor && payPeriodStart(date, anchor) === date
    let steps: TypeChangeOption['steps']
    if (onPay) {
      steps = [
        { title: `Until ${dayLabel(before)}: contractor`, text: before.slice(8) === new Date(Date.UTC(Number(before.slice(0, 4)), Number(before.slice(5, 7)), 0)).toISOString().slice(8, 10)
          ? `${monthLong(before)} closes monthly. Submitting it makes their last invoice, approved by ${invoiceApprover}; reimbursements approved until then go on it.`
          : `${monthLong(before)} closes early, ${rangeText(monthStartBefore, before)}, as their last invoice, approved by ${invoiceApprover}.` },
        { title: `From ${dayLabel(date)}: every 2 weeks`, text: `Their first pay period is ${rangeText(date, addDays(date, PAY_PERIOD_DAYS - 1))}. Approved hours go to Rippling.` },
        tail,
      ]
    } else {
      const ppEnd = anchor ? addDays(payPeriodStart(date, anchor), PAY_PERIOD_DAYS - 1) : null
      steps = [
        { title: `Until ${dayLabel(before)}: contractor`, text: `${monthLong(before)} closes monthly. Submitting it makes their last invoice, approved by ${invoiceApprover}; reimbursements approved until then go on it.` },
        ...(ppEnd ? [
          { title: `${rangeText(date, ppEnd)}: first pay period, short`, text: `The pay period ${rangeText(payPeriodStart(date, anchor!), ppEnd)} has already started, so their first one is ${rangeText(date, ppEnd)}. Approved hours go to Rippling.` },
          { title: `From ${dayLabel(addDays(ppEnd, 1))}: every 2 weeks`, text: tail.text },
        ] : [tail]),
      ]
    }
    return { value: date, date, label: `${longDay(date)} (first day of ${kind === 'pay' || onPay ? 'a pay period' : 'a month'})`, steps }
  })
}

/** The change waiting for a person, if any. */
export async function loadTypeChange(personId: string): Promise<{ id: number; effectiveOn: string; label: string } | null> {
  const { data, error } = await createAdminClient().from('people_type_changes').select('id, effective_on').eq('person_id', personId).eq('state', 'scheduled').maybeSingle()
  // Unread is not "none": the page would offer to schedule a change that is already waiting.
  if (error) throw new Error(`The scheduled change could not be read: ${error.message}`)
  return data ? { id: data.id, effectiveOn: data.effective_on, label: longDay(data.effective_on) } : null
}

/** On the day: the contractor becomes a US employee, and their history says so. Safe to run again. */
export async function applyTypeChanges(today: string): Promise<number> {
  const c = createAdminClient()
  const { data, error: listErr } = await c.from('people_type_changes').select('id, person_id, effective_on, scheduled_by').eq('state', 'scheduled').lte('effective_on', today)
  // Said, not thrown: the hourly reminders still go, and the change is applied on the next run.
  if (listErr) { console.error('[type change]', listErr.message); return 0 }
  let n = 0
  for (const t of data ?? []) {
    const { data: p, error: pErr } = await c.from('people').select('employment_history').eq('id', t.person_id).maybeSingle()
    // Unread, the history would be written over with this one line: left for the next run.
    if (pErr) { console.error('[type change]', pErr.message); continue }
    const line = `${dateLabel(t.effective_on)}: contractor to US Employee (North Time).`
    const history = [p?.employment_history?.trim(), line].filter(Boolean).join('\n')
    const { error } = await c.from('people').update({ employment_type: 'us', employment_history: history }).eq('id', t.person_id)
    if (error) { console.error('[type change]', error.message); continue }
    await c.from('people_type_changes').update({ state: 'applied', applied_at: new Date().toISOString() }).eq('id', t.id)
    n++
  }
  return n
}
