// How long a step takes, and whether we actually know.
//
// The Load column multiplies open steps by an hours-per-step figure, so that
// figure is the whole estimate. Two ways to arrive at it:
//
//   measured   the board is linked to a timeclock project, so its own hours
//              divided by its own delivered steps
//   fallback   it is not, so it borrows the average across everything
//
// The difference is the reason screen 3.4 exists. An estimate that does not
// say which of the two it is cannot be argued with, and a lead deciding
// whether somebody is overloaded deserves to know.

export type BoardEffort = {
  boardId: number
  boardName: string
  hours: number
  delivered: number
}

export type EffortTable = {
  /** Hours per step, per board, for the boards that have their own figure. */
  perBoard: Map<number, number>
  /** What everything else uses. Null when nothing has been delivered at all. */
  fallback: number | null
}

/** A board needs enough finished work before its own average beats the global one. */
export const MIN_DELIVERED_TO_MEASURE = 8

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Build the table.
 *
 * A board with three delivered steps has an average, and it is noise: one
 * unusually long item moves it by half. Below the threshold it falls back,
 * which is a smaller error than a confident wrong number.
 */
export function buildEffortTable(boards: BoardEffort[], globalHours: number, globalDelivered: number): EffortTable {
  const perBoard = new Map<number, number>()
  for (const b of boards) {
    if (b.delivered >= MIN_DELIVERED_TO_MEASURE && b.hours > 0) {
      perBoard.set(b.boardId, round1(b.hours / b.delivered))
    }
  }
  return {
    perBoard,
    fallback: globalDelivered > 0 ? round1(globalHours / globalDelivered) : null,
  }
}

/** Hours for one open step on one board. Null when nothing can be said. */
export function hoursFor(table: EffortTable, boardId: number): number | null {
  return table.perBoard.get(boardId) ?? table.fallback
}

export function isMeasured(table: EffortTable, boardId: number): boolean {
  return table.perBoard.has(boardId)
}
