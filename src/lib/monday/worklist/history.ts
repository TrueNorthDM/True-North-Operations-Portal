// An item's History, told step by step: whose step each change belongs to.
//
// Monday's activity log says which column changed and who clicked. It does not
// say whose step that column is, and the two are often different people: on
// HFA - Publishing, Wendy marked Publishing done, and Publishing is Samuel's.
// The portal already knows which columns make up each step (monday_board_steps:
// the step's people column, its status column, and the date column of each of
// its stages), so each change can be filed under its step, and each step shown
// with the person on it now. Decided on 18 September 2026, from the mockups at
// /design-check/history-owners: one card per step, the reader's own first.
//
// Pure module: the API route fills it, the panel draws it.

/** One change in Monday's log, as the panel receives it. */
export interface HistoryEvent {
  id: string
  event: string
  at: string | null
  /** The Monday account that made the change. */
  userId: number | null
  column: string | null
  from: string | null
  to: string | null
  /** The step the column belongs to (its people column id), or null for the item itself. */
  stepKey?: string | null
  /** A people column change: the accounts it added and removed. */
  assigned?: number[]
  unassigned?: number[]
}

/** One step of the item, with who is on it now. */
export interface HistoryStep {
  /** The step's people column id: what the board's steps are keyed by. */
  key: string
  name: string
  position: number
  /** Monday accounts in the step's people column right now. */
  owners: number[]
  status: string | null
  statusColor: string | null
  dueTitle: string | null
  due: string | null
}

export interface HistoryReader {
  name: string
  avatarUrl: string | null
  /** Their Monday accounts: a step is theirs when one of these is on it. */
  accounts: number[]
}

export interface HistoryData {
  events: HistoryEvent[]
  /** Names by Monday account, the portal's name where the account is linked. */
  names: Record<number, string>
  /** Absent from an older response: the panel then draws the plain timeline. */
  steps?: HistoryStep[]
  reader?: HistoryReader | null
}

/** Changes that say nothing about the work: who follows the item, who owns the pulse. */
export const QUIET_EVENTS: ReadonlySet<string> = new Set(['subscribe', 'unsubscribe', 'add_owner', 'remove_owner'])

/** The columns that make up a step, as monday_board_steps stores it. */
export interface StepRow {
  people_col: string
  step_name: string
  position: number
  status_col?: string | null
  stages?: { statusCol: string; dateCol: string; dateTitle?: string; statusTitle?: string }[] | null
}

/**
 * Which step each column belongs to: the step's people column, its status
 * column, and the status and date column of every stage. Extra columns can be
 * added per step (a due column the sync recorded, for one).
 */
export function columnSteps(
  steps: readonly StepRow[],
  extra: ReadonlyMap<string, readonly string[]> = new Map(),
): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of steps) {
    const cols = [s.people_col, s.status_col ?? null, ...(s.stages ?? []).flatMap(st => [st.statusCol, st.dateCol]), ...(extra.get(s.people_col) ?? [])]
    for (const c of cols) if (c && !out.has(c)) out.set(c, s.people_col)
  }
  return out
}

/** The accounts in a people column value: {"personsAndTeams":[{"id":1,"kind":"person"}]}. */
export function personIds(v: unknown): number[] {
  const list = (v as { personsAndTeams?: { id?: unknown; kind?: string }[] } | null)?.personsAndTeams
  if (!Array.isArray(list)) return []
  return list.filter(p => p?.kind !== 'team').map(p => Number(p?.id)).filter(n => Number.isFinite(n) && n > 0)
}

export interface StepGroup {
  step: HistoryStep
  /** Newest first, like the log. */
  events: HistoryEvent[]
}

/**
 * The log filed under its steps.
 *
 * The reader's own steps come first, in workflow order. Everyone else's follow
 * with the most recently changed first, so the step that just moved is at the
 * top. A step with nobody on it and nothing in the log is left out: on a board
 * with a dozen steps most items only ever use a few. Changes on no step (the
 * page link, the published date, an automation's switch) go to the item.
 */
export function groupHistory(
  events: readonly HistoryEvent[],
  steps: readonly HistoryStep[],
  readerAccounts: readonly number[],
): { mine: StepGroup[]; others: StepGroup[]; item: HistoryEvent[] } {
  const byStep = new Map<string, HistoryEvent[]>()
  const item: HistoryEvent[] = []
  const known = new Set(steps.map(s => s.key))
  for (const e of events) {
    if (QUIET_EVENTS.has(e.event)) continue
    if (e.stepKey && known.has(e.stepKey)) {
      const list = byStep.get(e.stepKey) ?? []
      list.push(e)
      byStep.set(e.stepKey, list)
    } else {
      item.push(e)
    }
  }

  const me = new Set(readerAccounts)
  const groups = steps
    .map(step => ({ step, events: byStep.get(step.key) ?? [] }))
    .filter(g => g.step.owners.length > 0 || g.events.length > 0)
  const isMine = (g: StepGroup) => g.step.owners.some(o => me.has(o))
  const latest = (g: StepGroup) => g.events[0]?.at ?? ''

  return {
    mine: groups.filter(isMine).sort((a, b) => a.step.position - b.step.position),
    others: groups.filter(g => !isMine(g))
      .sort((a, b) => latest(b).localeCompare(latest(a)) || b.step.position - a.step.position),
    item,
  }
}

/** A Monday date, 2026-09-17, as "Sep 17", with the year only when it is not this one. */
export function shortDate(v: string | null, now = new Date()): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(`${v}T00:00:00Z`)
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' })
}
