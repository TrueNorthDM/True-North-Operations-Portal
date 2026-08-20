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
      // The moment a step lands on somebody. Held time is measured from here,
      // so losing this event means the step can never have one.
      events.push({ ...base(row, at(row)), event: 'assigned', from_value: null, to_value: row.status_text })
      continue
    }

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
    events.push({ ...base(gone, now), event: 'unassigned', from_value: gone.status_text, to_value: null })
  }

  return events
}
