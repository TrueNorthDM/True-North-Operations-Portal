/**
 * Timesheet periods (design handoff of 16 October 2026, SPEC 11A, Timesheet
 * Periods.dc.html frames 5A to 5C): the pay period start and the periods it
 * makes, who submits how, and the exact dates a change takes effect, for the
 * confirm dialogs before saving. defaultCadence is only what someone with no
 * cadence of their own follows (people from before 20 October 2026, when the
 * cadence became required on Add person); it is no longer set anywhere.
 *
 * Not a "use server" file: app/(app)/clocky-hours/periods/actions.ts serves it.
 */

import type { Db } from '@/lib/supabase/types'
import { allRows, db, loadCadenceChanges, loadClockySettings, loadDirectory, rulesFor, type ClockySettings, type Viewer } from './clocky-context'
import { dayLabel, localDate, longDateLabel } from './format'
import {
  anchorMove, cadenceChange, cadenceOn, companyPayPeriods, periodContaining, periodLabel, rangeText, SENT_STATES,
  type AnchorPlan, type Cadence, type CadenceChange, type CadencePlan,
} from './periods'
import { periodsAccess } from './scope'
import type { TimesheetPeriodsData } from './clocky-types'

export const CADENCE_LABEL: Record<Cadence, string> = { monthly: 'Monthly', biweekly: 'Every 2 weeks' }

/** The person's cadence now, and the one scheduled to follow (what the pill shows: the latest). */
export function cadenceNow(today: string, changes: readonly CadenceChange[], fallback: Cadence): { now: Cadence; scheduled: { cadence: Cadence; from: string } | null } {
  const now = cadenceOn(today, { changes, fallback }).cadence
  const future = [...changes].filter(c => c.effectiveFrom > today && !c.onePeriod).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1)).pop()
  return { now, scheduled: future && future.cadence !== now ? { cadence: future.cadence, from: future.effectiveFrom } : null }
}

export async function loadTimesheetPeriods(v: Viewer, now: Date): Promise<TimesheetPeriodsData | null> {
  const access = periodsAccess(v)
  if (access === 'none') return null
  const [dir, settings, changes] = await Promise.all([loadDirectory(), loadClockySettings(), loadCadenceChanges(db())])
  const today = localDate(now, settings.companyZone)
  const people = [...dir.people.values()].filter(p => p.active).map(p => {
    const t = localDate(now, p.zone)
    const rules = rulesFor(p.id, changes, settings)
    const cn = cadenceNow(t, rules.changes, rules.fallback)
    return {
      personId: p.id,
      name: p.name,
      cadence: cn.scheduled?.cadence ?? cn.now,
      scheduled: cn.scheduled,
      notSet: rules.changes.length === 0,
      currentPeriod: periodLabel(periodContaining(t, rules)).full,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
  return {
    access,
    anchor: settings.anchor,
    anchorLabel: settings.anchor ? longDateLabel(settings.anchor) : null,
    defaultCadence: settings.defaultCadence,
    counts: {
      monthly: people.filter(p => !p.notSet && p.cadence === 'monthly').length,
      biweekly: people.filter(p => !p.notSet && p.cadence === 'biweekly').length,
      notSet: people.filter(p => p.notSet).length,
    },
    periods: companyPayPeriods(today, settings.anchors).map(p => ({
      start: p.start, end: p.end, state: p.state,
      label: `${dayLabel(p.start)} to ${dayLabel(p.end)}, ${p.end.slice(0, 4)}`,
    })),
    people,
  }
}

/** The last day of the latest pay period anyone submitted or had approved (the anchor rule). */
export async function lastSubmittedPayEnd(c: Db): Promise<string | null> {
  const subs = await allRows<{ period_id: number }>((a, b) => c.from('tc_submissions').select('period_id')
    .in('state', [...SENT_STATES]).order('id').range(a, b), 'Submissions could not be read')
  const ids = [...new Set(subs.map(s => s.period_id))]
  if (!ids.length) return null
  const { data, error } = await c.from('tc_periods').select('end_date').in('id', ids).eq('kind', 'pay_period').order('end_date', { ascending: false }).limit(1)
  if (error) throw new Error(`Periods could not be read: ${error.message}`)
  return ((data ?? []) as { end_date: string }[])[0]?.end_date ?? null
}

export interface AnchorPreview extends AnchorPlan {
  /** 5A's amber line, "" when today's period does not move. */
  movedText: string
  /** The confirm dialog "Move the pay periods?" (exact copy). */
  dialog: { title: string; intro: string; items: { name: string; change: string; eff: string }[]; button: string }
}

export async function previewAnchor(now: Date, anchor: string, settings?: ClockySettings): Promise<AnchorPreview> {
  const c = db()
  const s = settings ?? await loadClockySettings()
  const today = localDate(now, s.companyZone)
  const plan = anchorMove(today, s.anchors, anchor, await lastSubmittedPayEnd(c))
  const changes = await loadCadenceChanges(c)
  const dir = await loadDirectory()
  const biweekly = [...dir.people.values()].filter(p => p.active && cadenceOn(localDate(now, p.zone), rulesFor(p.id, changes, s)).cadence === 'biweekly').length
  const oldR = plan.oldCurrent ? rangeText(plan.oldCurrent.start, plan.oldCurrent.end) : ''
  const newR = rangeText(plan.newCurrent.start, plan.newCurrent.end)
  return {
    ...plan,
    movedText: plan.moves && plan.oldCurrent
      ? `The current period moves from ${oldR} to ${newR}. Periods already submitted keep their dates; the new dates start with the first period nobody has submitted yet.`
      : '',
    dialog: {
      title: 'Move the pay periods?',
      intro: `Pay periods will start ${longDateLabel(anchor)} and every 2 weeks from it. This changes the dates for the ${biweekly} people who submit every 2 weeks.`,
      items: [{
        name: 'Current period',
        change: plan.oldCurrent ? `${oldR} → ${newR}` : newR,
        eff: 'Periods already submitted keep their dates. The new dates start with the first period nobody has submitted yet; the days in between close as one period.',
      }],
      button: 'Move the pay periods',
    },
  }
}

export interface CadencePreview { personId: string; name: string; from: Cadence; to: Cadence; change: string; plan: CadencePlan }

/** 5B's "starts" line and 5C's confirm dialog: for each person, old → new and the dates it takes effect. */
export async function previewCadence(now: Date, personIds: readonly string[], to: Cadence): Promise<CadencePreview[]> {
  const c = db()
  const [dir, settings, changes] = await Promise.all([loadDirectory(), loadClockySettings(), loadCadenceChanges(c, personIds)])
  return personIds.filter(id => dir.people.has(id)).map(id => {
    const today = localDate(now, dir.zoneOf(id))
    const rules = rulesFor(id, changes, settings)
    const cn = cadenceNow(today, rules.changes, rules.fallback)
    const from = cn.scheduled?.cadence ?? cn.now
    return {
      personId: id,
      name: dir.nameOf(id),
      from,
      to,
      change: `${rules.changes.length ? CADENCE_LABEL[from] : 'Not set'} → ${CADENCE_LABEL[to]}`,
      plan: cadenceChange(today, to, rules),
    }
  })
}
