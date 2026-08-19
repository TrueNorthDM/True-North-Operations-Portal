// Turning a board's columns into steps.
//
// A Monday board does not record that a people column belongs to a status
// column: they are two columns that happen to sit next to each other. The
// relationship is in the layout, because a board is read left to right and
// whoever built the workflow put "where is this" before "who has it".
//
// Measured against the four boards somebody had already mapped by hand, the
// status immediately to the RIGHT of a people column was that column's step
// every time the two were comparable. The same rule reading LEFT scored zero.
// It also found owners on the two Publishing boards that the hand-written
// config never mapped at all.
//
// The rule is a starting point, not an authority. It cannot tell a workflow
// step from a tag: pair a people column with "Priority" and you get a step
// called Priority, which is wrong in a way a person spots in a second and a
// program never does. That is what the confirmation screen is for, and why
// every seeded row is marked as a guess.

/** Monday column types that hold people. */
export const PEOPLE_TYPES = new Set(['people', 'person', 'multiple-person'])

/**
 * Types that can carry a step's state. Dropdowns are excluded on purpose:
 * "Audit Type" and "Writing Level" are dropdowns, and pairing an owner with
 * one invents a step that never existed.
 */
export const STATUS_TYPES = new Set(['status', 'color'])

export interface BoardColumn {
  id: string
  title: string
  type: string
}

export interface SeededStep {
  peopleCol: string
  peopleTitle: string
  /** Null when nothing state-like sits beside this column. */
  statusCol: string | null
  /** The status column's title, or the people column's own when unpaired. */
  stepName: string
  /** Column order, which is also the order the workflow runs in. */
  position: number
  /** Which direction found it, kept so a reviewer can see how sure to be. */
  via: 'right' | 'left' | 'none'
}

/**
 * Nearest status-like column in one direction, stopping at another people
 * column: once a second owner appears, any status past it belongs to them.
 */
function nearestStatus(cols: BoardColumn[], from: number, dir: -1 | 1): BoardColumn | null {
  for (let i = from + dir; i >= 0 && i < cols.length; i += dir) {
    const c = cols[i]
    if (PEOPLE_TYPES.has(c.type)) return null
    if (STATUS_TYPES.has(c.type)) return c
  }
  return null
}

/** Seed one board's steps from its columns, in board order. */
export function seedSteps(cols: BoardColumn[]): SeededStep[] {
  const out: SeededStep[] = []
  const taken = new Set<string>()

  cols.forEach((c, i) => {
    if (!PEOPLE_TYPES.has(c.type)) return

    // Right first: the owner comes before the status it owns.
    let hit = nearestStatus(cols, i, 1)
    let via: SeededStep['via'] = 'right'
    if (!hit || taken.has(hit.id)) {
      hit = nearestStatus(cols, i, -1)
      via = 'left'
    }
    // A status already claimed by an earlier owner is not free to claim again:
    // two people columns pointing at one status means the guess is wrong about
    // at least one of them, and an unpaired step says so honestly.
    if (!hit || taken.has(hit.id)) {
      out.push({ peopleCol: c.id, peopleTitle: c.title, statusCol: null, stepName: c.title, position: i, via: 'none' })
      return
    }
    taken.add(hit.id)
    out.push({ peopleCol: c.id, peopleTitle: c.title, statusCol: hit.id, stepName: hit.title, position: i, via })
  })

  return out
}
