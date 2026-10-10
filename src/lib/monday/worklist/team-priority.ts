// Team priority: one order for a team's open steps, set by its leader.
//
// Decided on 16 September 2026. Each team has one order. The people who lead the
// team set it (team position Founder, Manager or Team Leader), admins set any
// team's, and everyone on the team sees their own steps in it, read only. Who
// else may change it is configured on Admin → Access levels.
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
// Who may set a team's order is at the bottom of this file (priorityRights):
// admins, the Team priority rows on Admin → Access levels, and people given it
// by name there.
//
// Pure, so the page, the editor, the save action, the Access levels page and
// the tests all run the same rules.

import { teamPositionLeads } from '@/lib/directory/people-types'
import { PRIORITY_ALL, PRIORITY_OWN } from '@/lib/access/surfaces'

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
  /** The team's order for whole workspaces and boards (migration 087), if it has one. */
  levels?: Levels | null
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
 * "today at 10:32 AM", "yesterday at 4:05 PM", "Sep 2 at 9:00 AM".
 *
 * In `zone`'s clock. My Work passes New York (audit, 10 October 2026), the
 * calendar the rest of the page counts days in; left out, it is the clock of
 * whatever runs it.
 */
export function updatedWhen(iso: string, now = new Date(), zone?: string): string {
  const at = new Date(iso)
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
  // YYYY-MM-DD in the zone (en-CA writes dates that way).
  const dayOf = (d: Date) => d.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone })
  const day = dayOf(at), today = dayOf(now)
  if (day === today) return `today at ${time}`
  const [y, m, d] = today.split('-').map(Number)
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  if (day === yesterday) return `yesterday at ${time}`
  const date = at.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: zone, ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
  })
  return `${date} at ${time}`
}

/** What a list needs to say whose order it follows, and whether the reader can change it. */
export interface TeamOrderView {
  teamId: string
  teamName: string
  /** Steps placed by hand and still open. */
  placed: number
  /** The team has a workspace or board order. With neither, and nothing placed, the list is True North's. */
  levels: boolean
  updatedAt: string | null
  updatedBy: string | null
  updatedBySelf: boolean
  /** The person looking may set this team's order. */
  canEdit: boolean
  /** Every team the list could follow, when the person shown is on more than one. */
  choices: { id: string; name: string }[]
}

// ── Three levels: workspace, board, item ───────────────────────────────────
//
// Asked for on 18 September 2026 and confirmed the same day: a leader orders
// whole workspaces, then the boards inside each, then single items.
//
//   1. Workspaces in the leader's order: everything in the first comes before
//      anything in the second, late work included.
//   2. Inside each, boards in the leader's order.
//   3. Inside each board, True North's order: the soonest deadline first.
//   4. A step placed by hand at the Item level keeps its place above all of it,
//      even other workspaces (teamRanking, as before).
//
// What nobody ordered follows True North: with no workspace or board order at
// all, the list is True North's order exactly as before; once there is one, a
// workspace or board nobody placed joins the end of its level in True North's
// order (workspaces by their best board priority, then the most open steps;
// boards by priority, then the most open steps). The orders are rules, not
// snapshots: a step that lands on a board next week takes that board's place.

/** A team's own order for whole workspaces and whole boards. Empty lists mean "not set". */
export interface Levels {
  /** Workspace names, first to last. Boards with no workspace are under NO_WORKSPACE. */
  workspaces: string[]
  /** Board ids, first to last, each read inside its own workspace. */
  boards: number[]
}

export const NO_WORKSPACE = 'No workspace'

/** What the levels read from a step. */
export interface LevelFields {
  boardId: number
  boardName: string
  workspaceName: string | null
  priority: Priority
}

export const workspaceOf = (s: { workspaceName: string | null }): string => s.workspaceName ?? NO_WORKSPACE

/** Whether a team has set anything above the Item level. */
export function hasLevels(l: Levels | null | undefined): l is Levels {
  return !!l && (l.workspaces.length > 0 || l.boards.length > 0)
}

/** True North's order for workspaces: best board priority, then the most open steps, then the name. */
export function trueNorthWorkspaces(steps: LevelFields[]): string[] {
  const best = new Map<string, number>()
  const count = new Map<string, number>()
  for (const s of steps) {
    const w = workspaceOf(s)
    best.set(w, Math.min(best.get(w) ?? 9, RANK[s.priority] ?? 1))
    count.set(w, (count.get(w) ?? 0) + 1)
  }
  return [...best.keys()].sort((a, b) =>
    best.get(a)! - best.get(b)! || count.get(b)! - count.get(a)! || a.localeCompare(b, 'en'))
}

