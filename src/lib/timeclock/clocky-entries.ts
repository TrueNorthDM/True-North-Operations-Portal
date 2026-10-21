/**
 * Time entries' data (design handoff of 16 October 2026, SPEC sections 8 and
 * 9, Time Entries.dc.html): the rows of a period for the viewer's scope, with
 * their status pills, what each may do, what needs attention, the totals, the
 * pending corrections (which count in no total) and pending time off; an
 * entry's history; and the viewer's own period to submit.
 *
 * Not a "use server" file: app/(app)/clocky-hours/entries-actions.ts serves it.
 */

import type { Db } from '@/lib/supabase/types'
import { allRows, db, loadCadenceChanges, loadCatalog, loadClockySettings, loadDirectory, must, rulesFor, type Catalog, type Directory, type Viewer } from './clocky-context'
import { loadSubmissions, lockOn, type EntryRow } from './clocky-store'
import { entrySeconds } from './clocky-panel'
import { clientOf, dayLabel, initials, localDate, timeLabel, zoneAbbr } from './format'
import { formatDuration, recordedSeconds } from './rounding'
import { attentionReason, missingFields, overlapsAmong } from './entry-rules'
import { historyLines, type AuditRow } from './history'
import { holidaysBetween, offDays } from './time-off'
import { SUBMIT_LOOKBACK, isSent, addDays, cadenceLine, cadenceOn, daysBetween, periodContaining, periodLabel, periodToSubmit, type CadenceRules, type Period, type SubmittedPeriod } from './periods'
import { canApproveCorrection, canDecideTimeOff, canView, changeRight, isLeader, seesEveryone, whoChoice } from './scope'
import type { AttentionItem, EntriesData, EntryView, HistoryData, Pill, SubmitSummary } from './clocky-types'
import { attentionOrder, goesToLabel, requestHistoryLines, teamLeadNames } from './clocky-requests'
import { loadInvoiceSettings, loadPayTerms } from './pay-terms'
import { hoursApprover, invoiceApprover } from './routing'
import { buildSubmitBlock } from './submit-block'

/** The longest range one read covers: a month and a bit, so a month view always fits. */
export const MAX_RANGE_DAYS = 62

export interface EntriesQuery {
  from: string
  to: string
  /** 'my' (own), or 'all': everyone the viewer may see ("My team" for a Team Leader). */
  who: 'my' | 'all'
  /** Narrow 'all' to one person (the Team member picker). */
  personId?: string
  /** Narrow 'all' to one team (the team chips in the picker). */
  teamId?: string
}

/** Whose hours a query covers, decided by scope (lib/timeclock/scope.ts). Null: everyone. */
export function peopleInScope(v: Viewer, dir: Directory, q: Pick<EntriesQuery, 'who' | 'personId' | 'teamId'>): string[] | null {
  if (q.who === 'my') return [v.personId]
  if (q.personId) return canView(v, dir.target(q.personId)) ? [q.personId] : []
  const everyone = seesEveryone(v)
  if (q.teamId) return [...dir.people.values()].filter(p => p.teamIds.includes(q.teamId!) && canView(v, dir.target(p.id))).map(p => p.id)
  if (everyone) return null
  return [...dir.people.values()].filter(p => canView(v, dir.target(p.id))).map(p => p.id)
}

const PILL = {
  ok: (text: string, tip = ''): Pill => ({ text, tone: 'ok', tip }),
  warn: (text: string, tip = ''): Pill => ({ text, tone: 'warn', tip }),
  bad: (text: string, tip = ''): Pill => ({ text, tone: 'bad', tip }),
  neutral: (text: string, tip = ''): Pill => ({ text, tone: 'neutral', tip }),
}

const STATE_LABEL: Record<string, string> = { open: 'Open', submitted: 'Submitted', approved: 'Approved', locked: 'Approved' }

