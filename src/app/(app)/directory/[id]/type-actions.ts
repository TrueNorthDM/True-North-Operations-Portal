'use server'

/**
 * A contractor becoming a US employee (Clocky part 2, Company Settings.dc.html
 * 10A-3, 10A-4): Super Admins schedule it from a person's Work tab, or cancel
 * it before the day. Scheduling writes the new cadence from that day (every 2
 * weeks) and tells whoever they report to and Finance; the employment type
 * changes on the day (lib/timeclock/type-change.ts). As the real person signed
 * in, never during a View Stage preview.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadClockySettings, loadDirectory } from '@/lib/timeclock/clocky-context'
import { localDate } from '@/lib/timeclock/format'
import { loadRouteSettings, loadRoutes } from '@/lib/timeclock/pay-terms'
import { invoiceApprover } from '@/lib/timeclock/routing'
import { anchorOn } from '@/lib/timeclock/periods'
import { typeChangeOptions } from '@/lib/timeclock/type-change'
import { notifyClockyTypeChange } from '@/lib/notifications/run'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function superAdmin() {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to save.')
  const access = await writerAccess()
  if (!access) return no('Sign in again to save.')
  if (!access.isSuperAdmin) return no('Only Super Admins change a contractor into an employee.')
  return access
}

export async function scheduleEmployee(personId: string, input: { date: string; note?: string }): Promise<Done> {
  const access = await superAdmin()
  if ('ok' in access) return access
  if (!UUID.test(personId)) return no('Person not found.')
  try {
    const c = createAdminClient()
    const [routes, settings, clocky, dir] = await Promise.all([loadRoutes([personId]), loadRouteSettings(), loadClockySettings(), loadDirectory()])
    const route = routes.get(personId)
    if (!route?.isContractor) return no('Only a contractor becomes an employee here.')
    const today = localDate(new Date(), 'America/New_York')
    const anchor = anchorOn(input.date, clocky.anchors)?.anchor ?? null
    const ib = invoiceApprover(route, settings)
    const option = typeChangeOptions(today, anchor, ib ? dir.nameOf(ib) : 'the invoice approver').find(o => o.date === input.date)
    if (!option) return no('Pick one of the days offered: a 1st of a month or the first day of a pay period.')
    const { data: made, error } = await c.from('people_type_changes').insert({ person_id: personId, to_type: 'us', effective_on: option.date, note: String(input.note ?? '').trim().slice(0, 500) || null, scheduled_by: access.personId }).select('id').single()
    if (error) return no(error.code === '23505' ? 'A change is already scheduled for them. Cancel it first.' : 'Not saved. Try again in a moment.')
    // From that day they submit every 2 weeks, by pay period. The changes already planned are
    // kept aside first: should the new one fail, they go back as they were.
    const { data: planned, error: pErr } = await c.from('tc_person_cadence').select('person_id, cadence, effective_from, one_period, set_by, set_at').eq('person_id', personId).gt('effective_from', today)
    const undo = async () => {
      await c.from('people_type_changes').delete().eq('id', made.id)
      if (planned?.length) await c.from('tc_person_cadence').upsert(planned, { onConflict: 'person_id,effective_from' })
    }
    if (pErr) { await undo(); return no('Not saved. Try again in a moment.') }
    const { error: dErr } = await c.from('tc_person_cadence').delete().eq('person_id', personId).gt('effective_from', today)
    const { error: cErr } = dErr ? { error: dErr } : await c.from('tc_person_cadence').insert({ person_id: personId, cadence: 'biweekly', effective_from: option.date, one_period: false, set_by: access.personId })
    if (cErr) {
      await undo()
      console.error('[type change] cadence:', cErr.message)
      return no('Not saved. Try again in a moment.')
    }
    const who = dir.nameOf(personId)
    const label = option.label.replace(/ \(.*\)$/, '')
    await notifyClockyTypeChange({ changeId: made.id, personId, to: [...(route.reportsTo ? [route.reportsTo] : []), ...settings.finance], text: `${who} becomes an employee on ${label}`, body: option.steps[0]?.text ?? '' })
    revalidatePath(`/directory/${personId}`)
    const told = [route.reportsTo ? dir.nameOf(route.reportsTo) : null, settings.finance.length ? 'Finance' : null].filter(Boolean)
    return { ok: true, toast: `Scheduled. ${who} becomes an employee on ${label}.${told.length ? ` ${told.join(' and ')} ${told.length > 1 ? 'were' : 'was'} told.` : ''}` }
  } catch (e) {
    console.error('[type change]', e instanceof Error ? e.message : e)
    return no('Not saved. Try again in a moment.')
  }
}

export async function cancelEmployeeChange(personId: string): Promise<Done> {
  const access = await superAdmin()
  if ('ok' in access) return access
  if (!UUID.test(personId)) return no('Person not found.')
  const c = createAdminClient()
  const { data, error } = await c.from('people_type_changes').update({ state: 'cancelled', cancelled_by: access.personId, cancelled_at: new Date().toISOString() })
    .eq('person_id', personId).eq('state', 'scheduled').select('effective_on')
  if (error) return no('Not saved. Try again in a moment.')
  const t = data?.[0]
  if (!t) return no('No change is waiting for them.')
  await c.from('tc_person_cadence').delete().eq('person_id', personId).eq('effective_from', t.effective_on).eq('cadence', 'biweekly')
  revalidatePath(`/directory/${personId}`)
  return { ok: true, toast: `Change cancelled. ${(await loadDirectory()).nameOf(personId)} stays a contractor.` }
}
