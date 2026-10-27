/**
 * The clock panel's arithmetic and copy (Design/design_handoff_clocky/Clock
 * Panel.dc.html, renderVals): what each row, chip, header and total says, the
 * job search and the browse tree, the top-bar button's state and the tab
 * title. Pure, so the screens and the tests ask the same questions.
 *
 * Every duration shown is on the quarter hour (lib/timeclock/rounding.ts);
 * only the live timers (h:mm:ss) show the real time.
 */

import type { ClockChoice, ClockPanelData, PanelField, PanelFolder, PanelJob, RunningEntry } from '@/lib/timeclock/clocky-types'
import { fieldsOfStructure, missingFields, structureOn, type FieldKeys, type FieldName, type MissingName, type Structure } from '@/lib/timeclock/entry-rules'
import { formatClock, formatDuration, formatTimer, roundIso, runningSeconds } from '@/lib/timeclock/rounding'
import { dayLabel, timeLabel } from '@/lib/timeclock/format'
import { WARN_AFTER_SECONDS } from '@/lib/timeclock/safety'

/** The fields in the order the panel asks them (the prototype's keysFor). */
export const FIELD_ORDER: readonly FieldName[] = ['company', 'project', 'activity', 'billable', 'code']

/** How a missing field is named on its chip and in the gate ("+ Add Activity"). */
export const FIELD_SHORT: Record<FieldName, string> = {
  company: 'Company', project: 'Project', activity: 'Activity', billable: 'Billable', code: 'i7 Code',
}

/** The fields an entry on this job asks: the i7 Code only on i7 jobs. */
export const keysFor = (isI7: boolean): FieldName[] => FIELD_ORDER.filter(k => k !== 'code' || isI7)

/**
 * The field of this name. With a job, the one of the job's structure (the
 * 2026 projects have their own Activity); without, the TSheets one.
 */
export const fieldByKey = (fields: readonly PanelField[], key: FieldName, job?: { structure?: Structure } | null): PanelField | undefined =>
  fieldsOfStructure(fields, job?.structure).find(f => f.key === key)

/** A field's options for the list: the 2026 activities under their family headings. */
export const optionsOf = (f: Pick<PanelField, 'options' | 'families'>): { value: string; label: string; group?: string }[] =>
  f.options.map(o => ({ value: o, label: o, ...(f.families?.[o] ? { group: f.families[o] } : {}) }))

/** The fields a job asks: its structure's, the i7 Code only on i7 jobs. */
export const fieldsForJob = (fields: readonly PanelField[], job: { structure?: Structure } | null | undefined): PanelField[] =>
  fieldsOfStructure(fields, job?.structure)

/** The jobs offered for an entry on this day: the TSheets jobs before the switch date, the 2026 projects from it. */
export const jobsOn = <J extends { structure?: Structure }>(jobs: readonly J[], day: string, switchDate: string | null | undefined): J[] =>
  jobs.filter(j => (j.structure ?? 1) === structureOn(day, switchDate))

/** tc_fields ids by name, as lib/timeclock/entry-rules.ts wants them. */
export function fieldKeys(fields: readonly PanelField[]): FieldKeys {
  // The list as given: a caller narrowed to one structure keeps it.
  const id = (k: FieldName) => fields.find(f => f.key === k)?.id ?? null
  return { company: id('company'), project: id('project'), activity: id('activity'), billable: id('billable'), code: id('code') }
}

/** The value of one named field in a fields object keyed by tc_fields id. */
export function valueOf(values: Readonly<Record<string, string>>, fields: readonly PanelField[], key: FieldName): string {
  // Whichever structure's field the values carry (an entry holds one structure's ids).
  for (const f of fields) if (f.key === key && values[f.id]) return values[f.id]
  return ''
}

export const isYes = (v: string | null | undefined): boolean => (v ?? '').trim().toLowerCase() === 'yes'

/** The Billable chip and lines: "Billable" / "Not billable". */
export const billableText = (v: string): string => (isYes(v) ? 'Billable' : 'Not billable')

