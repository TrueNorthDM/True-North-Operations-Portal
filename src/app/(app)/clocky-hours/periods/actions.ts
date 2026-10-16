'use server'

/**
 * Timesheet periods (design handoff of 16 October 2026, SPEC 11A, Timesheet
 * Periods.dc.html frames 5A to 5C): Company settings' section, the person's
 * Work tab and Directory > Rates & Costs share these.
 *
 * Reading: whoever has Company settings > Timesheet periods (cs-periods).
 * Changing the pay period start, the default for new people, or how someone
 * submits: Super Admins (cs-periods-edit). Every change keeps the past as it
 * was (lib/timeclock/periods.ts): a person's current period closes the way it
 * started, and periods already submitted keep their dates. The previews give
 * the exact dates for the confirm dialogs before anything is saved.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess, writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { allRows, db, loadClockySettings, loadDirectory, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { lastSubmittedPayEnd, loadTimesheetPeriods, previewAnchor, previewCadence, type AnchorPreview, type CadencePreview } from '@/lib/timeclock/clocky-periods-data'
import { localDate } from '@/lib/timeclock/format'
import { anchorMove, type Cadence } from '@/lib/timeclock/periods'
import type { Fail, Result, TimesheetPeriodsData } from '@/lib/timeclock/clocky-types'

const NOT_SAVED = 'Not saved. Try again in a moment.'
const SUPER_ONLY = 'Only a Super Admin changes the timesheet periods.'
const fail = (error: string): Fail => ({ ok: false, error })
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false
function notSaved(e: unknown): Fail {
  console.error('[clocky periods]', e instanceof Error ? e.message : e)
  return fail(NOT_SAVED)
}
const refresh = () => { revalidatePath('/admin/settings'); revalidatePath('/directory'); revalidatePath('/clocky-hours') }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const asCadence = (x: unknown): Cadence | null => (x === 'monthly' || x === 'biweekly' ? x : null)

async function editor(): Promise<Viewer | Fail> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to change the timesheet periods.')
  const access = await writerAccess()
  if (!access) return fail('Sign in again to save.')
  if (!access.can('cs-periods-edit')) return fail(SUPER_ONLY)
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}

/** 5A: the pay period start and its periods, the default, and who submits how (also 5B and 5C's pills). */
export async function getTimesheetPeriods(): Promise<Result<{ data: TimesheetPeriodsData }>> {
  const access = await loadAccess()
  if (!access.can('cs-periods') && !access.can('cs-periods-edit')) return fail('Timesheet periods is not open to your access.')
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    const data = await loadTimesheetPeriods(v, new Date())
    return data ? { ok: true, data } : fail('Timesheet periods is not open to your access.')
  } catch (e) {
    console.error('[clocky periods] read:', (e as Error).message)
    return fail('The timesheet periods could not be read. Try again in a moment.')
  }
}

/** 5A, before Done: what moving the start date would do (the amber line and "Move the pay periods?"). */
export async function previewAnchorMove(input: { anchor: string }): Promise<Result<{ data: AnchorPreview }>> {
  const access = await loadAccess()
  if (!access.can('cs-periods-edit')) return fail(SUPER_ONLY)
  if (!ISO_DATE.test(String(input.anchor ?? ''))) return fail('Pick a date.')
  try {
    return { ok: true, data: await previewAnchor(new Date(), input.anchor) }
  } catch (e) {
    console.error('[clocky periods] preview:', (e as Error).message)
    return fail('The pay periods could not be worked out. Try again in a moment.')
  }
}

/**
 * Set or move the pay period start. Periods anyone already submitted keep
 * their dates: the new dates start the day after the last one, and the days
 * up to the first new period close as one period.
 */
export async function setPayPeriodAnchor(input: { anchor: string }): Promise<Result<{ effectiveFrom: string | null }>> {
  const v = await editor()
  if (isFail(v)) return v
  if (!ISO_DATE.test(String(input.anchor ?? ''))) return fail('Pick a date.')
  try {
    const c = db()
    const settings = await loadClockySettings()
    const now = new Date()
    const today = localDate(now, settings.companyZone)
    const plan = anchorMove(today, settings.anchors, input.anchor, await lastSubmittedPayEnd(c))
    const { count, error: countErr } = await c.from('tc_pay_period_anchors').select('id', { count: 'exact', head: true })
    if (countErr) return notSaved(countErr)
    const rows: { anchor: string; effective_from: string | null; set_by: string }[] = []
    if (plan.effectiveFrom === null) {
      // The first start date ever set: it counts for every day.
      const { error } = await c.from('tc_pay_period_anchors').delete().gte('id', 0)
      if (error) return notSaved(error)
    } else if (!count && settings.anchor) {
      // The setting alone, before any move was recorded: it stays in force before the move.
      rows.push({ anchor: settings.anchor, effective_from: null, set_by: v.personId })
    } else {
      // Moves the new one replaces go; those already in force stay.
      const { error } = await c.from('tc_pay_period_anchors').delete().gte('effective_from', plan.effectiveFrom)
      if (error) return notSaved(error)
    }
    rows.push({ anchor: input.anchor, effective_from: plan.effectiveFrom, set_by: v.personId })
    const { error } = await c.from('tc_pay_period_anchors').insert(rows)
    if (error) return notSaved(error)
    const { error: sErr } = await c.from('tc_settings').update({ pay_period_anchor: input.anchor, updated_at: now.toISOString() }).eq('singleton_id', 1)
    if (sErr) return notSaved(sErr)
    refresh()
    return { ok: true, effectiveFrom: plan.effectiveFrom }
  } catch (e) {
    return notSaved(e)
  }
}