/** True North's order for the boards of each workspace: priority, then the most open steps, then the name. */
function trueNorthBoardsByWorkspace(steps: LevelFields[]): Map<string, number[]> {
  const info = new Map<number, { ws: string; rank: number; count: number; name: string }>()
  for (const s of steps) {
    const cur = info.get(s.boardId)
    if (cur) cur.count++
    else info.set(s.boardId, { ws: workspaceOf(s), rank: RANK[s.priority] ?? 1, count: 1, name: s.boardName })
  }
  const byWs = new Map<string, number[]>()
  for (const [id, b] of info) byWs.set(b.ws, [...(byWs.get(b.ws) ?? []), id])
  for (const [ws, ids] of byWs) {
    byWs.set(ws, ids.sort((a, b) => {
      const x = info.get(a)!, y = info.get(b)!
      return x.rank - y.rank || y.count - x.count || x.name.localeCompare(y.name, 'en')
    }))
  }
  return byWs
}

/** The team's workspaces, first to last: the leader's order, then the rest in True North's. */
export function workspaceRanking(steps: LevelFields[], levels: Levels | null): string[] {
  const tn = trueNorthWorkspaces(steps)
  const present = new Set(tn)
  const mine = (levels?.workspaces ?? []).filter((w, i, all) => present.has(w) && all.indexOf(w) === i)
  return [...mine, ...tn.filter(w => !mine.includes(w))]
}

/**
 * The team's boards, first to last, grouped under their workspace in
 * workspaceRanking's order: inside each workspace, the leader's order, then the
 * rest in True North's.
 */
export function boardRanking(steps: LevelFields[], levels: Levels | null): number[] {
  const tn = trueNorthBoardsByWorkspace(steps)
  const rank = new Map((levels?.boards ?? []).map((b, i) => [b, i]))
  return workspaceRanking(steps, levels).flatMap(ws => {
    const boards = tn.get(ws) ?? []
    const mine = boards.filter(b => rank.has(b)).sort((a, b) => rank.get(a)! - rank.get(b)!)
    return [...mine, ...boards.filter(b => !rank.has(b))]
  })
}

/**
 * Steps already in True North's order, put in the team's order before anything
 * is placed by hand: by board, in boardRanking's order, and inside a board as
 * True North has them. With no levels set, True North's order unchanged.
 */
export function levelOrder<T extends LevelFields>(stepsInTrueNorthOrder: T[], levels: Levels | null): T[] {
  if (!hasLevels(levels)) return stepsInTrueNorthOrder
  const place = new Map(boardRanking(stepsInTrueNorthOrder, levels).map((b, i) => [b, i]))
  return stepsInTrueNorthOrder
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (place.get(a.s.boardId) ?? 0) - (place.get(b.s.boardId) ?? 0) || a.i - b.i)
    .map(x => x.s)
}

/** The team's order over its open steps, before hand placing: True North's, then the levels. */
export function baseOrder<T extends OrderableStep & LevelFields>(steps: T[], levels: Levels | null): T[] {
  return levelOrder(defaultOrder(steps), levels)
}

/**
 * Levels as the server action receives them, checked: two lists, of workspace
 * names and of board ids, duplicates dropped. Anything else is refused.
 */
export function cleanLevels(v: unknown): Levels | null {
  if (!v || typeof v !== 'object') return null
  const { workspaces, boards } = v as { workspaces?: unknown; boards?: unknown }
  if (!Array.isArray(workspaces) || !Array.isArray(boards)) return null
  if (workspaces.length > 500 || boards.length > 5000) return null
  if (!workspaces.every(w => typeof w === 'string' && w.length > 0 && w.length <= 200)) return null
  if (!boards.every(b => typeof b === 'number' && Number.isSafeInteger(b) && b > 0)) return null
  return { workspaces: [...new Set(workspaces as string[])], boards: [...new Set(boards as number[])] }
}

// ── Who leads, and whose order a list follows ──────────────────────────────

export interface Membership {
  teamId: string
  teamName: string
  isPrimary: boolean
  /** team_members.position: 'founder', 'team_leader' or 'collaborator'. */
  position: string | null
}

/**
 * Leading a team is the team position, by the portal's one rule for it
 * (teamPositionLeads, which the org chart and tool grants use too): Founder,
 * Manager or Team Leader. This file first had its own list and left Manager
 * out, so Rock Kai could not set Africa's order.
 */
export function leads(m: Pick<Membership, 'position'>): boolean {
  return teamPositionLeads(m.position ?? 'collaborator')
}