/**
 * The running entry's job as the panel asks its fields: the job of the list,
 * else (a job switched off since the clock started) its own structure.
 */
export const runningJobOf = (jobs: readonly PanelJob[], r: Pick<RunningEntry, 'jobcodeId' | 'isI7' | 'structure'>): { isI7: boolean; structure?: Structure } =>
  jobs.find(j => j.id === r.jobcodeId) ?? { isI7: r.isI7, structure: r.structure }

/** What a running entry or a draft still lacks, in the order the panel asks. */
export function missingOf(values: Readonly<Record<string, string>>, notes: string | null, fields: readonly PanelField[], job: { isI7: boolean; structure?: Structure } | null | undefined): MissingName[] {
  return missingFields(values, notes, fieldKeys(fieldsForJob(fields, job)), !!job?.isI7)
}

// ── Rows ────────────────────────────────────────────────────────────────────

/** A combination row (title in Raleway, the line under it muted). */
export function choiceRow(c: ClockChoice, saved: boolean): { title: string; sub: string } {
  return saved
    ? { title: c.name ?? c.label, sub: `${c.path} · ${c.activity || 'No activity'}` }
    : { title: c.path, sub: c.activity || 'No activity' }
}

/** The Resume card: "i7 Web Dev" over "2 - i7 Marketing › Web Dev · WebDev · Billable". */
export function resumeCard(c: ClockChoice): { title: string; line: string } {
  return { title: c.name || c.path, line: `${c.path} · ${c.activity || 'No activity'} · ${billableText(c.billable)}` }
}

/** Same job and same Activity: how the prototype and the server match a combination. */
export const sameChoice = (a: { jobcodeId: number | null; activity: string }, b: { jobcodeId: number | null; activity: string }): boolean =>
  a.jobcodeId === b.jobcodeId && (a.activity || '') === (b.activity || '')

/** The saved combinations shown in the panel; the rest sit under More. */
export const SHOWN_COMBINATIONS = 6

/**
 * "Switch to": the first six saved combinations, then the recents, without the
 * one running now.
 */
export function switchChoices(data: Pick<ClockPanelData, 'combinations' | 'recents' | 'fields'>, running: Pick<RunningEntry, 'jobcodeId' | 'fields'> | null): { choice: ClockChoice; saved: boolean }[] {
  const cur = running ? { jobcodeId: running.jobcodeId, activity: valueOf(running.fields, data.fields, 'activity') } : null
  return [
    ...data.combinations.slice(0, SHOWN_COMBINATIONS).map(choice => ({ choice, saved: true })),
    ...data.recents.map(choice => ({ choice, saved: false })),
  ].filter(r => !cur || !sameChoice(r.choice, cur))
}

/** The name a new combination is offered (the prototype's suggest): "i7 Web Dev", "HFA Translation". */
export function suggestName(short: string, inFolder: boolean, activity: string): string {
  return inFolder ? short.replace(' › ', ' ') : short + (activity ? ' ' + activity.split(':')[0] : '')
}

// ── Choosing a job (1B, 1C, 1C-b) ───────────────────────────────────────────

export type JobRow =
  | { type: 'header'; key: string; label: string }
  | { type: 'job'; key: string; job: PanelJob; label: string; sub: string; bold: boolean }
  | { type: 'folder'; key: string; folder: PanelFolder; label: string; sub: string }

/** The job catalogue's line under a row (11C), and the billable pill that comes with it. */
export const lineOf = (r: JobRow): { use: string; billable: boolean | null } | null =>
  r.type === 'job' ? (r.job.use ? { use: r.job.use, billable: r.job.billable } : null)
    : r.type === 'folder' ? (r.folder.use ? { use: r.folder.use, billable: null } : null) : null

/**
 * Search: every word must appear in the path ("i7 web" finds "2 - i7
 * Marketing › Web Dev"), best match first, grouped under their folder's grey
 * header.
 */
