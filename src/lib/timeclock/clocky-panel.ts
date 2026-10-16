/**
 * The clock panel's data (design handoff of 16 October 2026, SPEC section 6,
 * Clock Panel.dc.html frames 1A to 1N): the running entry with its recorded
 * and real start, today's and this week's totals on the quarter hour, the
 * resume card, the saved combinations and the recent ones, the jobs (no time
 * off, no folders), the fields with their options, the smart defaults, the
 * automatic stops waiting for an end time, the safety window, and whether
 * today's period is locked.
 *
 * "As soon as it notices": a clock past its 5-hour mark is stopped here, when
 * the person really signed in opens the panel, as the safety job would.
 *
 * Not a "use server" file: app/(app)/clocky-hours/clock-actions.ts serves it.
 */

import type { Db } from '@/lib/supabase/types'
import { allRows, db, loadCatalog, loadClockySettings, loadDirectory, loadCadenceChanges, must, rulesFor, type Catalog, type Viewer } from './clocky-context'
import { runningOf, stopIfDue, loadSubmissions, lockOn, type EntryRow } from './clocky-store'
import { announceStop, portalOrigin } from './clocky-notify'
import { dayLabel, localDate, timeLabel, zoneAbbr } from './format'
import { roundIso, runningSeconds } from './rounding'
import { endOptions, safetyState, sessionStart, stillWorkingPanelText, stopWhen, windowStart } from './safety'
import { missingFields, type FieldKeys } from './entry-rules'
import { weekBounds } from './clock'
import { addDays, lockedMessage, periodContaining, periodLabel } from './periods'
import type { ClockChoice, ClockPanelData, PanelFolder, PanelJob, RunningEntry, ToConfirm } from './clocky-types'

export interface ComboRow { id: number; name: string; jobcode_id: number; fields: Record<string, string>; notes: string | null; position: number }

export async function loadCombos(c: Db, personId: string): Promise<ComboRow[]> {
  return (must(await c.from('tc_combinations').select('id, name, jobcode_id, fields, notes, position')
    .eq('person_id', personId).order('position').order('id'), 'Combinations could not be read') ?? []) as ComboRow[]
}

const activityOf = (fields: Record<string, string>, keys: FieldKeys) => (keys.activity ? fields[keys.activity] ?? '' : '')

/** "Same combination": the same job and Activity, as the prototype matches them. */
export const sameChoice = (a: { jobcode_id: number | null; fields: Record<string, string> }, b: { jobcode_id: number | null; fields: Record<string, string> }, keys: FieldKeys) =>
  a.jobcode_id === b.jobcode_id && activityOf(a.fields, keys) === activityOf(b.fields, keys)

/** How an entry is named in toasts and breakdowns: the saved combination's name, else the short job. */
export function labelFor(e: { jobcode_id: number | null; fields: Record<string, string> }, combos: readonly ComboRow[], catalog: Catalog): string {
  const c = combos.find(x => sameChoice(x, e, catalog.keys))
  return c?.name ?? catalog.jobs.get(e.jobcode_id ?? -1)?.short ?? ''
}

export function choiceOf(
  src: { jobcode_id: number; fields: Record<string, string>; notes: string | null; name?: string | null; id?: number | null },
  catalog: Catalog,
): ClockChoice {
  const job = catalog.jobs.get(src.jobcode_id)
  const keys = catalog.keys
  return {
    combinationId: src.id ?? null,
    name: src.name ?? null,
    jobcodeId: src.jobcode_id,
    path: job?.path ?? '',
    short: job?.short ?? '',
    isI7: !!job?.isI7,
    fields: src.fields ?? {},
    notes: src.notes ?? '',
    label: src.name ?? job?.short ?? '',
    activity: keys.activity ? src.fields?.[keys.activity] ?? '' : '',
    billable: keys.billable ? src.fields?.[keys.billable] ?? '' : '',
  }
}

/** "Goes to Rock Kai, your Team Leader. Admins and Super Admins can also approve it." (3K-1) */
export async function correctionGoesTo(personId: string): Promise<string> {
  const dir = await loadDirectory()
  const mine = new Set(dir.target(personId).teamIds)
  const leads = [...dir.led.entries()]
    .filter(([id, teams]) => id !== personId && [...teams].some(t => mine.has(t)) && dir.people.get(id)?.active)
    .map(([id]) => dir.nameOf(id)).sort()
  if (leads.length === 1) return `Goes to ${leads[0]}, your Team Leader. Admins and Super Admins can also approve it.`
  if (leads.length > 1) return `Goes to ${leads.slice(0, -1).join(', ')} and ${leads[leads.length - 1]}, your Team Leaders. Admins and Super Admins can also approve it.`
  return 'Goes to the Admins and Super Admins.'
}

