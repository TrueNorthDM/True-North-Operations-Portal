/**
 * What the portal sends to Rippling (owner, 9 November 2026), decided here
 * without calling anybody, so each rule has its test:
 *
 *   People      each person matched to their Rippling worker by email (work,
 *               then any other), one match only, never a guess.
 *   Time off    Vacation, Sick and Unpaid Time Off map to Rippling's Vacation,
 *               Sick Leave and Unpaid Time Off by name. Each day off is its own
 *               approved leave request, with the hours when it is not a full
 *               day, so Rippling counts exactly the portal's days (weekends and
 *               company holidays already left out).
 *   Hours       one total a day per US employee, from their North Time start
 *               date on (before it QuickBooks Time still sends them), without
 *               the time off entries (those go as leave), to the hundredth of
 *               an hour. Sending a pay period again changes or removes the
 *               days already sent instead of adding new ones.
 *
 * Pure. The calls are in rippling.ts, the sending in rippling-send.ts.
 */

/** A Rippling worker as the list returns it; only the fields used here. */
export interface RipplingWorker {
  id: string
  status?: string | null
  work_email?: string | null
  personal_email?: string | null
  user?: { emails?: ({ value?: string | null } | string | null)[] | null } | null
}

const clean = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '')

/** Every address of a worker: work first, then personal and the user's. */
export function emailsOf(w: RipplingWorker): string[] {
  const out = [clean(w.work_email), clean(w.personal_email)]
  for (const e of w.user?.emails ?? []) out.push(clean(typeof e === 'string' ? e : e?.value))
  return [...new Set(out.filter(Boolean))]
}

const LIVE = new Set(['ACTIVE', 'HIRED', 'ACCEPTED', 'INIT'])

/**
 * Each person to one Rippling worker. A person matches through any of their
 * addresses; an address two workers share, or a person two workers match, is
 * left out (a wrong match would pay the wrong person).
 */
export function matchWorkers(people: readonly { id: string; emails: readonly (string | null | undefined)[] }[], workers: readonly RipplingWorker[]): Map<string, string> {
  const byEmail = new Map<string, string | null>()
  for (const w of workers) {
    if (w.status && !LIVE.has(w.status)) continue
    for (const e of emailsOf(w)) byEmail.set(e, byEmail.has(e) && byEmail.get(e) !== w.id ? null : w.id)
  }
  const out = new Map<string, string>()
  for (const p of people) {
    const found = new Set<string>()
    let shared = false
    for (const e of p.emails.map(clean).filter(Boolean)) {
      if (!byEmail.has(e)) continue
      const id = byEmail.get(e)
      if (id == null) shared = true
      else found.add(id)
    }
    if (found.size === 1 && !shared) out.set(p.id, [...found][0])
  }
  return out
}

/** Rippling's leave type for a portal kind: Vacation, Sick (Sick Leave) and Unpaid Time Off. Null: no such type there. */
export function leaveTypeFor(kind: string, types: readonly { id: string; name: string }[]): string | null {
  const k = clean(kind)
  const want = k === 'sick' ? ['sick leave', 'sick'] : k === 'unpaid' || k === 'unpaid time off' ? ['unpaid time off', 'unpaid'] : [k]
  for (const name of want) {
    const t = types.find(x => clean(x.name) === name)
    if (t) return t.id
  }
  return null
}

/** One leave request a day: the day, and its hours when it is not a full day. */
export function leaveDays(days: readonly string[], hoursPerDay: number): { day: string; hours: number | null }[] {
  const h = Number(hoursPerDay)
  return [...days].sort().map(day => ({ day, hours: h > 0 && h < 8 ? h : null }))
}

export interface EntryForHours { entry_date: string; duration_seconds: number | null; kind: string }

/**
 * A pay period's hours a day, as Rippling gets them: the days in it from the
 * start date on, time off left out (it goes as leave), to the hundredth.
 * A day with no hours is not in the result.
 */
export function hoursByDay(entries: readonly EntryForHours[], from: string, to: string, startsOn: string | null): Record<string, number> {
  if (!startsOn) return {}
  const first = startsOn > from ? startsOn : from
  const seconds = new Map<string, number>()
  for (const e of entries) {
    if (e.kind === 'absence' || e.entry_date < first || e.entry_date > to) continue
    const s = Number(e.duration_seconds) || 0
    if (s > 0) seconds.set(e.entry_date, (seconds.get(e.entry_date) ?? 0) + s)
  }
  const out: Record<string, number> = {}
  for (const [day, s] of [...seconds].sort(([a], [b]) => a.localeCompare(b))) out[day] = Math.round(s / 36) / 100
  return out
}

export type SentEntries = Record<string, { id: string; hours: number }>

/** What to do in Rippling so it holds `next`: create the new days, change the different ones, remove the gone ones. */
export function planEntries(prev: SentEntries | null | undefined, next: Record<string, number>): {
  create: { day: string; hours: number }[]
  update: { day: string; id: string; hours: number }[]
  remove: { day: string; id: string }[]
} {
  const before = prev ?? {}
  const create: { day: string; hours: number }[] = []
  const update: { day: string; id: string; hours: number }[] = []
  const remove: { day: string; id: string }[] = []
  for (const [day, hours] of Object.entries(next).sort(([a], [b]) => a.localeCompare(b))) {
    const was = before[day]
    if (!was) create.push({ day, hours })
    else if (Math.abs(was.hours - hours) >= 0.005) update.push({ day, id: was.id, hours })
  }
  for (const [day, was] of Object.entries(before).sort(([a], [b]) => a.localeCompare(b))) if (!(day in next)) remove.push({ day, id: was.id })
  return { create, update, remove }
}

/** The leave requests sent for a time off, as stored: "YYYY-MM-DD:id". */
export const sentLeave = (stored: readonly string[] | null | undefined): Map<string, string> =>
  new Map((stored ?? []).map(s => [s.slice(0, 10), s.slice(11)] as const).filter(([d, id]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !!id))