function timeText(start: string | null, end: string | null, running: boolean, zone: string): string {
  if (!start) return 'Duration only'
  return `${timeLabel(start, zone)} to ${running || !end ? 'now' : timeLabel(end, zone)}`
}

interface Ctx { v: Viewer; dir: Directory; catalog: Catalog; now: Date; subs: Map<string, SubmittedPeriod[]> }

/** One entry as Time entries shows it. */
export function entryView(e: EntryRow, x: Ctx, overlap: boolean): EntryView {
  const { v, dir, catalog, now } = x
  const person = dir.people.get(e.person_id)
  const zone = dir.zoneOf(e.person_id)
  const job = catalog.jobs.get(e.jobcode_id ?? -1)
  const fields = (e.fields ?? {}) as Record<string, string>
  const k = catalog.keys
  const val = (id: string | null) => (id ? fields[id] ?? '' : '')
  const running = e.ended_at === null && e.kind === 'clock' && !!e.started_at
  const lock = lockOn([e.entry_date], x.subs.get(e.person_id) ?? [], e.state)
  const right = changeRight(v, dir.target(e.person_id))
  const seconds = entrySeconds(e, now)
  const kind = (e.kind === 'manual' || e.kind === 'absence' ? e.kind : 'clock') as EntryView['kind']
  const autoOut = e.auto_stopped_at ? { confirmed: !!e.end_confirmed_at, flagged: e.end_flagged } : null
  const team = person?.teamId ? dir.teams.get(person.teamId) : undefined

  const pills: Pill[] = []
  if (kind === 'absence') pills.push(PILL.ok('Time off: Approved'))
  else if (running) pills.push(PILL.ok('Running', 'The clock is running'))
  else {
    const label = lock ? (lock.state === 'approved' || lock.state === 'recorded' ? 'Approved' : 'Submitted') : STATE_LABEL[e.state] ?? 'Open'
    pills.push(label === 'Approved' ? PILL.ok(label, e.source === 'tsheets' ? 'Imported from QuickBooks Time' : '') : PILL.neutral(label, e.source === 'tsheets' ? 'Imported from QuickBooks Time' : ''))
  }
  if (autoOut) pills.push(PILL.bad('Auto out', autoOut.confirmed ? 'Stopped by Clocky after 5h 00m. Real end time confirmed.' : 'Stopped by Clocky after 5h 00m. End time not confirmed.'))
  if (e.edited_by) pills.push(PILL.neutral('Edited', `Edited by ${dir.nameOf(e.edited_by)}`))

  const canChange = kind !== 'absence' && !lock && right !== 'none'
  return {
    key: `e${e.id}`,
    rowType: 'entry',
    id: e.id,
    personId: e.person_id,
    personName: person?.name ?? 'Someone',
    initials: initials(person?.name ?? ''),
    team: team ? { id: team.id, name: team.name, color: team.color } : null,
    zone,
    zoneAbbr: zone !== v.zone ? zoneAbbr(zone, new Date(e.started_at ?? now)) : '',
    date: e.entry_date,
    start: e.started_at,
    end: e.ended_at,
    running,
    timeText: timeText(e.started_at, e.ended_at, running, zone),
    seconds,
    jobcodeId: e.jobcode_id,
    path: job?.path ?? '',
    short: job?.short ?? '',
    client: clientOf(job?.path ?? ''),
    isI7: !!job?.isI7,
    fields,
    company: val(k.company), project: val(k.project), activity: val(k.activity), billable: val(k.billable), code: val(k.code),
    notes: e.notes ?? '',
    kind,
    imported: e.source === 'tsheets',
    pills,
    autoOut,
    edited: e.edited_by ? { by: dir.nameOf(e.edited_by), at: e.edited_at ?? e.updated_at } : null,
    clockedOutBy: e.clocked_out_by ? dir.nameOf(e.clocked_out_by) : null,
    locked: !!lock,
    lockWhy: lock ? lock.state : null,
    canEdit: canChange,
    shortenOnly: right === 'shorten',
    canDelete: canChange,
    canContinue: e.person_id === v.personId && kind !== 'absence' && !!e.started_at && !running && !!job?.selectable,
    continuesPrevious: false,
    attention: attentionReason({
      kind,
      autoStoppedUnconfirmed: !!e.auto_stopped_at && !e.end_confirmed_at,
      missing: kind === 'absence' ? [] : missingFields(fields, e.notes, k, !!job?.isI7),
      seconds,
      overlaps: overlap,
    }),
    correction: null,
    timeOff: null,
  }
}