/**
 * The cadence new people start with (5A). Everyone with no cadence of their
 * own is first pinned to the old default, so changing it moves nobody already
 * here (and so never cuts anyone's period in half).
 */
export async function setDefaultCadence(input: { cadence: Cadence }): Promise<Result> {
  const v = await editor()
  if (isFail(v)) return v
  const cadence = asCadence(input.cadence)
  if (!cadence) return fail('Choose Monthly or Every 2 weeks.')
  try {
    const c = db()
    const [settings, dir] = await Promise.all([loadClockySettings(), loadDirectory()])
    if (cadence === settings.defaultCadence) return { ok: true }
    if (cadence === 'biweekly' && !settings.anchor) return fail('Set the day pay periods start first.')
    const pinned = new Set((await allRows<{ person_id: string }>((a, b) => c.from('tc_person_cadence').select('person_id').order('id').range(a, b), 'How people submit could not be read')).map(r => r.person_id))
    const pins = [...dir.people.keys()].filter(id => !pinned.has(id))
      .map(id => ({ person_id: id, cadence: settings.defaultCadence, effective_from: '2017-01-01', set_by: v.personId }))
    for (let i = 0; i < pins.length; i += 500) {
      const { error } = await c.from('tc_person_cadence').insert(pins.slice(i, i + 500))
      if (error) return notSaved(error)
    }
    const { error } = await c.from('tc_settings').update({ default_cadence: cadence, updated_at: new Date().toISOString() }).eq('singleton_id', 1)
    if (error) return notSaved(error)
    refresh()
    return { ok: true }
  } catch (e) {
    return notSaved(e)
  }
}

/** 5B's "starts" line and 5C's "Change how these people submit?": old → new and the dates, per person. */
export async function previewCadenceChange(input: { personIds: string[]; cadence: Cadence }): Promise<Result<{ data: CadencePreview[] }>> {
  const access = await loadAccess()
  if (!access.can('cs-periods-edit')) return fail(SUPER_ONLY)
  const cadence = asCadence(input.cadence)
  if (!cadence) return fail('Choose Monthly or Every 2 weeks.')
  try {
    return { ok: true, data: await previewCadence(new Date(), (input.personIds ?? []).map(String), cadence) }
  } catch (e) {
    console.error('[clocky periods] preview cadence:', (e as Error).message)
    return fail('The dates could not be worked out. Try again in a moment.')
  }
}

/** How one person, or several (5C's bulk edit), submit from now on. */
export async function setCadence(input: { personIds: string[]; cadence: Cadence }): Promise<Result<{ changed: { personId: string; effectiveFrom: string | null; text: string }[] }>> {
  const v = await editor()
  if (isFail(v)) return v
  const cadence = asCadence(input.cadence)
  if (!cadence) return fail('Choose Monthly or Every 2 weeks.')
  try {
    const c = db()
    const settings = await loadClockySettings()
    if (cadence === 'biweekly' && !settings.anchor) return fail('Set the day pay periods start first.')
    const now = new Date()
    const dir = await loadDirectory()
    const previews = await previewCadence(now, (input.personIds ?? []).map(String), cadence)
    const changed: { personId: string; effectiveFrom: string | null; text: string }[] = []
    for (const p of previews) {
      const today = localDate(now, dir.zoneOf(p.personId))
      const { error: delErr } = await c.from('tc_person_cadence').delete().eq('person_id', p.personId).gt('effective_from', today)
      if (delErr) return notSaved(delErr)
      if (p.plan.insert.length) {
        const { error } = await c.from('tc_person_cadence').insert(p.plan.insert.map(x => ({
          person_id: p.personId, cadence: x.cadence, effective_from: x.effectiveFrom, one_period: !!x.onePeriod, set_by: v.personId,
        })))
        if (error) return notSaved(error)
      }
      changed.push({ personId: p.personId, effectiveFrom: p.plan.effectiveFrom, text: p.plan.text })
    }
    refresh()
    return { ok: true, changed }
  } catch (e) {
    return notSaved(e)
  }
}
