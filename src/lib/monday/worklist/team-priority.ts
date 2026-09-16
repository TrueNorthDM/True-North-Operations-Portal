// Team priority: one order for a team's open steps, set by its leader.
//
// Decided on 16 September 2026. Each team has one order. Its team leader sets it
// (team_members.position 'team_leader' or 'founder'), an admin can set any
// team's, and everyone on the team sees their own steps in it. Nobody else
// changes priorities.
//
// The order is not a frozen list. A team has a thousand open steps (SEO had
// 1,161 when this was written) and a leader places a handful of them; if saving
// froze the other thousand where they happened to be, a deadline that moved in
// Monday the next day would no longer move the step. So two things are kept:
//
//   the list as it stood when it was saved, and
//   which steps in it were placed by hand.
//
// Reading it back, a placed step takes its place in that list (counting only
// the steps still open, so it rises as the work above it gets done) and every
// other step fills the places left, in the default order: the board's
// priority, then the soonest deadline. Which steps count as placed is worked
// out from the arrangement (pinsFor): a step the leader moves is placed, unless
// they move it back to where the default order has it.
//
// Pure, so the page, the editor and the tests all run the same rules.

export type Priority = 'high' | 'medium' | 'low'

/** What the default order reads from a step, and what names it. */
export interface OrderableStep {
  itemId: number
  peopleCol: string
  mondayUserId: number
  priority: Priority
  dueDate: string | null
  /** A year outside living memory: kept, but not a deadline. */
  dueSuspect: boolean
  itemName: string
}

/**
 * A step's name in a saved order: its item, its people column and its Monday
 * account. The same three things make a row on My Work and key the change log;
 * the database id of the row is not used, because the sync may replace it.
 */
export function stepKey(s: Pick<OrderableStep, 'itemId' | 'peopleCol' | 'mondayUserId'>): string {
  return `${s.itemId}|${s.peopleCol}|${s.mondayUserId}`
}

const KEY = /^\d{1,20}\|[^|\s]{1,100}\|\d{1,20}$/

export function isStepKey(v: unknown): v is string {
  return typeof v === 'string' && KEY.test(v)
}

const RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const deadline = (s: OrderableStep): string | null => (s.dueDate && !s.dueSuspect ? s.dueDate : null)

/**
 * The default order: the board's priority, then the soonest deadline, then the
 * name. A step with no usable date goes after the dated ones in its band. The
 * key settles the last tie, so the same steps always come out in the same order
 * and a step's default place means the same thing on every page load.
 */
export function compareDefault(a: OrderableStep, b: OrderableStep): number {
  const da = deadline(a), db = deadline(b)
  return (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1)
    || (da ? 0 : 1) - (db ? 0 : 1)
    || (da ?? '').localeCompare(db ?? '')
    || a.itemName.localeCompare(b.itemName, 'en')
    || stepKey(a).localeCompare(stepKey(b), 'en')
}

export function defaultOrder<T extends OrderableStep>(steps: T[]): T[] {
  return [...steps].sort(compareDefault)
}

export interface SavedOrder {
  /** Every open step of the team, as the list stood when it was saved. */
  order: string[]
  /** The steps in it that were placed by hand. */
  pinned: string[]
}

export interface Ranking {
  /** Every open step, first to last. */
  keys: string[]
  /** Placed by hand, and still open. */
  pinned: Set<string>
  /** Open steps the saved list has never seen: they arrived after it was saved. */
  fresh: Set<string>
}

/**
 * The team's order today.
 *
 * `defaultKeys` is every open step of the team, already in the default order.
 * A placed step goes to its place in the saved list, counting only steps that
 * are still open; the rest fill the gaps in the default order. With nothing
 * saved, the answer is the default order.
 */
