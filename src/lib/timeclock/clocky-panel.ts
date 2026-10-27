/**
 * The clock panel's data (design handoff of 16 October 2026, SPEC section 6,
 * Clock Panel.dc.html frames 1A to 1N): the running entry with its recorded
 * and real start, today's and this week's totals on the quarter hour, the
 * resume card, the saved combinations and the recent ones, the jobs (no time
 * off, no folders), the fields with their options, the smart defaults, the
 * automatic stops waiting for an end time, the safety window, and whether
 * today's period is locked.
 *
 * "As soon as it notices": a clock past its 5-hour mark, or past the person's
 * hours allowance (owner, 25 October 2026), is stopped here, when the person
 * really signed in opens the panel, as the safety job would.
 *
 * Not a "use server" file: app/(app)/clocky-hours/clock-actions.ts serves it.
 */

import type { Db } from '@/lib/supabase/types'
import { allRows, db, keysOfJob, loadCatalog, loadClockySettings, loadDirectory, loadCadenceChanges, must, rulesFor, type Catalog, type Viewer } from './clocky-context'
import { runningOf, loadSubmissions, lockOn, type EntryRow } from './clocky-store'
import { announceClockStop, portalOrigin } from './clocky-notify'
import { dayLabel, localDate, timeLabel, zoneAbbr } from './format'
import { entrySeconds, roundIso, runningSeconds } from './rounding'
import { endOptions, safetyState, sessionStart, stillWorkingPanelText, stopWhen, windowStart } from './safety'
import { clockDay, missingFields, offeredOn, type FieldKeys } from './entry-rules'
import { weekBounds } from './clock'
import { loadWindows, statusOf, limitStopIn, stopClockIfDue, type ClockStop } from './allowance-limit'
import { loadPayTerms } from './pay-terms'
import { addDays, lockedMessage, periodContaining, periodLabel } from './periods'
import type { ClockChoice, ClockPanelData, PanelFolder, PanelJob, RunningEntry, ToConfirm } from './clocky-types'
import { catalogueRows } from './job-catalogue'
import { startDateOf } from './waves-data'
import { clockGate } from './waves'

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
  const c = combos.find(x => sameChoice(x, e, keysOfJob(catalog, catalog.jobs.get(e.jobcode_id ?? -1))))
  return c?.name ?? catalog.jobs.get(e.jobcode_id ?? -1)?.short ?? ''
}