/**
 * The team whose order a person's own list follows.
 *
 * The one asked for, if they are on it. Otherwise their main team, when it has
 * an order of its own; when it has none, the first of their other teams (by
 * name) that has one; and with no order anywhere, their main team again, whose
 * list is then in the default order. With no main team set, the first of their
 * teams by name stands in for it, so the answer does not change between loads.
 *
 * Decided on 16 September 2026. The first rule was "always the main team", and
 * it left every order reaching only its own leader: Jeannette was the only
 * person whose main team is SEO. Someone on several teams can still pick any of
 * them from the line above their list.
 */
export function orderTeamFor(
  memberships: Membership[],
  asked?: string | null,
  hasOrder: (teamId: string) => boolean = () => false,
): string | null {
  if (asked && memberships.some(m => m.teamId === asked)) return asked
  const byName = [...memberships].sort((a, b) => a.teamName.localeCompare(b.teamName, 'en'))
  const main = memberships.find(m => m.isPrimary) ?? byName[0]
  if (!main) return null
  if (hasOrder(main.teamId)) return main.teamId
  return byName.find(m => m.teamId !== main.teamId && hasOrder(m.teamId))?.teamId ?? main.teamId
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

// ── Who may set a team's order ─────────────────────────────────────────────

/** How far a person given team priority by name reaches. */
export type GrantScope = 'member' | 'all'

export const GRANT_SCOPES: readonly { value: GrantScope; label: string }[] = [
  { value: 'member', label: 'Teams they are on' },
  { value: 'all', label: 'Every team' },
]

export function isGrantScope(v: unknown): v is GrantScope {
  return v === 'member' || v === 'all'
}

export interface PriorityRights {
  /** Why they may set every team's order, or null when they may not. */
  everyTeam: 'admin' | 'level' | 'name' | null
  /** Their level lets them set the teams they lead. */
  teamsTheyLead: boolean
  /** They were given the teams they are on, by name. */
  teamsTheyAreOn: boolean
}

/** Why a person may set one team's order. */
export type OrderRight = 'admin' | 'level' | 'name' | 'leads' | 'member'

/**
 * Everything that lets a person set team priorities, in one place, so My Work,
 * the save action and the Access levels page cannot disagree:
 *
 *   admin                                every team, always
 *   level, "every team" row              every team
 *   by name, every team                  every team
 *   level, "teams they lead" row         each team where their position leads
 *   by name, the teams they are on       each team they belong to, any position
 *
 * `can` answers the Access levels matrix for their level, so an admin passes
 * both rows by itself.
 */
export function priorityRights(p: {
  isAdmin: boolean
  can: (surfaceKey: string) => boolean
  grant: GrantScope | null
}): PriorityRights {
  return {
    everyTeam: p.isAdmin ? 'admin' : p.can(PRIORITY_ALL) ? 'level' : p.grant === 'all' ? 'name' : null,
    teamsTheyLead: p.can(PRIORITY_OWN),
    teamsTheyAreOn: p.grant === 'member',
  }
}

/** Why this person may set this team's order, or null when they may not. */
export function orderRightFor(teamId: string, memberships: Membership[], rights: PriorityRights): OrderRight | null {
  if (rights.everyTeam) return rights.everyTeam
  const m = memberships.find(x => x.teamId === teamId)
  if (!m) return null
  if (rights.teamsTheyLead && leads(m)) return 'leads'
  if (rights.teamsTheyAreOn) return 'member'
  return null
}

/** Whether this person may set this team's order. */
export function canSetOrder(teamId: string, memberships: Membership[], rights: PriorityRights): boolean {
  return orderRightFor(teamId, memberships, rights) !== null
}

/** The teams, of those given, whose order this person may set. */
export function settableTeams<T extends { id: string }>(teams: T[], memberships: Membership[], rights: PriorityRights): T[] {
  return teams.filter(t => canSetOrder(t.id, memberships, rights))
}

export interface PriorityReach {
  /** Why they reach every team, or null. */
  every: 'admin' | 'level' | 'name' | null
  /** Otherwise, the teams they reach and why each. */
  teams: { id: string; name: string; why: 'leads' | 'member'; position: string | null }[]
}

/** What one person can change, for the list on Admin → Access levels. */
export function priorityReach(
  teams: { id: string; name: string }[],
  memberships: Membership[],
  rights: PriorityRights,
): PriorityReach {
  if (rights.everyTeam) return { every: rights.everyTeam, teams: [] }
  return {
    every: null,
    teams: teams.flatMap(t => {
      const why = orderRightFor(t.id, memberships, rights)
      if (why !== 'leads' && why !== 'member') return []
      return [{ id: t.id, name: t.name, why, position: memberships.find(m => m.teamId === t.id)?.position ?? null }]
    }),
  }
}