export function teamRanking(defaultKeys: string[], saved: SavedOrder | null): Ranking {
  if (!saved || saved.order.length === 0) return { keys: defaultKeys, pinned: new Set(), fresh: new Set() }

  const open = new Set(defaultKeys)
  const seen = new Set<string>()
  const stillOpen: string[] = []
  for (const k of saved.order) {
    if (!open.has(k) || seen.has(k)) continue
    seen.add(k)
    stillOpen.push(k)
  }

  const handPlaced = new Set(saved.pinned)
  const slots: (string | null)[] = new Array(defaultKeys.length).fill(null)
  const pinned = new Set<string>()
  // A place in the still-open list is always inside the list of open steps,
  // and no two steps share one, so a placed step never has to be moved aside.
  stillOpen.forEach((k, i) => {
    if (!handPlaced.has(k)) return
    slots[i] = k
    pinned.add(k)
  })

  const rest = defaultKeys.filter(k => !pinned.has(k))
  let next = 0
  for (let i = 0; i < slots.length; i++) if (slots[i] == null) slots[i] = rest[next++]

  const everSaved = new Set(saved.order)
  return {
    keys: slots as string[],
    pinned,
    fresh: new Set(defaultKeys.filter(k => !everSaved.has(k))),
  }
}

/**
 * Which steps of an arranged list are placed by hand.
 *
 * Steps placed before stay placed (`keep`), whatever the default order says of
 * them now: a leader who put a step first wants it first even on the day its
 * deadline happens to agree. The step just `moved` is the exception, since
 * moving it is the leader saying where it goes now, so it counts as placed only
 * if it no longer fits the default order.
 *
 * Of the rest, every step outside the longest run already in the default order
 * is placed. Those are the only steps teamRanking has to be told about to give
 * the same list back, and every step left out keeps following deadlines. The
 * run is found in n log n with a Fenwick tree over default places, so a team
 * of two thousand steps costs nothing to recompute on every move.
 *
 * When two runs are equally long, the one without the moved step wins, so the
 * moved step is the one placed: swapping two neighbours could be read as either
 * of them moving, and the one the leader moved is the one they meant.
 */
export function pinsFor(
  list: string[],
  defaultKeys: string[],
  opts: { keep?: Iterable<string>; moved?: string | null } = {},
): string[] {
  const moved = opts.moved ?? null
  const forced = new Set(opts.keep ?? [])
  if (moved) forced.delete(moved)

  const at = new Map(defaultKeys.map((k, i) => [k, i]))
  const size = defaultKeys.length
  const candidates = list.filter(k => !forced.has(k))
  // A longer run always wins; between runs of one length, the one without the
  // moved step.
  const W = candidates.length + 1
  const weight = (k: string) => (k === moved ? W - 1 : W)

  const best = new Array<number>(size + 1).fill(0)
  const bestAt = new Array<number>(size + 1).fill(-1)
  const parent = new Array<number>(candidates.length).fill(-1)
  let end = -1
  let top = 0

  candidates.forEach((k, i) => {
    const d = at.get(k)
    if (d === undefined) return
    // Best run ending on a step whose default place is before this one's.
    let prev = 0
    let prevAt = -1
    for (let p = d; p > 0; p -= p & -p) {
      if (best[p] > prev) { prev = best[p]; prevAt = bestAt[p] }
    }
    const score = prev + weight(k)
    parent[i] = prevAt
    for (let p = d + 1; p <= size; p += p & -p) {
      if (score > best[p]) { best[p] = score; bestAt[p] = i }
    }
    if (score > top) { top = score; end = i }
  })

  const inRun = new Set<string>()
  for (let i = end; i !== -1; i = parent[i]) inRun.add(candidates[i])
  return list.filter(k => forced.has(k) || !inRun.has(k))
}

/** The list with one step taken out and put back at `index` (clamped to the list). */
export function moveTo(list: string[], key: string, index: number): string[] {
  const from = list.indexOf(key)
  if (from === -1) return list
  const next = list.filter(k => k !== key)
  const to = Math.max(0, Math.min(Math.round(index), next.length))
  if (to === from) return list
  next.splice(to, 0, key)
  return next
}

/**
 * How closely the team's order follows the default one, 0 to 100.
 *
 * Spearman's rank correlation, stretched from -1..1 to 0..100: 100 is the
 * default order, 0 its exact reverse. Rounded DOWN, so a list of a thousand
 * steps with one of them moved reads 99 rather than a 100 that says nothing
 * moved.
 */
