// The diff the ingest throws away.
//
// ingestBoard already holds both halves: the rows it is about to delete and
// the rows replacing them. Everything the Report needs about the past is the
// difference between those two sets, and until now it was discarded on every
// sync, six times a day, permanently.
//
// Kept separate from the ingest because it is the one part with no I/O in it,
// and because the rules here decide what "delivered" and "held" mean.

export type AssignmentSnapshot = {
  item_id: number
  people_col: string
  monday_user_id: number
  status_text: string | null
  status_done: boolean | null
  due_date: string | null
  item_updated_at?: string | null
  /** The status column the row was read from. On a step with stages, the stage it is on. */
  status_col?: string | null
  /** The date column due_date was read from. Null on rows written before steps had their own. */
  due_col?: string | null
}

/**
 * What the diff must not mistake for work.
 *
 * Both sets exist for the day the way steps are read changes, which happened on
 * 15 September 2026 when steps started reading the status with a deadline. On
 * that sync thousands of rows switched to a different status column and a
 * different date column without anybody doing anything in Monday.
 */
export interface DiffOptions {
  /**
   * Row keys whose status and deadline now come from different columns than
   * last time. Their status and date changes are the mapping changing, not the
   * work, so no status, done, reopened or due date event is written for them.
   */
  remapped?: Set<string>
  /**
   * People columns that are no longer steps (switched off, or owning no status
   * with a deadline). Their rows leave the table because of a setting, and an
   * "unassigned" event for each would close thousands of spans in the Report
   * at the moment of the sync.
   */
  untracked?: Set<string>
  /**
   * People columns whose rows come back after leaving for a setting (a step
   * switched on again, a board back in the listing, a new step on a board
   * already read; migration 104). Their rows are not new work: no "assigned"
   * is written for them, and nobody is told. One that was finished while it
   * was away gets its "done", when the log still has it in someone's hands
   * (`heldInLog`), so the delivery counts (decided 10 October 2026).
   */
  baseline?: Set<string>
  /** Row keys the log has in someone's hands: last hand-off not yet closed. */
  heldInLog?: Set<string>
}

export type AssignmentEvent = {
  board_id: number
  item_id: number
  people_col: string
  monday_user_id: number
  event: 'assigned' | 'unassigned' | 'status' | 'due_date' | 'done' | 'reopened'
  from_value: string | null
  to_value: string | null
  status_done: boolean | null
  due_date: string | null
  occurred_at: string
}

/** One step, on one item, held by one person. Two rows with this key are the same thing. */
export function keyOf(a: { item_id: number; people_col: string; monday_user_id: number }): string {
  return `${a.item_id}|${a.people_col}|${a.monday_user_id}`
}

/**
 * What changed on one board between two syncs.
 *
 * Monday's item_updated_at is used when it exists, because it is closer to
 * when the change actually happened than the moment we noticed. It is still
 * only accurate to the sync window: four hours between passes means a
 * hand-off can be that far out, which is fine for medians in days and useless
 * for anything hourly.
 */
export function diffAssignments(
  boardId: number,
  before: AssignmentSnapshot[],
  after: AssignmentSnapshot[],
  now: string,
  opts: DiffOptions = {},
): AssignmentEvent[] {
  const prev = new Map(before.map(r => [keyOf(r), r]))
  const events: AssignmentEvent[] = []

  const at = (r: AssignmentSnapshot) => r.item_updated_at || now
  const base = (r: AssignmentSnapshot, occurred: string) => ({
    board_id: boardId,
    item_id: r.item_id,
    people_col: r.people_col,
    monday_user_id: r.monday_user_id,
    status_done: r.status_done,
    due_date: r.due_date,
    occurred_at: occurred,
  })

  for (const row of after) {
    const k = keyOf(row)
    const was = prev.get(k)
    prev.delete(k)

    if (!was) {
      if (opts.baseline?.has(row.people_col)) {
        if (row.status_done === true && opts.heldInLog?.has(k)) {
          events.push({ ...base(row, at(row)), event: 'done', from_value: null, to_value: row.status_text })
        }
        continue
      }
      // The moment a step lands on somebody. Held time is measured from here,
      // so losing this event means the step can never have one.
      events.push({ ...base(row, at(row)), event: 'assigned', from_value: null, to_value: row.status_text })
      continue
    }

    // Same person, same step, read from a different column than last time.
    // Whatever differs is the reading, not the work.
    if (opts.remapped?.has(k)) continue

    // Done and reopened are status changes too, but they are the two the
    // Report actually counts, so they get their own names rather than being
    // recovered later by comparing two status strings against a settings blob.
    if (was.status_done !== row.status_done && row.status_done === true) {
      events.push({ ...base(row, at(row)), event: 'done', from_value: was.status_text, to_value: row.status_text })
    } else if (was.status_done === true && row.status_done === false) {
      events.push({ ...base(row, at(row)), event: 'reopened', from_value: was.status_text, to_value: row.status_text })
    } else if (was.status_text !== row.status_text) {
      events.push({ ...base(row, at(row)), event: 'status', from_value: was.status_text, to_value: row.status_text })
    }

    // Separate from the status change on purpose: a step whose deadline moved
    // and whose status moved in the same sync did two different things, and
    // on-time delivery has to know which deadline was in force.
    if (was.due_date !== row.due_date) {
      events.push({ ...base(row, at(row)), event: 'due_date', from_value: was.due_date, to_value: row.due_date })
    }
  }

  // Whatever is left was in the old set and is not in the new one: the step
  // was taken off them, or the item is gone. Dated now, because Monday cannot
  // tell us when something stopped being true.
  for (const gone of prev.values()) {
    if (opts.untracked?.has(gone.people_col)) continue
    events.push({ ...base(gone, now), event: 'unassigned', from_value: gone.status_text, to_value: null })
  }

  return events
}