export function searchJobs(jobs: readonly PanelJob[], folders: readonly PanelFolder[], query: string): JobRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const toks = q.split(/\s+/)
  const last = toks[toks.length - 1]
  const hits = jobs
    .filter(j => toks.every(t => j.path.toLowerCase().includes(t)))
    .map(j => ({ j, score: toks.reduce((a, t) => a + j.path.toLowerCase().indexOf(t), 0) - (j.name.toLowerCase().startsWith(last) ? 50 : 0) }))
    .sort((a, b) => a.score - b.score)
  const groups = new Map<number | null, PanelJob[]>()
  for (const h of hits) {
    const k = h.j.folderId
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(h.j)
  }
  const rows: JobRow[] = []
  for (const [folderId, list] of groups) {
    if (folderId != null) rows.push({ type: 'header', key: `h${folderId}`, label: folders.find(f => f.id === folderId)?.name ?? '' })
    for (const j of list) rows.push({ type: 'job', key: `j${j.id}`, job: j, label: j.name, sub: j.path, bold: false })
  }
  return rows
}

/** Browse: the folders and top-level jobs, or one folder's jobs. */
export function browseJobs(jobs: readonly PanelJob[], folders: readonly PanelFolder[], folderId: number | null): JobRow[] {
  if (folderId != null) {
    const f = folders.find(x => x.id === folderId)
    return (f?.jobIds ?? []).map(id => jobs.find(j => j.id === id)).filter((j): j is PanelJob => !!j)
      .map(j => ({ type: 'job', key: `j${j.id}`, job: j, label: j.name, sub: '', bold: false }))
  }
  // In the job catalogue's order, then by name.
  const top: { name: string; order: number; row: JobRow }[] = [
    ...folders.map(f => ({ name: f.name, order: f.order, row: { type: 'folder', key: `f${f.id}`, folder: f, label: f.name, sub: `${f.jobIds.length} jobs` } as JobRow })),
    ...jobs.filter(j => j.folderId == null).map(j => ({ name: j.name, order: j.order, row: { type: 'job', key: `j${j.id}`, job: j, label: j.name, sub: '', bold: false } as JobRow })),
  ]
  return top.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)).map(x => x.row)
}

// ── Totals and the live timer ───────────────────────────────────────────────

/** Where the running entry's timer counts from: the real start, else the recorded one. */
export const timerStart = (r: Pick<RunningEntry, 'startedAt' | 'startedAtReal'>): string => r.startedAtReal ?? r.startedAt

/** Where the session began (the clock in, across switches): the header's "since 8:00 AM" and the 4h 30m. */
export const sessionFrom = (r: Pick<RunningEntry, 'sessionStartedAt' | 'startedAtReal' | 'startedAt'>): string =>
  r.sessionStartedAt ?? r.startedAtReal ?? r.startedAt

/**
 * What the running entry adds since the data was read, on the quarter hour:
 * the server counted it to its own now; the panel keeps counting.
 */
export function runningGrowth(r: Pick<RunningEntry, 'startedAt' | 'recordedSeconds'> | null, nowMs: number): number {
  if (!r) return 0
  return runningSeconds(r.startedAt, new Date(nowMs)) - r.recordedSeconds
}

/** Today and Week under the big timer ("Today 3:45 · Week 35:15"), counting the running entry live. */
export function liveTotals(d: Pick<ClockPanelData, 'todaySeconds' | 'weekSeconds' | 'running'>, nowMs: number): { today: number; week: number } {
  const g = runningGrowth(d.running, nowMs)
  return { today: Math.max(0, d.todaySeconds + g), week: Math.max(0, d.weekSeconds + g) }
}

export interface BreakdownBar { label: string; running: boolean; seconds: number; dur: string; pct: string; color: string }