/** Stop the person's clock if its 5-hour window ran out, and tell them (bell and email). */
export async function stopOwnIfDue(c: Db, e: EntryRow | null, now: Date): Promise<boolean> {
  if (!e) return false
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const st = await stopIfDue(c, e, now, dir, catalog)
  if (!st) return false
  await announceStop(st, await portalOrigin(), now, c)
  return true
}

export async function loadClockPanel(viewer: Viewer, now: Date, opts: { act: boolean }): Promise<ClockPanelData> {
  const c = db()
  const [catalog, settings] = await Promise.all([loadCatalog(), loadClockySettings()])
  const me = viewer.personId
  const zone = viewer.zone
  const today = localDate(now, zone)
  const keys = catalog.keys

  let running = await runningOf(c, me)
  if (running && opts.act && await stopOwnIfDue(c, running, now)) running = null

  const week = weekBounds(today, settings.weekStart)
  const since = addDays(today, -365)
  const [recent, combos, toConfirmRows, changes, subs, defaultsRes] = await Promise.all([
    // The person's last entries: totals of the week, recents, the resume card.
    allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').eq('person_id', me)
      .gte('entry_date', addDays(week.start, -60)).order('entry_date', { ascending: false }).order('id', { ascending: false }).range(a, b), 'Your entries could not be read'),
    loadCombos(c, me),
    c.from('tc_entries').select('*').eq('person_id', me).not('auto_stopped_at', 'is', null).is('end_confirmed_at', null)
      .order('auto_stopped_at').limit(20),
    loadCadenceChanges(c, [me]),
    loadSubmissions(c, [me]),
    c.rpc('tc_job_field_defaults', { p_since: since, p_keys: [keys.company, keys.project, keys.billable, keys.code].filter((k): k is string => !!k) }),
  ])
  if (defaultsRes.error) console.error('[clocky] smart defaults:', defaultsRes.error.message)

  const work = recent.filter(e => e.kind !== 'absence')
  const counted = (e: EntryRow) => entrySeconds(e, now)
  const todaySeconds = work.filter(e => e.entry_date === today).reduce((s, e) => s + counted(e), 0)
  const weekSeconds = work.filter(e => e.entry_date >= week.start && e.entry_date <= week.end).reduce((s, e) => s + counted(e), 0)

  // The running entry.
  let runningView: RunningEntry | null = null
  let safety: ClockPanelData['safety'] = null
  if (running && running.started_at) {
    const job = catalog.jobs.get(running.jobcode_id ?? -1)
    const fields = (running.fields ?? {}) as Record<string, string>
    const realLabel = running.started_at_real ? timeLabel(running.started_at_real, zone) : null
    const recLabel = timeLabel(running.started_at, zone)
    runningView = {
      id: running.id,
      jobcodeId: running.jobcode_id,
      path: job?.path ?? '',
      short: job?.short ?? '',
      label: labelFor({ jobcode_id: running.jobcode_id, fields }, combos, catalog),
      isI7: !!job?.isI7,
      fields,
      notes: running.notes ?? '',
      startedAt: running.started_at,
      startedAtReal: running.started_at_real,
      sessionStartedAt: sessionStart(running),
      windowStartedAt: windowStart(running),
      recordedSeconds: runningSeconds(running.started_at, now),
      roundNote: realLabel && realLabel !== recLabel ? { recorded: recLabel, real: realLabel } : null,
      missing: missingFields(fields, running.notes, keys, !!job?.isI7),
      imported: running.source === 'tsheets',
    }
    const ws = windowStart(running)
    if (ws) {
      const st = safetyState(ws, now)
      safety = {
        windowStartedAt: ws, sessionStartedAt: sessionStart(running), warnAt: st.warnAt, stopAt: st.stopAt, warn: st.warn,
        panelText: stillWorkingPanelText(ws, zone, runningView.label),
      }
    }
  }

  // Automatic stops still waiting for the real end time (1L), oldest first.
  const toConfirm: ToConfirm[] = ((must(toConfirmRows, 'Automatic stops could not be read') ?? []) as EntryRow[])
    .filter(e => e.started_at && e.ended_at)
    .map(e => {
      const label = labelFor({ jobcode_id: e.jobcode_id, fields: (e.fields ?? {}) as Record<string, string> }, combos, catalog)
      const when = stopWhen(e.ended_at!, zone, today)
      const ws = windowStart(e) ?? e.started_at!
      return {
        entryId: e.id,
        path: catalog.pathOf(e.jobcode_id),
        label,
        startedAt: e.started_at!,
        stoppedAt: e.ended_at!,
        stoppedAtReal: e.ended_at_real,
        date: e.entry_date,
        stopWhen: when,
        text: `It ran 5h 00m without an answer since you clocked in at ${timeLabel(roundIso(ws), zone)}, so it stopped at ${when}. When did you really stop working?`,
        options: endOptions(e.started_at!, e.ended_at!, now, false),
        laterOptions: endOptions(e.started_at!, e.ended_at!, now, true),
      }
    })

  // Combinations, recents and the resume card.
  const selectable = (id: number | null) => id != null && !!catalog.jobs.get(id)?.selectable
  const combinations = combos.filter(x => selectable(x.jobcode_id)).map(x => choiceOf({ ...x, fields: x.fields ?? {} }, catalog))
  const finished = recent.filter(e => e.kind !== 'absence' && selectable(e.jobcode_id) && e.ended_at !== null)
    .sort((a, b) => (b.ended_at ?? b.entry_date).localeCompare(a.ended_at ?? a.entry_date))
  const recents: ClockChoice[] = []
  const seen: { jobcode_id: number | null; fields: Record<string, string> }[] = []
  for (const e of [...(running ? [running] : []), ...finished]) {
    const f = (e.fields ?? {}) as Record<string, string>
    const k = { jobcode_id: e.jobcode_id, fields: f }
    if (seen.some(s => sameChoice(s, k, keys))) continue
    seen.push(k)
    if (combos.some(x => sameChoice(x, k, keys)) || !selectable(e.jobcode_id)) continue
    recents.push(choiceOf({ jobcode_id: e.jobcode_id!, fields: f, notes: e.notes }, catalog))
    if (recents.length >= 5) break
  }
  const last = finished[0]
  const resume = last
    ? (() => {
      const f = (last.fields ?? {}) as Record<string, string>
      const saved = combos.find(x => sameChoice(x, { jobcode_id: last.jobcode_id, fields: f }, keys))
      return choiceOf({ jobcode_id: last.jobcode_id!, fields: f, notes: last.notes, name: saved?.name ?? null, id: saved?.id ?? null }, catalog)
    })()
    : null

  // Today, by combination.
  const byLabel = new Map<string, { seconds: number; running: boolean }>()
  for (const e of work.filter(x => x.entry_date === today)) {
    const label = labelFor({ jobcode_id: e.jobcode_id, fields: (e.fields ?? {}) as Record<string, string> }, combos, catalog)
    const cur = byLabel.get(label) ?? { seconds: 0, running: false }
    byLabel.set(label, { seconds: cur.seconds + counted(e), running: cur.running || e.ended_at === null })
  }
  const todayByCombination = [...byLabel.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.seconds - a.seconds)

  // Jobs and folders: time off is requested, not clocked; folders are not clocked into.
  const jobs: PanelJob[] = [...catalog.jobs.values()].filter(j => j.selectable)
    .map(j => ({ id: j.id, name: j.name, path: j.path, short: j.short, folderId: j.folderId, isI7: j.isI7 }))
    .sort((a, b) => a.path.localeCompare(b.path))
  const folderIds = [...new Set(jobs.map(j => j.folderId).filter((x): x is number => x != null))]
  const folders: PanelFolder[] = folderIds.map(id => ({ id, name: catalog.jobs.get(id)?.name ?? '', jobIds: jobs.filter(j => j.folderId === id).map(j => j.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Today's period, and whether it is locked (1N).
  const rules = rulesFor(me, changes, settings)
  const period = periodContaining(today, rules)
  const lock = lockOn([today], subs.get(me) ?? [])

  const defaults = (defaultsRes.data ?? {}) as Record<string, Record<string, string>>

  return {
    me: { personId: me, name: viewer.name, zone, zoneAbbr: zoneAbbr(zone, now), level: viewer.level, leader: viewer.leader },
    now: now.toISOString(),
    today,
    todayLabel: dayLabel(today),
    todaySeconds,
    weekSeconds,
    running: runningView,
    safety,
    toConfirm,
    resume,
    combinations,
    recents,
    todayByCombination,
    jobs,
    folders,
    fields: catalog.fields.map(f => ({ key: f.key, id: f.id, label: f.label, options: f.options, required: f.required })),
    defaults,
    locked: lock ? lockedMessage(lock) : null,
    period: { ...period, ...periodLabel(period) },
    firstTime: !combos.length && !recent.length,
    correctionGoesTo: await correctionGoesTo(me),
  }
}

/** What an entry counts: its recorded duration, a running one to now (on the quarter hour). */
export const entrySeconds = (e: Pick<EntryRow, 'ended_at' | 'started_at' | 'duration_seconds' | 'kind'>, now: Date): number =>
  e.ended_at === null && e.kind === 'clock' && e.started_at ? runningSeconds(e.started_at, now) : e.duration_seconds
