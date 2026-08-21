// Reading the change log: turning events back into spans of work.
//
// A span is one step, held by one person, from the moment it landed on them
// to the moment they finished it. Everything the Report says about the past
// is counted off these: delivery, on-time share, held time, the weekly chart
// and the age buckets.
//
// Two rules here were open questions in the handoff and are now decided:
//
//   A reopened step cancels its earlier delivery. It counts once, on the last
//   done, and its held time runs from the last time it landed on them. Rework
//   should not inflate delivery, or a bad month looks like a good one.
//
//   Held time is calendar days, weekends included. It answers how long the
//   work sat, which is the question somebody waiting on it is asking, and it
//   does not depend on knowing every person's schedule.

export type LoggedEvent = {
  board_id: number
  item_id: number
  people_col: string
  monday_user_id: number
  event: 'assigned' | 'unassigned' | 'status' | 'due_date' | 'done' | 'reopened'
  due_date: string | null
  occurred_at: string
}

export type Span = {
  board_id: number
  item_id: number
  people_col: string
  monday_user_id: number
  assignedAt: string
  doneAt: string
  /** Calendar days from landing on them to being marked done. */
  heldDays: number
  /** The deadline in force when it was finished, or null if it had none. */
  dueDate: string | null
  /** Days past that deadline. 0 when on time; null when there was no deadline. */
  lateDays: number | null
}

const DAY = 86_400_000

/** Whole calendar days between two moments, never negative. */
export function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / DAY))
}

/**
 * Days past the deadline.
 *
 * Null when there was no deadline: a step with no due date is not on time and
 * not late, and counting it as on time would inflate the share with steps
 * nobody ever set a date for.
 */
export function lateness(doneAt: string, dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = Date.parse(`${dueDate}T23:59:59.999Z`)
  if (Number.isNaN(due)) return null
  return Math.max(0, Math.ceil((Date.parse(doneAt) - due) / DAY))
}

function keyOf(e: LoggedEvent): string {
  return `${e.item_id}|${e.people_col}|${e.monday_user_id}`
}

/**
 * Every completed span in the log.
 *
 * Walks each step's events in order, holding the last moment it landed on the
 * person. A done closes a span; a reopen throws the closed one away and puts
 * the step back in hand, which is what "the last done counts" means in
 * practice. An unassignment ends the attempt without a delivery.
 */
export function deriveSpans(events: LoggedEvent[]): Span[] {
  const byKey = new Map<string, LoggedEvent[]>()
  for (const e of events) {
    const k = keyOf(e)
    const list = byKey.get(k)
    if (list) list.push(e)
    else byKey.set(k, [e])
  }

  const spans: Span[] = []

  for (const list of byKey.values()) {
    const ordered = [...list].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

    let heldSince: string | null = null
    let due: string | null = null
    let closed: Span | null = null

    for (const e of ordered) {
      // The deadline in force is whatever the last event carried, so a date
      // moved after the work started is the one the finish is judged against.
      if (e.due_date !== null) due = e.due_date

      if (e.event === 'assigned') {
        heldSince = e.occurred_at
        closed = null
      } else if (e.event === 'done' && heldSince) {
        closed = {
          board_id: e.board_id,
          item_id: e.item_id,
          people_col: e.people_col,
          monday_user_id: e.monday_user_id,
          assignedAt: heldSince,
          doneAt: e.occurred_at,
          heldDays: daysBetween(heldSince, e.occurred_at),
          dueDate: due,
          lateDays: lateness(e.occurred_at, due),
        }
      } else if (e.event === 'reopened') {
        // The earlier delivery is cancelled, and the clock restarts from the
        // reopen: the person is holding it again from this moment.
        closed = null
        heldSince = e.occurred_at
      } else if (e.event === 'unassigned') {
        heldSince = null
      }
    }

    if (closed) spans.push(closed)
  }

  return spans
}

/** The middle value. Null for an empty set, rather than a zero that reads as instant. */
export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10
}

/** The slowest one in ten, by the nearest-rank method. */
export function percentile90(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)]
}

/**
 * The share finished by their deadline.
 *
 * Counted only over spans that had a deadline. Including the undated ones
 * either way is a claim about work nobody set a date for.
 */
export function onTimeShare(spans: Span[]): { pct: number | null; onTime: number; judged: number } {
  const judged = spans.filter(s => s.lateDays !== null)
  const onTime = judged.filter(s => s.lateDays === 0).length
  return {
    pct: judged.length ? Math.round((onTime / judged.length) * 100) : null,
    onTime,
    judged: judged.length,
  }
}