/** "Today, by combination": biggest first, thin bars against the biggest. */
export function breakdown(d: Pick<ClockPanelData, 'todayByCombination' | 'running'>, nowMs: number): BreakdownBar[] {
  const g = runningGrowth(d.running, nowMs)
  // The bars follow the running entry as it really runs (the prototype's); the figures stay on the quarter hour.
  const raw = d.running ? Math.max(0, (nowMs - Date.parse(d.running.startedAt)) / 1000) - d.running.recordedSeconds : 0
  const rows = d.todayByCombination.map(r => ({ ...r, seconds: Math.max(0, r.seconds + (r.running ? g : 0)), bar: Math.max(0, r.seconds + (r.running ? raw : 0)) }))
    .sort((a, b) => b.bar - a.bar)
  const max = Math.max(1, ...rows.map(r => r.bar))
  return rows.map(r => ({
    label: r.label, running: r.running, seconds: r.seconds, dur: formatDuration(r.seconds),
    pct: `${Math.max(3, (r.bar / max) * 100)}%`, color: r.running ? '#1E9E6A' : '#1E7D7F',
  }))
}

/** The 4h 30m, counted from the window (the last clock in or "Keep going"), across switches. */
export function overWarn(d: Pick<ClockPanelData, 'safety' | 'running'>, nowMs: number): boolean {
  if (!d.running) return false
  if (d.safety) return nowMs >= Date.parse(d.safety.warnAt)
  const from = d.running.windowStartedAt ?? sessionFrom(d.running)
  return (nowMs - Date.parse(from)) / 1000 >= WARN_AFTER_SECONDS
}

// ── The top-bar button and the tab title ────────────────────────────────────

export type TopBarKind = 'off' | 'on' | 'over' | 'auto'

export interface TopBarState {
  kind: TopBarKind
  /** The timer, or "Confirm end time". */
  text: string
  /** The short job ("i7 › Web Dev"), running states only. */
  job: string
  aria: string
}

export function topBarState(d: ClockPanelData | null, nowMs: number): TopBarState {
  if (d?.toConfirm.length) return { kind: 'auto', text: 'Confirm end time', job: '', aria: 'Clock stopped by itself. Confirm end time' }
  if (d?.running) {
    const over = overWarn(d, nowMs)
    return {
      kind: over ? 'over' : 'on',
      text: formatTimer((nowMs - Date.parse(timerStart(d.running))) / 1000),
      job: d.running.short,
      aria: 'On the clock',
    }
  }
  return { kind: 'off', text: 'Clock in', job: '', aria: 'Off the clock. Clock in' }
}

/** The browser tab while the clock runs: "2:00 · i7 › Web Dev · True North". */
export function tabTitle(d: ClockPanelData | null, nowMs: number): string | null {
  if (!d?.running || d.toConfirm.length) return null
  return `${formatClock((nowMs - Date.parse(timerStart(d.running))) / 1000)} · ${d.running.short} · True North`
}

/** "New York" from "America/New_York": the header's "Thu, Oct 15 · New York time". */
export const zoneCity = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

/** The header of the panel for each mode. */
export function panelHeader(
  mode: 'off' | 'choose' | 'details' | 'on' | 'auto',
  o: { data: ClockPanelData; nowMs: number; switching: boolean; first: boolean },
): { title: string; sub: string; dot: 'green' | 'red' | null; back: boolean } {
  const d = o.data
  const zone = d.me.zone
  if (mode === 'on' && d.running) {
    return { title: `On the clock since ${timeLabel(roundIso(sessionFrom(d.running)), zone)}`, sub: `${d.todayLabel} · ${zoneCity(zone)} time`, dot: 'green', back: false }
  }
  if (mode === 'auto' && d.toConfirm.length) {
    const t = d.toConfirm[0]
    return { title: 'Auto clocked out', sub: `${dayLabel(t.date)} · stopped at ${timeLabel(t.stoppedAt, zone)}`, dot: 'red', back: false }
  }
  if (mode === 'choose') return { title: 'North Time', sub: o.switching ? 'Switch to something else' : o.first ? 'Your first clock in' : 'Choose a job', dot: null, back: !o.first }
  if (mode === 'details') return { title: 'North Time', sub: o.switching ? 'Check the details, then switch' : 'Check the details, then clock in', dot: null, back: true }
  const t = liveTotals(d, o.nowMs)
  return { title: 'North Time', sub: `${d.todayLabel} · Today ${formatDuration(t.today)} · Week ${formatDuration(t.week)}`, dot: null, back: false }
}