const EMPTY_FIELDS = { company: '', project: '', activity: '', billable: '', code: '' }

export async function loadEntries(v: Viewer, q: EntriesQuery, now: Date): Promise<EntriesData> {
  const c = db()
  const [dir, catalog, settings] = await Promise.all([loadDirectory(), loadCatalog(), loadClockySettings()])
  const span = daysBetween(q.from, q.to)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(q.from) || !/^\d{4}-\d{2}-\d{2}$/.test(q.to) || span < 0 || span > MAX_RANGE_DAYS) {
    throw new Error('That range cannot be shown.')
  }
  const scope = peopleInScope(v, dir, q)
  const ids = scope ?? null
  const none = ids !== null && ids.length === 0

  const withPeople = <T extends { in: (col: string, vals: string[]) => T }>(qq: T): T => (ids ? qq.in('person_id', ids) : qq)
  const [entries, corrections, timeOff] = none ? [[], [], []] : await Promise.all([
    allRows<EntryRow>((a, b) => withPeople(c.from('tc_entries').select('*').gte('entry_date', q.from).lte('entry_date', q.to))
      .order('entry_date').order('started_at', { nullsFirst: false }).order('id').range(a, b), 'Entries could not be read'),
    allRows<{ id: number; person_id: string; entry_date: string; started_at: string; ended_at: string; jobcode_id: number; fields: Record<string, string>; notes: string | null; reason: string; state: string; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null }>(
      (a, b) => withPeople(c.from('tc_correction_requests').select('*').gte('entry_date', q.from).lte('entry_date', q.to).in('state', ['pending', 'denied']))
        .order('id').range(a, b), 'Time corrections could not be read'),
    allRows<{ id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; reason: string | null }>(
      (a, b) => withPeople(c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, hours_per_day, state, reason')
        .lte('start_date', q.to).gte('end_date', q.from).in('state', ['pending', 'denied'])).order('id').range(a, b), 'Time off could not be read'),
  ])

  const involved = [...new Set([...entries.map(e => e.person_id), ...(ids ?? []), v.personId])]
  const [subs, changes] = await Promise.all([loadSubmissions(c, involved), loadCadenceChanges(c)])
  const x: Ctx = { v, dir, catalog, now, subs }

  const timed = entries.filter(e => e.started_at && e.kind !== 'absence').map(e => ({ id: e.id, personId: e.person_id, start: e.started_at, end: e.ended_at }))
  const overlapping = overlapsAmong(timed, now)

  const rows: EntryView[] = entries.map(e => entryView(e, x, overlapping.has(e.id)))
  // A switch: the person's next entry starts the moment the previous one ended.
  const byPerson = new Map<string, EntryView[]>()
  for (const r of rows) if (r.start) (byPerson.get(r.personId) ?? byPerson.set(r.personId, []).get(r.personId)!).push(r)
  for (const list of byPerson.values()) {
    list.sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
    for (let i = 1; i < list.length; i++) if (list[i - 1].end && list[i - 1].end === list[i].start && list[i - 1].kind !== 'absence') list[i].continuesPrevious = true
  }

  for (const r of corrections) {
    const person = dir.people.get(r.person_id)
    const zone = dir.zoneOf(r.person_id)
    const job = catalog.jobs.get(r.jobcode_id)
    const team = person?.teamId ? dir.teams.get(person.teamId) : undefined
    const state = r.state as 'pending' | 'approved' | 'denied'
    const decides = canApproveCorrection(v, dir.target(r.person_id))
    const goesTo = goesToLabel(teamLeadNames(r.person_id, dir.target(r.person_id).teamIds, dir.led, id => !!dir.people.get(id)?.active, id => dir.nameOf(id)))
    const f = r.fields ?? {}
    const k = catalog.keys
    rows.push({
      key: `c${r.id}`, rowType: 'correction', id: r.id, personId: r.person_id,
      personName: person?.name ?? 'Someone', initials: initials(person?.name ?? ''),
      team: team ? { id: team.id, name: team.name, color: team.color } : null,
      zone, zoneAbbr: zone !== v.zone ? zoneAbbr(zone, new Date(r.started_at)) : '',
      date: r.entry_date, start: r.started_at, end: r.ended_at, running: false,
      timeText: timeText(r.started_at, r.ended_at, false, zone),
      seconds: recordedSeconds(r.started_at, r.ended_at),
      jobcodeId: r.jobcode_id, path: job?.path ?? '', short: job?.short ?? '', client: clientOf(job?.path ?? ''), isI7: !!job?.isI7,
      fields: f,
      company: k.company ? f[k.company] ?? '' : '', project: k.project ? f[k.project] ?? '' : '', activity: k.activity ? f[k.activity] ?? '' : '',
      billable: k.billable ? f[k.billable] ?? '' : '', code: k.code ? f[k.code] ?? '' : '',
      notes: r.notes ?? r.reason, kind: 'correction', imported: false,
      pills: [state === 'pending' ? PILL.warn('Correction: Pending', 'Requested time. It counts only after it is approved.')
        : PILL.bad('Correction: Denied', 'Requested time. It counts only after it is approved.')],
      autoOut: null, edited: null, clockedOutBy: null, locked: false, lockWhy: null,
      canEdit: false, shortenOnly: false, canDelete: false, canContinue: false, continuesPrevious: false,
      attention: attentionReason({ kind: 'correction', pending: state === 'pending', viewerDecides: decides }),
      correction: { state, reason: r.reason, requestedAt: r.requested_at, decidedBy: r.decided_by ? dir.nameOf(r.decided_by) : null, decidedAt: r.decided_at, decisionNote: r.decision_note, canDecide: decides && state === 'pending', goesTo },
      timeOff: null,
    })
  }

  for (const r of timeOff) {
    const person = dir.people.get(r.person_id)
    const team = person?.teamId ? dir.teams.get(person.teamId) : undefined
    const decides = canDecideTimeOff(v, dir.target(r.person_id))
    const type = catalog.jobs.get(r.jobcode_id)?.name ?? 'Time off'
    for (const day of offDays(r.start_date, r.end_date, holidaysBetween(r.start_date, r.end_date)).days.filter(d => d >= q.from && d <= q.to)) {
      rows.push({
        key: `o${r.id}:${day}`, rowType: 'time_off', id: r.id, personId: r.person_id,
        personName: person?.name ?? 'Someone', initials: initials(person?.name ?? ''),
        team: team ? { id: team.id, name: team.name, color: team.color } : null,
        zone: dir.zoneOf(r.person_id), zoneAbbr: '',
        date: day, start: null, end: null, running: false, timeText: 'All day',
        seconds: Math.round(Number(r.hours_per_day) * 3600),
        jobcodeId: r.jobcode_id, path: `Time off › ${type}`, short: type, client: 'Time off', isI7: false,
        fields: {}, ...EMPTY_FIELDS, notes: r.reason ?? '', kind: 'time_off', imported: false,
        pills: [r.state === 'pending' ? PILL.warn('Time off: Pending') : PILL.bad('Time off: Denied')],
        autoOut: null, edited: null, clockedOutBy: null, locked: false, lockWhy: null,
        canEdit: false, shortenOnly: false, canDelete: false, canContinue: false, continuesPrevious: false,
        attention: attentionReason({ kind: 'time_off', pending: r.state === 'pending', viewerDecides: decides }),
        correction: null,
        timeOff: { type, state: r.state, startDate: r.start_date, endDate: r.end_date, hoursPerDay: Number(r.hours_per_day), note: r.reason ?? '', canDecide: decides && r.state === 'pending' },
      })
    }
  }

  rows.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1)
    : a.personName.localeCompare(b.personName) || ((a.start ? Date.parse(a.start) : 9e15) - (b.start ? Date.parse(b.start) : 9e15))))

  // Totals: work only (clocked and typed hours); time off and corrections count in none.
  const work = rows.filter(r => r.rowType === 'entry' && r.kind !== 'absence')
  const total = work.reduce((s, r) => s + r.seconds, 0)
  const billable = work.filter(r => r.billable === 'yes').reduce((s, r) => s + r.seconds, 0)
  const byClient = new Map<string, number>()
  for (const r of work) byClient.set(r.client, (byClient.get(r.client) ?? 0) + r.seconds)
  const days = [...new Set(rows.map(r => r.date))].sort().reverse().map(date => {
    const d = rows.filter(r => r.date === date)
    return { date, label: dayLabel(date), seconds: d.filter(r => r.rowType === 'entry' && r.kind !== 'absence').reduce((s, r) => s + r.seconds, 0), people: new Set(d.map(r => r.personId)).size }
  })
  const all = q.who === 'all'
  // Oldest first, the entries before the requests, as the prototype lists its Needs attention.
  const attention: AttentionItem[] = attentionOrder(rows.filter(r => r.attention)).map(r => attentionItem(r, all))

  // The viewer's own period and where it stands (the Submit button).
  const today = localDate(now, v.zone)
  const myRules = rulesFor(v.personId, changes, settings)
  const period = await submitTarget(c, v.personId, today, myRules, subs.get(v.personId) ?? [])
  const mine = (subs.get(v.personId) ?? []).find(s => s.start === period.start && s.end === period.end)

  const peopleList = [...dir.people.values()]
    .filter(p => p.active && canView(v, dir.target(p.id)))
    .map(p => ({ id: p.id, name: p.name, zone: dir.zoneOf(p.id), teamIds: p.teamIds, cadence: cadenceOn(today, rulesFor(p.id, changes, settings)).cadence }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const teamIds = new Set(peopleList.flatMap(p => p.teamIds))

  return {
    viewer: {
      personId: v.personId, zone: v.zone, level: v.level, leader: v.leader, who: whoChoice(v),
      cadence: cadenceOn(today, myRules).cadence, canSubmit: v.can('clocky-hours'),
    },
    range: { from: q.from, to: q.to },
    rows,
    days,
    totals: {
      seconds: total, billable, nonBillable: total - billable, entries: work.length, attention: attention.length,
      byClient: [...byClient.entries()].map(([client, seconds]) => ({ client, seconds })).sort((a, b) => b.seconds - a.seconds),
    },
    attention,
    people: peopleList,
    teams: [...dir.teams.values()].filter(t => teamIds.has(t.id)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map(t => ({ id: t.id, name: t.name, color: t.color })),
    submit: { ...period, ...periodLabel(period), state: mine?.state ?? null, submitted: isSent(mine?.state) },
    canAdd: isLeader(v),
    anchors: settings.anchors.map(a => ({ anchor: a.anchor, effectiveFrom: a.effectiveFrom })),
  }
}

/** A row in Needs attention: "Thu, Oct 15 · 8:00 AM to 12:40 PM · i7 › Web Dev", with Review, Fix or View history. */
export function attentionItem(r: EntryView, all: boolean): AttentionItem {
  const sub = r.rowType === 'time_off'
    ? `${r.personName} · ${dayLabel(r.date)} · Time off · ${r.short}`
    : `${all || r.rowType === 'correction' ? `${r.personName} · ` : ''}${dayLabel(r.date)} · ${r.timeText} · ${r.short}`
  return {
    key: r.key,
    reason: r.attention ?? '',
    sub,
    cta: r.rowType !== 'entry' ? 'Review' : r.canEdit ? 'Fix' : 'View history',
  }
}

// ── History (3G) ────────────────────────────────────────────────────────────

export async function entryHistory(v: Viewer, id: number, now: Date): Promise<HistoryData | null> {
  const c = db()
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const e = must(await c.from('tc_entries').select('*').eq('id', id).maybeSingle(), 'The entry could not be read') as EntryRow | null
  if (!e || !canView(v, dir.target(e.person_id))) return null
  const [audit, request] = await Promise.all([
    c.from('tc_entry_audit').select('id, action, changed_by, changed_at, before, after, reason').eq('entry_id', id).order('changed_at').order('id'),
    c.from('tc_correction_requests').select('requested_at, reason, started_at, ended_at, jobcode_id').eq('entry_id', id).maybeSingle(),
  ])
  const rows = (must(audit, 'The history could not be read') ?? []) as unknown as AuditRow[]
  const req = must(request, 'The request could not be read') as { requested_at: string; reason: string; started_at: string; ended_at: string; jobcode_id: number } | null
  const zone = dir.zoneOf(e.person_id)
  const names = new Map([...dir.people.values()].map(p => [p.id, p.name]))
  const lines = historyLines({
    audit: rows, names, personId: e.person_id, ownerZone: zone, viewerZone: v.zone, keys: catalog.keys,
    jobPath: catalog.pathOf(e.jobcode_id),
    importedAt: e.source === 'tsheets' ? e.created_at : null,
    request: req ? { requestedAt: req.requested_at, reason: req.reason, seconds: recordedSeconds(req.started_at, req.ended_at), job: catalog.pathOf(req.jobcode_id) } : null,
  })
  const running = e.ended_at === null && e.kind === 'clock' && !!e.started_at
  const abbr = zone !== v.zone ? ` ${zoneAbbr(zone, new Date(e.started_at ?? now))}` : ''
  return {
    summary: `${dir.nameOf(e.person_id)} · ${catalog.pathOf(e.jobcode_id)} · ${dayLabel(e.entry_date)}, ${timeText(e.started_at, e.ended_at, running, zone)}${abbr} (${formatDuration(entrySeconds(e, now))})`,
    lines,
    real: { start: e.started_at_real, end: e.ended_at_real },
    recorded: { start: e.started_at, end: e.ended_at },
  }
}

/**
 * A time correction request's history (3G on a "Correction: Pending" or
 * "Correction: Denied" row): who asked and what happened, and the decision.
 * The person, their leads and the approvers see it, as they see the row.
 */
export async function correctionHistory(v: Viewer, id: number, now: Date): Promise<HistoryData | null> {
  const c = db()
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const r = must(await c.from('tc_correction_requests').select('*').eq('id', id).maybeSingle(), 'The request could not be read') as
    { id: number; person_id: string; entry_date: string; started_at: string; ended_at: string; jobcode_id: number; reason: string; state: string; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null } | null
  if (!r || !canView(v, dir.target(r.person_id))) return null
  const zone = dir.zoneOf(r.person_id)
  const owner = dir.nameOf(r.person_id)
  const seconds = recordedSeconds(r.started_at, r.ended_at)
  const job = catalog.pathOf(r.jobcode_id)
  const abbr = zone !== v.zone ? ` ${zoneAbbr(zone, new Date(r.started_at ?? now))}` : ''
  const decided = r.decided_by && r.decided_at && (r.state === 'approved' || r.state === 'denied')
    ? { by: dir.nameOf(r.decided_by), at: r.decided_at, state: r.state as 'approved' | 'denied', note: r.decision_note }
    : null
  return {
    summary: `${owner} · ${job} · ${dayLabel(r.entry_date)}, ${timeText(r.started_at, r.ended_at, false, zone)}${abbr} (${formatDuration(seconds)})`,
    lines: requestHistoryLines({ owner, requestedAt: r.requested_at, seconds, job, reason: r.reason, decided, viewerZone: v.zone }),
    real: { start: r.started_at, end: r.ended_at },
    recorded: { start: r.started_at, end: r.ended_at },
  }
}

// ── Submit (3H) ─────────────────────────────────────────────────────────────

export async function loadSubmitSummary(v: Viewer, now: Date, start?: string): Promise<SubmitSummary> {
  return loadPeriodSummary(v, v.personId, now, start)
}

/**
 * One person's period as the Submit window reads it: their own (the viewer's),
 * or someone's sent timesheet on the Approvals card (Super Admins). The caller
 * decides who may read whose.
 */
export async function loadPeriodSummary(v: Viewer, personId: string, now: Date, start?: string): Promise<SubmitSummary> {
  const c = db()
  const [dir, catalog, settings] = await Promise.all([loadDirectory(), loadCatalog(), loadClockySettings()])
  const today = localDate(now, v.zone)
  const [changes, subs] = await Promise.all([loadCadenceChanges(c, [personId]), loadSubmissions(c, [personId])])
  const rules = rulesFor(personId, changes, settings)
  const period = start ? periodContaining(start, rules) : await submitTarget(c, personId, today, rules, subs.get(personId) ?? [])
  const entries = await allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').eq('person_id', personId)
    .gte('entry_date', period.start).lte('entry_date', period.end).order('id').range(a, b), 'Your entries could not be read')
  const x: Ctx = { v, dir, catalog, now, subs }
  const overlapping = overlapsAmong(entries.filter(e => e.started_at).map(e => ({ id: e.id, personId: e.person_id, start: e.started_at, end: e.ended_at })), now)
  const views = entries.map(e => entryView(e, x, overlapping.has(e.id)))
  const work = views.filter(r => r.kind !== 'absence')
  const byClient = new Map<string, number>()
  for (const r of work) byClient.set(r.client, (byClient.get(r.client) ?? 0) + r.seconds)
  const noTime: string[] = []
  for (let d = period.start; d <= period.end && d <= today; d = addDays(d, 1)) {
    const w = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (w > 0 && w < 6 && !entries.some(e => e.entry_date === d)) noTime.push(dayLabel(d))
  }
  const attention = attentionOrder(work.filter(r => r.attention)).map(r => attentionItem(r, false))
  const running = work.some(r => r.running)
  const mine = (subs.get(personId) ?? []).find(s => s.start === period.start && s.end === period.end)
  const done = isSent(mine?.state)
  const label = periodLabel(period)
  const workedSeconds = work.reduce((s, r) => s + r.seconds, 0)
  const sortedClients = [...byClient.entries()].map(([client, seconds]) => ({ client, seconds })).sort((a, b) => b.seconds - a.seconds)
  const timeOff = views.filter(r => r.kind === 'absence').map(r => ({ date: r.date, kind: r.short || r.path || 'Time off', seconds: r.seconds }))
  // Days with no time, and the time off that covers the others (6B: "None. Fri, Oct 16 is Vacation.").
  const noTimeText = noTime.length ? noTime.join(', ')
    : timeOff.length ? `None. ${timeOff.map(t => `${dayLabel(t.date)} is ${t.kind}`).join(', ')}.` : 'None. Every weekday has time.'
  const block = await submitBlockFor(dir, personId, label, sortedClients, timeOff, workedSeconds)
  return {
    start: period.start,
    end: period.end,
    kind: period.kind,
    title: `Submit ${label.full}?`,
    label: label.label,
    cadenceLine: cadenceLine(period),
    lockNote: `After you submit, ${label.label} locks. Only a Super Admin can reopen it.`,
    state: mine?.state ?? null,
    running,
    totalSeconds: workedSeconds,
    byClient: sortedClients,
    noTime: noTimeText,
    attention,
    canSubmit: !running && !attention.length && !done && entries.length > 0,
    totalLabel: block?.kind === 'payroll' ? 'Worked' : 'Total',
    block,
  }
}

/** The Submit window's invoice or payroll block, for the person's own period. Never breaks the window: null on a failed read. */
async function submitBlockFor(dir: Directory, personId: string, label: { label: string; full: string }, byClient: { client: string; seconds: number }[], timeOff: { date: string; kind: string; seconds: number }[], workedSeconds: number): Promise<SubmitSummary['block']> {
  try {
    const [settings, terms, { data: rmb, error }] = await Promise.all([
      loadInvoiceSettings(),
      loadPayTerms([personId]),
      db().from('reimbursements').select('id, category, purpose, amount').eq('person_id', personId).eq('state', 'approved').is('invoice_id', null).order('asked_at'),
    ])
    if (error) throw new Error(error.message)
    const t = terms.get(personId)
    if (!t) return null
    const hb = hoursApprover(t.route, settings)
    const ib = invoiceApprover(t.route, settings)
    return buildSubmitBlock({
      isContractor: t.route.isContractor, paysAs: t.paysAs, hourlyRate: t.hourlyRate, fixedAmount: t.fixedAmount,
      periodName: label.full, label: label.label, byClient,
      reimbursements: (rmb ?? []).map(r => ({ id: r.id, category: r.category, purpose: r.purpose, amount: Number(r.amount) })),
      timeOff, workedSeconds, hoursBy: hb ? dir.nameOf(hb) : null, invoiceBy: ib ? dir.nameOf(ib) : null,
    })
  } catch (e) {
    console.error('[clocky submit] block:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * The period the person's Submit button sends: the oldest recent one with
 * Clocky time that was never sent, else today's (periodToSubmit).
 */
async function submitTarget(c: Db, personId: string, today: string, rules: CadenceRules, subs: readonly SubmittedPeriod[]): Promise<Period> {
  let from = periodContaining(today, rules).start
  for (let i = 0; i < SUBMIT_LOOKBACK; i++) from = periodContaining(addDays(from, -1), rules).start
  const { data, error } = await c.from('tc_entries').select('entry_date').eq('person_id', personId).eq('source', 'portal')
    .gte('entry_date', from).lt('entry_date', periodContaining(today, rules).start).limit(1000)
  if (error) throw new Error(`Your periods could not be read: ${error.message}`)
  return periodToSubmit(today, rules, subs, new Set(((data ?? []) as { entry_date: string }[]).map(r => r.entry_date)))
}

/** The person's lock for a set of days, read fresh (for an action about to write). */
export async function lockFor(c: Db, personId: string, days: readonly string[], entryState?: string | null) {
  const subs = await loadSubmissions(c, [personId])
  return lockOn(days, subs.get(personId) ?? [], entryState)
}

/**
 * One person's entries in a period as Time entries shows them (Clocky part 2,
 * the 6C page's Summary, Time entries and Combined tabs). The caller decides
 * who may read whose.
 */
export async function loadPeriodViews(v: Viewer, personId: string, start: string, end: string, now = new Date()): Promise<EntryView[]> {
  const c = db()
  const [dir, catalog, subs] = await Promise.all([loadDirectory(), loadCatalog(), loadSubmissions(c, [personId])])
  const entries = await allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').eq('person_id', personId)
    .gte('entry_date', start).lte('entry_date', end).order('started_at', { ascending: true, nullsFirst: false }).order('id').range(a, b), 'The entries could not be read')
  const x: Ctx = { v, dir, catalog, now, subs }
  const overlapping = overlapsAmong(entries.filter(e => e.started_at).map(e => ({ id: e.id, personId: e.person_id, start: e.started_at, end: e.ended_at })), now)
  return entries.map(e => entryView(e, x, overlapping.has(e.id)))
}