export function choiceOf(
  src: { jobcode_id: number; fields: Record<string, string>; notes: string | null; name?: string | null; id?: number | null },
  catalog: Catalog,
): ClockChoice {
  const job = catalog.jobs.get(src.jobcode_id)
  const keys = keysOfJob(catalog, job)
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
    // A 2026 project's Billable is the project's own.
    billable: job?.structure === 2 ? (job.billable ? 'yes' : 'no') : keys.billable ? src.fields?.[keys.billable] ?? '' : '',
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

/**
 * Stop the person's clock if its 5-hour window ran out (bell and email) or it
 * reached their allowance (the bell), and tell them. null when it goes on.
 */
export async function stopOwnIfDue(c: Db, e: EntryRow | null, now: Date): Promise<ClockStop | null> {
  if (!e) return null
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const st = await stopClockIfDue(c, e, now, dir, catalog)
  if (!st) return null
  await announceClockStop(st, await portalOrigin(), now, c)
  return st
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
  const todaySpans = work.filter(e => e.entry_date === today && e.started_at)
    .map(e => ({ start: (e.started_at_real ?? e.started_at)!, end: e.ended_at ? e.ended_at_real ?? e.ended_at : null }))
    .sort((a, b) => a.start.localeCompare(b.start))
  const weekSeconds = work.filter(e => e.entry_date >= week.start && e.entry_date <= week.end).reduce((s, e) => s + counted(e), 0)

  // The hours allowance (Clocky part 2, 10B): this week or month against the allowance plus the extra hours approved,
  // read as the limit reads it (allowance-limit.ts), with where the running clock will stop at it.
  let allowance: ClockPanelData['allowance'] = null
  const terms = (await loadPayTerms([me])).get(me)
  if (terms?.allowance) {
    const w = (await loadWindows(me, terms.allowance, [today], now)).get(today)!
    const inWindow = running && w.counted.some(x => x.id === running!.id)
    const stop = inWindow ? limitStopIn(w, running!, now) : null
    allowance = { ...statusOf(w), period: terms.allowance.period, hours: terms.allowance.hours, stopAt: stop?.at.real ?? null }
  }

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
      structure: job?.structure ?? 1,
      fields,
      notes: running.notes ?? '',
      startedAt: running.started_at,
      startedAtReal: running.started_at_real,
      sessionStartedAt: sessionStart(running),
      windowStartedAt: windowStart(running),
      recordedSeconds: runningSeconds(running.started_at, now),
      roundNote: realLabel && realLabel !== recLabel ? { recorded: recLabel, real: realLabel } : null,
      missing: missingFields(fields, running.notes, keysOfJob(catalog, job), !!job?.isI7),
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

  // Combinations, recents and the resume card: the jobs of the day a clock started now is recorded on.
  const startsDay = clockDay(now, zone)
  const selectable = (id: number | null) => id != null && offeredOn(catalog.jobs.get(id), startsDay, catalog.switchDate)
  const combinations = combos.filter(x => selectable(x.jobcode_id)).map(x => choiceOf({ ...x, fields: x.fields ?? {} }, catalog))
  const finished = recent.filter(e => e.kind !== 'absence' && selectable(e.jobcode_id) && e.ended_at !== null)
    .sort((a, b) => (b.ended_at ?? b.entry_date).localeCompare(a.ended_at ?? a.entry_date))
  const recents: ClockChoice[] = []
  const seen: { jobcode_id: number | null; fields: Record<string, string> }[] = []
  for (const e of [...(running ? [running] : []), ...finished]) {
    const f = (e.fields ?? {}) as Record<string, string>
    const k = { jobcode_id: e.jobcode_id, fields: f }
    if (seen.some(s => sameChoice(s, k, keysOfJob(catalog, catalog.jobs.get(k.jobcode_id ?? -1))))) continue
    seen.push(k)
    if (combos.some(x => sameChoice(x, k, keysOfJob(catalog, catalog.jobs.get(k.jobcode_id ?? -1)))) || !selectable(e.jobcode_id)) continue
    recents.push(choiceOf({ jobcode_id: e.jobcode_id!, fields: f, notes: e.notes }, catalog))
    if (recents.length >= 5) break
  }
  const last = finished[0]
  const resume = last
    ? (() => {
      const f = (last.fields ?? {}) as Record<string, string>
      const saved = combos.find(x => sameChoice(x, { jobcode_id: last.jobcode_id, fields: f }, keysOfJob(catalog, catalog.jobs.get(last.jobcode_id ?? -1))))
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
  // In the job catalogue's order (Company settings > Job catalogue), then by name.
  const rank = new Map([...catalogueRows(catalog), ...catalogueRows(catalog, 2)].map((r, i) => [r.id, i]))
  const byRank = (a: { id: number; path: string }, b: { id: number; path: string }) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || a.path.localeCompare(b.path)
  // Every job either structure may need: the clock offers today's, the forms the day of the entry
  // (the TSheets jobs before the switch date, the 2026 projects from it; none of those before a date is set).
  const jobs: PanelJob[] = [...catalog.jobs.values()].filter(j => j.selectable && (j.structure === 1 || !!catalog.switchDate))
    .map(j => ({ id: j.id, name: j.name, path: j.path, short: j.short, folderId: j.folderId, isI7: j.isI7, use: j.whenToUse, billable: j.billable, order: rank.get(j.id) ?? 1e9, structure: j.structure }))
    .sort(byRank)
  const folderIds = [...new Set(jobs.map(j => j.folderId).filter((x): x is number => x != null))]
  const folders: PanelFolder[] = folderIds.map(id => ({ id, name: catalog.jobs.get(id)?.structure === 2 ? catalog.pathOf(id) : catalog.jobs.get(id)?.name ?? '', jobIds: jobs.filter(j => j.folderId === id).map(j => j.id), use: catalog.jobs.get(id)?.whenToUse ?? null, order: rank.get(id) ?? 1e9 }))
    .sort((a, b) => byRank({ id: a.id, path: a.name }, { id: b.id, path: b.name }))

  // Today's period, and whether it is locked (1N).
  const rules = rulesFor(me, changes, settings)
  const period = periodContaining(today, rules)
  const lock = lockOn([today], subs.get(me) ?? [])
  // Before the person's North Time start date (their wave, Company settings >
  // North Time rollout), the clock does not start: they still clock in TSheets.
  const startsOn = await northTimeStart(viewer)
  const notYet = clockGate(startsOn, today)

  // What each job fills in: the person's own history first, then the job
  // catalogue's defaults (Company, Project, billable by default; 11A).
  const history = (defaultsRes.data ?? {}) as Record<string, Record<string, string>>
  const optionOf = (key: string | null, want: string | null) => {
    if (!key || !want) return null
    const f = catalog.fields.find(x => x.id === key)
    return f?.options.find(o => o.toLowerCase() === want.toLowerCase()) ?? null
  }
  const defaults: Record<string, Record<string, string>> = {}
  for (const j of jobs) {
    const cj = catalog.jobs.get(j.id)!
    // A 2026 project fills nothing from the catalogue: its Client, Division and Billable are the project.
    if (cj.structure === 2) { if (history[String(j.id)]) defaults[String(j.id)] = history[String(j.id)]; continue }
    const fromCatalogue = Object.fromEntries(([
      [keys.company, optionOf(keys.company, cj.defaultCompany)],
      [keys.project, optionOf(keys.project, cj.defaultProject)],
      [keys.billable, optionOf(keys.billable, cj.billable ? 'yes' : 'no')],
    ] as const).filter((x): x is readonly [string, string] => !!x[0] && !!x[1]))
    const mine = history[String(j.id)] ?? {}
    if (Object.keys(fromCatalogue).length || Object.keys(mine).length) defaults[String(j.id)] = { ...fromCatalogue, ...mine }
  }

  return {
    me: { personId: me, name: viewer.name, zone, zoneAbbr: zoneAbbr(zone, now), level: viewer.level, leader: viewer.leader },
    now: now.toISOString(),
    today,
    todayLabel: dayLabel(today),
    todaySeconds,
    todaySpans,
    weekSeconds,
    allowance,
    running: runningView,
    safety,
    toConfirm,
    resume,
    combinations,
    recents,
    todayByCombination,
    jobs,
    folders,
    fields: catalog.fields.map(f => ({ key: f.key, id: f.id, label: f.label, options: f.options, required: f.required, structure: f.structure, families: f.families })),
    defaults,
    locked: notYet ?? (lock ? lockedMessage(lock) : null),
    startsOn,
    notYet,
    period: { ...period, ...periodLabel(period) },
    firstTime: !combos.length && !recent.length,
    switchDate: catalog.switchDate,
    correctionGoesTo: await correctionGoesTo(me),
  }
}

/**
 * The person's North Time start date, or null (no wave date set: no gate). A
 * failed read leaves the clock as it was rather than lock everyone out of it.
 */
export async function northTimeStart(v: Pick<Viewer, 'personId' | 'level' | 'leader'>): Promise<string | null> {
  try {
    return await startDateOf(db(), v.personId, { level: v.level, leader: v.leader })
  } catch (e) {
    console.error('[clocky] North Time start date:', e instanceof Error ? e.message : e)
    return null
  }
}

// Moved to rounding.ts (pure) so the allowance's limit can count with it; kept here for its callers.
export { entrySeconds }
