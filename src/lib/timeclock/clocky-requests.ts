/**
 * Time correction requests and the order things are listed in, as the Time
 * Entries prototype does them (Time Entries.dc.html, its script):
 *
 *   - who a correction goes to: "Clarise Nixon · goes to Rock Kai" (3K-3),
 *     the requester's Team Leaders, else the Admins and Super Admins (the same
 *     rule and wording as the 3K-1 line, clocky-panel.ts correctionGoesTo);
 *   - a request's own history, for the drawer (3G): who asked, when, what
 *     happened, and the decision once there is one;
 *   - Needs attention oldest first, the entries before the requests (the
 *     prototype lists its data in order, and its requests come after the
 *     entries);
 *   - Approvals "Waiting" by the request's day, oldest first.
 *
 * Pure: the loaders and the design checks use the same answers.
 */

import { stampLabel } from './format'
import { formatDuration } from './rounding'
import type { HistoryData } from './clocky-types'

// ── Who a correction goes to ────────────────────────────────────────────────

/**
 * The Team Leaders a person's corrections go to: the active leads of the
 * teams the person is on, never the person, by name.
 */
export function teamLeadNames(
  personId: string,
  teamIds: readonly string[],
  led: ReadonlyMap<string, ReadonlySet<string>>,
  isActive: (id: string) => boolean,
  nameOf: (id: string) => string,
): string[] {
  const mine = new Set(teamIds)
  return [...led.entries()]
    .filter(([id, teams]) => id !== personId && [...teams].some(t => mine.has(t)) && isActive(id))
    .map(([id]) => nameOf(id))
    .sort()
}

/** "Rock Kai", "Rock Kai and Wendy Cacka", "the Admins and Super Admins": the end of "· goes to ...". */
export function goesToLabel(leads: readonly string[]): string {
  if (!leads.length) return 'the Admins and Super Admins'
  return leads.length === 1 ? leads[0] : `${leads.slice(0, -1).join(', ')} and ${leads[leads.length - 1]}`
}

// ── A request's history (3G) ────────────────────────────────────────────────

const TEAL = '#1E7D7F'

export interface RequestHistoryInput {
  owner: string
  requestedAt: string
  seconds: number
  /** The job's path. */
  job: string
  /** What happened, as the person wrote it. */
  reason: string
  decided: { by: string; at: string; state: 'approved' | 'denied'; note: string | null } | null
  viewerZone: string
}

/**
 * A pending or denied request's lines, newest first: "Clarise Nixon requested
 * a time correction: 1h 30m · 2 - i7 Marketing › Content" with what happened
 * as the reason, then "Rock Kai denied the correction" with the reason given.
 * (An approved request is an entry: its history is the entry's.)
 */
export function requestHistoryLines(h: RequestHistoryInput): HistoryData['lines'] {
  const line = (at: string, who: string, text: string, reason: string | null) =>
    ({ at, when: stampLabel(at, h.viewerZone), who, text, changes: [], reason, dot: TEAL })
  const out = [line(h.requestedAt, h.owner, `${h.owner} requested a time correction: ${formatDuration(h.seconds)} · ${h.job}`, h.reason || null)]
  if (h.decided) {
    out.push(h.decided.state === 'approved'
      ? line(h.decided.at, h.decided.by, `${h.decided.by} approved the correction`, null)
      : line(h.decided.at, h.decided.by, `${h.decided.by} denied the correction`, h.decided.note))
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
}

// ── Orders ──────────────────────────────────────────────────────────────────

interface Ordered { rowType: string; date: string; personName: string; start: string | null }

const byDay = (a: Ordered, b: Ordered) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  || a.personName.localeCompare(b.personName)
  || ((a.start ? Date.parse(a.start) : 9e15) - (b.start ? Date.parse(b.start) : 9e15))

/** Needs attention: the entries oldest first, then the requests (corrections, time off) oldest first. */
export function attentionOrder<T extends Ordered>(rows: readonly T[]): T[] {
  return [...rows.filter(r => r.rowType === 'entry').sort(byDay), ...rows.filter(r => r.rowType !== 'entry').sort(byDay)]
}

/** Approvals, "Waiting": by the request's day, oldest first; requests of one day stay in the order they came. */
export function waitingOrder<T extends { date: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
