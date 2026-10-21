/**
 * Who's working, the arithmetic and the copy (Design/design_handoff_clocky/
 * Who's Working.dc.html, renderVals): the filter, the sort, the groups by
 * team, each person's row (local time, timer, day and week, the tags), and
 * the end times "Clock out for them..." offers. Pure, so the screens and the
 * tests ask the same questions.
 */

import type { WhosWorkingData, WorkingPerson } from '@/lib/timeclock/clocky-types'
import { dayLabel, localDate, timeLabel } from '@/lib/timeclock/format'
import { formatClock, formatTimer, runningSeconds } from '@/lib/timeclock/rounding'
import { WARN_AFTER_SECONDS } from '@/lib/timeclock/safety'

export type WorkingFilter = 'on' | 'all'
export const SORTS = ['Day total', 'Clock-in time', 'Name', 'Job'] as const
export type WorkingSort = typeof SORTS[number]

export interface WorkingTag { text: string; bg: string; fg: string; tip: string }

export interface WorkingRow {
  person: WorkingPerson
  /** "On the clock", "Auto out", "Off" (the dot's words). */
  status: string
  dot: string
  /** The job and Activity, or "Off the clock, last: 5:10 PM". */
  line: string
  lineFg: string
  /** "2:15 PM EAT" */
  local: string
  timer: string
  timerFg: string
  warn: boolean
  day: string
  week: string
  daySeconds: number
  tags: WorkingTag[]
}

/** "Thu, Oct 15, 10:59 AM (your time)" */
export const viewerTime = (nowMs: number, zone: string): string =>
  `${dayLabel(localDate(new Date(nowMs), zone))}, ${timeLabel(new Date(nowMs), zone)} (your time)`

/** "You lead Web, so you see your team only." */
export function scopeText(teamNames: readonly string[]): string {
  if (teamNames.length <= 1) return `You lead ${teamNames[0] ?? 'your team'}, so you see your team only.`
  return `You lead ${teamNames.slice(0, -1).join(', ')} and ${teamNames[teamNames.length - 1]}, so you see your teams only.`
}

/** On the clock 4h 30m or more since they clocked in, across switches, counted live. */
export function isOver(p: WorkingPerson, nowMs: number): boolean {
  if (p.status !== 'on' || !p.current) return false
  const from = p.current.sessionStartedAt ?? p.current.timerFrom
  return p.over || (nowMs - Date.parse(from)) / 1000 >= WARN_AFTER_SECONDS
}

/** What the running entry adds since the data was read, on the quarter hour. */
function growth(p: WorkingPerson, dataNowMs: number, nowMs: number): number {
  if (p.status !== 'on' || !p.current) return 0
  return runningSeconds(p.current.startedAt, new Date(nowMs)) - runningSeconds(p.current.startedAt, new Date(dataNowMs))
}

export function rowOf(p: WorkingPerson, o: { nowMs: number; dataNowMs: number; viewerZone: string }): WorkingRow {
  const on = p.status === 'on' && !!p.current
  const warn = isOver(p, o.nowMs)
  const g = growth(p, o.dataNowMs, o.nowMs)
  const day = Math.max(0, p.daySeconds + g)
  const week = Math.max(0, p.weekSeconds + g)
  const tags: WorkingTag[] = []
  if (p.autoOutToday) tags.push({ text: 'Auto out', bg: '#fdeeef', fg: '#c8323d', tip: `Clocky stopped this clock at ${timeLabel(p.autoOutToday.at, o.viewerZone)} after 5h 00m` })
  if (p.allowanceOver) tags.push({ text: 'Over', bg: '#fdeeef', fg: '#c8323d', tip: p.allowanceOver })
  if (p.clockedOutBy) tags.push({ text: `Clocked out by ${p.clockedOutBy.name}`, bg: '#f1f3f6', fg: '#5b6b82', tip: p.clockedOutBy.reason ?? '' })
  if (warn && p.keptGoingAt) tags.push({ text: 'Kept going', bg: '#f1f3f6', fg: '#5b6b82', tip: `Answered "Still working?" at ${timeLabel(p.keptGoingAt, o.viewerZone)}` })
  const status = on ? 'On the clock' : p.autoOutToday || p.clockedOutBy ? 'Auto out' : 'Off'
  return {
    person: p,
    status,
    dot: on ? '#1E9E6A' : '#cbd2da',
    line: on ? `${p.current!.path} · ${p.current!.activity}` : p.lastOut ? `Off the clock, last: ${p.lastOut}` : 'Off the clock',
    lineFg: on ? '#435066' : '#8593a4',
    local: `${timeLabel(new Date(o.nowMs), p.zone)} ${p.zoneAbbr}`,
    timer: on ? formatTimer((o.nowMs - Date.parse(p.current!.timerFrom)) / 1000) : 'Off',
    timerFg: warn ? '#8a6d1a' : on ? '#012358' : '#a3aebb',
    warn,
    day: formatClock(day),
    week: formatClock(week),
    daySeconds: day,
    tags,
  }
}