/** The muted line under the chips when the real start differs from the recorded one. */
export const roundNoteText = (n: { recorded: string; real: string }): string =>
  `Counted from ${n.recorded}. It started at ${n.real}; times round to the nearest 15 minutes.`

/** What screen readers hear when the clock changes state, never every second. */
export function liveAnnouncement(kind: TopBarKind): string {
  return kind === 'on' || kind === 'over' ? 'On the clock' : kind === 'auto' ? 'Clock stopped. Confirm your end time.' : 'Off the clock'
}

/**
 * The clock's own now: the server's, kept ticking. The difference between the
 * two clocks is kept only when it is real (a device clock that is off), not
 * the second or two the data took to arrive.
 */
export function clockSkew(serverNowIso: string, clientNowMs: number): number {
  const skew = Date.parse(serverNowIso) - clientNowMs
  return Math.abs(skew) < 5000 ? 0 : skew
}

// ── Drafts (1D, 1J) ─────────────────────────────────────────────────────────

/** What 1D is filling in before the clock starts: the job, the fields, the notes. */
export interface Draft {
  jobId: number
  /** tc_fields id -> value */
  values: Record<string, string>
  notes: string
  /** Filled from the job's history and not touched since (the "auto" hint). */
  auto: Partial<Record<FieldName, boolean>>
}

/** A job chosen: Company, Project, Billable (and the i7 Code) from its usual values; Activity left for the person. */
export function draftFor(d: Pick<ClockPanelData, 'defaults' | 'fields'>, job: Pick<PanelJob, 'id' | 'isI7' | 'structure'>, extra: { activity?: string; notes?: string } = {}): Draft {
  const def = d.defaults[String(job.id)] ?? {}
  const values: Record<string, string> = {}
  const auto: Partial<Record<FieldName, boolean>> = {}
  for (const key of keysFor(job.isI7)) {
    const f = fieldByKey(d.fields, key, job)
    if (!f) continue
    if (key === 'activity') { values[f.id] = extra.activity ?? ''; continue }
    values[f.id] = def[f.id] ?? ''
    auto[key] = key === 'code' ? job.isI7 : !!def[f.id]
  }
  return { jobId: job.id, values, notes: extra.notes ?? '', auto }
}

/** The fields a choice carries, limited to what its job asks. */
export function choiceValues(values: Readonly<Record<string, string>>, fields: readonly PanelField[], job: { isI7: boolean; structure?: Structure } | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of keysFor(!!job?.isI7)) {
    const f = fieldByKey(fields, key, job)
    if (f && values[f.id]) out[f.id] = values[f.id]
  }
  return out
}

/** The combination being saved or edited (1J). */
export interface SaveDraft {
  /** The combination being edited, or null for a new one. */
  editing: number | null
  name: string
  jobId: number
  values: Record<string, string>
  notes: string
}

/** 1J from a choice, a recent or a draft: the name offered is the saved one, else a suggestion. */
export function saveDraftFrom(
  d: Pick<ClockPanelData, 'jobs' | 'fields'>,
  src: { jobId: number; values: Readonly<Record<string, string>>; notes: string; name?: string | null; editing?: number | null },
): SaveDraft {
  const job = d.jobs.find(j => j.id === src.jobId)
  const activity = valueOf(src.values, d.fields, 'activity')
  return {
    editing: src.editing ?? null,
    name: src.name || (job ? suggestName(job.short, job.folderId != null, activity) : ''),
    jobId: src.jobId,
    values: { ...src.values },
    notes: src.notes,
  }
}