export function agreement(list: string[], defaultKeys: string[]): number {
  const n = list.length
  if (n < 2) return 100
  const at = new Map(defaultKeys.map((k, i) => [k, i]))
  let d2 = 0
  list.forEach((k, i) => { d2 += (i - (at.get(k) ?? i)) ** 2 })
  if (d2 === 0) return 100
  const rho = 1 - (6 * d2) / (n * (n * n - 1))
  return Math.max(0, Math.min(99, Math.floor(((rho + 1) / 2) * 100)))
}

/** How far each step sits from its default place: positive is higher up the list. */
export function displacement(list: string[], defaultKeys: string[]): Map<string, number> {
  const at = new Map(defaultKeys.map((k, i) => [k, i]))
  return new Map(list.map((k, i) => [k, (at.get(k) ?? i) - i]))
}

/** More than any team has had, so a real save is never refused, and a runaway one is. */
export const MAX_STEPS = 20_000

/**
 * A saved order as the server action receives it, checked.
 *
 * It arrives from the browser, so it is treated as anything at all: arrays of
 * step keys or nothing, duplicates dropped, and a placed step only if it is on
 * the list it was placed in.
 */
export function cleanSavedOrder(order: unknown, pinned: unknown): SavedOrder | null {
  if (!Array.isArray(order) || !Array.isArray(pinned)) return null
  if (order.length > MAX_STEPS || pinned.length > MAX_STEPS) return null
  if (!order.every(isStepKey) || !pinned.every(isStepKey)) return null
  const list = [...new Set(order as string[])]
  const onList = new Set(list)
  return { order: list, pinned: [...new Set(pinned as string[])].filter(k => onList.has(k)) }
}

/**
 * When an order was last saved, the way the line above the list says it:
 * "today at 10:32", "yesterday at 4:05 PM", "Sep 2 at 9:00 AM". In the reader's
 * own clock, so it is only worked out in the browser.
 */
export function updatedWhen(iso: string, now = new Date()): string {
  const at = new Date(iso)
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  if (day(at) === day(now)) return `today at ${time}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (day(at) === day(yesterday)) return `yesterday at ${time}`
  const date = at.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
  return `${date} at ${time}`
}

/** What a list needs to say whose order it follows, and whether the reader can change it. */
export interface TeamOrderView {
  teamId: string
  teamName: string
  /** Steps placed by hand and still open. None means the list is in the default order. */
  placed: number
  updatedAt: string | null
  updatedBy: string | null
  updatedBySelf: boolean
  /** The person looking may set this team's order. */
  canEdit: boolean
  /** Every team the list could follow, when the person shown is on more than one. */
  choices: { id: string; name: string }[]
}

// ── Who leads, and whose order a list follows ──────────────────────────────

export interface Membership {
  teamId: string
  teamName: string
  isPrimary: boolean
  /** team_members.position: 'founder', 'team_leader' or 'collaborator'. */
  position: string | null
}

/** Leading a team is the team position, as on the org chart: team leader or founder. */
export function leads(m: Pick<Membership, 'position'>): boolean {
  return m.position === 'team_leader' || m.position === 'founder'
}

/**
 * The team whose order a person's own list follows.
 *
 * The one asked for, if they are on it; otherwise their primary team; otherwise,
 * with no primary set, the first of their teams by name, so the answer does not
 * change from one page load to the next. Nobody on a team follows nobody's order.
 */
export function orderTeamFor(memberships: Membership[], asked?: string | null): string | null {
  if (asked && memberships.some(m => m.teamId === asked)) return asked
  const primary = memberships.find(m => m.isPrimary)
  if (primary) return primary.teamId
  return [...memberships].sort((a, b) => a.teamName.localeCompare(b.teamName, 'en'))[0]?.teamId ?? null
}

/** Whether this person may set this team's order. */
export function canSetOrder(teamId: string, memberships: Membership[], isAdmin: boolean): boolean {
  return isAdmin || memberships.some(m => m.teamId === teamId && leads(m))
}

/**
 * The team the editor opens on: the one asked for if this person may set it,
 * then their own team if they lead it, then the first team they may set.
 */
export function editorTeamFor(
  allowed: { id: string; name: string }[],
  memberships: Membership[],
  asked?: string | null,
): string | null {
  const may = new Set(allowed.map(t => t.id))
  if (asked && may.has(asked)) return asked
  const own = orderTeamFor(memberships.filter(m => may.has(m.teamId)))
  return own ?? allowed[0]?.id ?? null
}