export interface WorkingGroup { key: string; name: string; color: string; count: string; rows: WorkingRow[] }

/**
 * The list: filtered ("On the clock" hides who is off), searched (name or
 * job), sorted, and grouped by team with "No team" last. Teams come in
 * `teamOrder` when given (a design check's order), else by name.
 */
export function groupsOf(data: WhosWorkingData, o: {
  nowMs: number; filter: WorkingFilter; sort: WorkingSort; query: string; teamOrder?: readonly string[]
}): WorkingGroup[] {
  const q = o.query.trim().toLowerCase()
  const dataNowMs = Date.parse(data.now)
  let list = data.people
  if (o.filter === 'on') list = list.filter(p => p.status !== 'off')
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q) || (p.current?.path ?? '').toLowerCase().includes(q))
  const rows = list.map(p => rowOf(p, { nowMs: o.nowMs, dataNowMs, viewerZone: data.viewer.zone }))
  const startOf = (r: WorkingRow) => (r.person.current ? Date.parse(r.person.current.timerFrom) : Number.POSITIVE_INFINITY)
  const jobOf = (r: WorkingRow) => r.person.current?.path || 'zz'
  const sorters: Record<WorkingSort, (a: WorkingRow, b: WorkingRow) => number> = {
    'Day total': (a, b) => b.daySeconds - a.daySeconds,
    'Clock-in time': (a, b) => startOf(a) - startOf(b),
    Name: (a, b) => a.person.name.localeCompare(b.person.name),
    Job: (a, b) => jobOf(a).localeCompare(jobOf(b)),
  }
  rows.sort(sorters[o.sort])

  const teams = new Map<string, { name: string; color: string | null }>()
  for (const p of data.people) if (p.team && !teams.has(p.team.id)) teams.set(p.team.id, { name: p.team.name, color: p.team.color })
  const rank = (name: string) => {
    const i = o.teamOrder?.indexOf(name) ?? -1
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  const order = [...teams.entries()].sort((a, b) => rank(a[1].name) - rank(b[1].name) || a[1].name.localeCompare(b[1].name))

  const groups: WorkingGroup[] = []
  const add = (key: string, name: string, color: string, inTeam: (p: WorkingPerson) => boolean) => {
    const rs = rows.filter(r => inTeam(r.person))
    if (!rs.length) return
    const all = data.people.filter(inTeam)
    const on = all.filter(p => p.status !== 'off').length
    groups.push({ key, name, color, rows: rs, count: o.filter === 'on' ? `${on} on the clock` : `${on} of ${all.length} on the clock` })
  }
  for (const [id, t] of order) add(id, t.name, t.color ?? '#cbd2da', p => p.team?.id === id)
  add('none', 'No team', '#cbd2da', p => !p.team)
  return groups
}

export function emptyTitle(filter: WorkingFilter, query: string): string {
  return query.trim() ? `Nobody matches "${query}".` : filter === 'on' ? 'Nobody is on the clock right now.' : 'Nobody has clocked in today.'
}

// ── 2E Clock out for them ───────────────────────────────────────────────────

const FIVE_MIN = 300_000

/** "10:55 AM (5:55 PM EAT)": the viewer's time, then theirs. */
export const bothTimes = (ms: number, viewerZone: string, p: Pick<WorkingPerson, 'zone' | 'zoneAbbr'>): string =>
  `${timeLabel(new Date(ms), viewerZone)} (${timeLabel(new Date(ms), p.zone)} ${p.zoneAbbr})`

/** The end times offered: now first, then every 5 minutes back to the start. Values are ISO, or "now". */
export function endTimeOptions(p: WorkingPerson, nowMs: number, viewerZone: string): { value: string; label: string }[] {
  if (!p.current) return []
  const start = Date.parse(p.current.timerFrom)
  const out = [{ value: 'now', label: `Now, ${bothTimes(nowMs, viewerZone, p)}` }]
  for (let t = Math.floor(nowMs / FIVE_MIN) * FIVE_MIN; t > start && out.length < 400; t -= FIVE_MIN) {
    out.push({ value: new Date(t).toISOString(), label: bothTimes(t, viewerZone, p) })
  }
  return out
}

/** "Current entry: 2 - i7 Marketing › Content · Content: Writing, since 6:18 AM your time (1:18 PM EAT), running 4:45." */
export function currentEntryLine(p: WorkingPerson, nowMs: number, viewerZone: string): string {
  if (!p.current) return ''
  const from = Date.parse(p.current.timerFrom)
  return `Current entry: ${p.current.path} · ${p.current.activity}, since ${timeLabel(new Date(from), viewerZone)} your time (${timeLabel(new Date(from), p.zone)} ${p.zoneAbbr}), running ${formatClock((nowMs - from) / 1000)}.`
}
