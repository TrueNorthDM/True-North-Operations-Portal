// Reading the work list back out.
//
// Grouped the way the question is asked: workspace, then board, then the steps
// inside it. A person wanting to know what is theirs does not think in items,
// they think "what is waiting on me in Graphics".
//
// Open work first and by default. Every step a person was ever assigned is
// still here, and being able to look back matters, but a list that opens on
// four years of finished work is not a work list.

import type { Db } from '@/lib/supabase/types'
import { unresolvedAccounts } from './links'
import { readStages, type StepStage } from './steps'
import { missingColumn } from './ingest'
import { createAdminClient } from '@/lib/supabase/admin'
import { COMPLETED_MONTHS } from './constants'

export { COMPLETED_MONTHS }

type Client = Db

const PAGE = 1000

/**
 * How much the unfiltered view will read before it stops.
 *
 * There are 53,442 assignments. Paging all of them is fifty-four round trips
 * per page load, which is the shape of thing that froze the i7 report and the
 * Grant Pass page before it: correctness said nothing about cost either time.
 *
 * Nobody reads fifty thousand rows. Somebody looking at everything is
 * surveying, and a survey is served by the first few thousand plus an honest
 * count of the rest; somebody doing their work picks a person or a team, and
 * that query is small and complete. So the cap applies only when neither
 * filter is set, and the page says when it has been reached.
 */
const UNFILTERED_CAP = 5000


export interface WorkRow {
  id: number
  boardId: number
  boardName: string
  workspaceName: string | null
  itemId: number
  itemName: string
  /** Set when the step lives on a subitem: the name a person recognises. */
  parentItemName: string | null
  /**
   * The item's language, from its board's "Language" column. Five boards keep
   * one page per language as separate items with the same name, and without it
   * those rows read as duplicates.
   */
  language: string | null
  groupTitle: string | null
  stepName: string
  statusText: string | null
  statusDone: boolean | null
  /** Monday's own hex for this label, so the two never disagree on colour. */
  statusColor: string | null
  dueDate: string | null
  /**
   * A date outside living memory, kept but not trusted. Monday holds values
   * like year 202, typed wrong once and never noticed, and treating one as a
   * deadline floats the most broken row to the top of everyone's list.
   */
  dueSuspect: boolean
  /** Which column the date came from, so a wrong one can be spotted. */
  dueLabel: string | null
  /** Straight to the item in Monday. Null only while the slug is unknown. */
  url: string | null
  /**
   * Whether the Monday account behind this row is a person we know. False for
   * deleted accounts and anyone not linked yet, which is what the Unknown user
   * block collects: their work is real, it just has nobody to file it under.
   */
  assigneeKnown: boolean
  /** From the board. Orders the On-going block and nothing else. */
  priority: 'high' | 'medium' | 'low'
  mondayUserId: number
  who: string
  itemUpdatedAt: string | null
  /**
   * The people column this step lives on.
   *
   * Carried because it is half the key the change log uses: without it a row
   * on screen cannot be matched to its own history, and the Report ends up
   * guessing which step an event belongs to.
   */
  peopleCol: string
  /**
   * The step's place in its team's priority order, from 1. Set by the page for
   * open steps when the list follows a team's order (team-priority.ts); absent
   * everywhere else.
   */
  teamRank?: number | null
  /** Its place in True North's order for the same team, set alongside teamRank. */
  tnRank?: number | null
  /** A team leader placed it by hand; otherwise it follows True North's order (order-bands.ts). */
  placedByHand?: boolean
  /** Steps placed by hand before it in the team's order, which is why it sits lower than True North's place. */
  placedAbove?: number | null
}

// Workspace and board are columns on the row now, not levels of a tree. The
// grouped shape answered "what is happening in Graphics"; a flat table answers
// "what is on my plate", which is the question this page is named after, and
// it is the shape that can be sorted and read across boards at once.

/** Whose work: one person, one team, or several teams together. Nothing set: everyone. */
export interface PeopleFilter {
  /** Directory person, resolved to their Monday accounts. */
  personId?: string | null
  /** Portal team, resolved to its members' Monday accounts. */
  teamId?: string | null
  /**
   * Several teams at once: the Report's "My team" for someone who leads more
   * than one. An empty list means nobody, not everyone.
   */
  teamIds?: readonly string[] | null
  /** Several people at once: the notifications' scan of everyone's open work. */
  personIds?: readonly string[] | null
}

export interface WorklistFilters extends PeopleFilter {
  includeDone?: boolean
  /**
   * Open steps only, with no finished work at all. What a team's priority order
   * ranks: a finished step has no place in it.
   */
  openOnly?: boolean
  /**
   * Every matching row, past the 5,000 the Everyone view stops at. For the
   * Report, whose counts are wrong if they stop early; a page that lists rows
   * keeps the cap.
   */
  uncapped?: boolean
}

export interface Worklist {
  rows: WorkRow[]
  open: number
  total: number
  /**
   * Assignees who are neither linked to a person nor marked as outside True
   * North, which a team filter cannot see. Accounts settled either way are not
   * counted: an answered question is not an open one.
   */
  unlinked: number
  /** Assignments riding on those accounts, which is the size of the blind spot. */
  unlinkedAssignments: number
  /** True when the unfiltered view stopped early rather than reading everything. */
  truncated: boolean
  /** How many rows match, whether or not they were all read. */
  matching: number
  /**
   * The OLDEST board read, not the newest.
   *
   * Boards are refreshed in rotation, oldest first, so the newest stamp would
   * say "a minute ago" while some board had not been touched since morning.
   * The oldest is the only number that is true of everything on the page.
   */
  oldestSyncAt: string | null
}

/**
 * The Monday account's subdomain, which every "open in Monday" link is built on.
 *
 * Read with the caller's client first and the privileged one if that comes back
 * empty. app_settings is admin-only (migration 052, because it holds API tokens),
 * so for everyone who is not an admin the plain read returned nothing and every
 * row lost its link. Admins saw links, which is why it went unnoticed until
 * Stephanie asked where they were. The subdomain is in every link it builds, so
 * handing it to a signed-in reader discloses nothing.
 */
async function mondaySlug(supabase: Client): Promise<string | null> {
  const read = async (c: Client) => {
    const { data } = await c.from('app_settings').select('monday_account_slug').eq('singleton_id', 1).maybeSingle()
    return (data as { monday_account_slug: string | null } | null)?.monday_account_slug ?? null
  }
  const own = await read(supabase)
  if (own) return own
  try {
    return await read(createAdminClient())
  } catch {
    return null
  }
}

/**
 * The directory people a filter names. null is no filter at all (everyone); an
 * empty list is nobody, a team with no members, and the two stay apart.
 * One reading for the work list and every Report tab, so a team means the same
 * people on each of them.
 */
export async function peopleInFilter(supabase: Client, f: PeopleFilter): Promise<string[] | null> {
  if (f.personId) return [f.personId]
  if (f.personIds) return [...new Set(f.personIds)]
  const teams = f.teamIds ?? (f.teamId ? [f.teamId] : null)
  if (teams === null) return null
  if (!teams.length) return []
  const { data, error } = await supabase.from('team_members').select('person_id').in('team_id', [...teams])
  // A failed read is not an empty team: it would read as nobody's work.
  if (error) throw new Error(`Could not read the team members: ${error.message}`)
  return [...new Set(((data ?? []) as { person_id: string }[]).map(m => m.person_id))]
}

/** Monday accounts belonging to a set of directory people. */
async function accountsFor(supabase: Client, personIds: string[]): Promise<number[]> {
  if (!personIds.length) return []
  // In slices: a list of everyone is longer than a query string should be.
  const out: number[] = []
  for (let i = 0; i < personIds.length; i += 200) {
    const { data, error } = await supabase
      .from('monday_user_links').select('monday_user_id').in('person_id', personIds.slice(i, i + 200))
    if (error) throw new Error(`Could not read the Monday account links: ${error.message}`)
    out.push(...((data ?? []) as { monday_user_id: number }[]).map(r => r.monday_user_id))
  }
  return out
}

export async function loadWorklist(supabase: Client, f: WorklistFilters): Promise<Worklist> {
  // Who are we asking about. An empty array here means "nobody", which is not
  // the same as no filter, so the two cases stay apart.
  const people = await peopleInFilter(supabase, f)
  const onlyAccounts: number[] | null = people === null ? null : await accountsFor(supabase, people)

  const [boardRead, firstSteps, linkRead, userRead, peopleRead] =
    await Promise.all([
      supabase.from('monday_boards').select('id, name, workspace_name, included, items_synced_at, date_title, priority'),
      supabase.from('monday_board_steps').select('board_id, people_col, step_name, position, source, stages'),
      supabase.from('monday_user_links').select('monday_user_id, person_id'),
      supabase.from('monday_users').select('id, name, is_external, hidden'),
      supabase.from('people').select('id, full_name'),
    ])
  // A side read that fails is not an empty table: no boards would hide every
  // row, and the list (and the Report's counts) would read as no work at all.
  for (const [what, r] of [['boards', boardRead], ['account links', linkRead], ['Monday accounts', userRead], ['people', peopleRead]] as const) {
    if (r.error) throw new Error(`Could not read the ${what}: ${r.error.message}`)
  }
  const { data: boardRows } = boardRead
  const { data: linkRows } = linkRead
  const { data: userRows } = userRead
  const { data: peopleRows } = peopleRead
  // Migration 082 adds stages. Until it is run, every step reads as seeded
  // before stages existed, which is how the page behaved before it.
  let stepRows: unknown[] | null = firstSteps.data
  if (missingColumn(firstSteps.error, 'stages')) {
    stepRows = (await supabase.from('monday_board_steps').select('board_id, people_col, step_name, position, source')).data
  } else if (firstSteps.error) {
    throw new Error(`Could not read the board steps: ${firstSteps.error.message}`)
  }

  const slug = await mondaySlug(supabase)

  /**
   * A subitem's own board cannot be opened in Monday, so a subitem links to
   * its parent, on the parent's board. Falling back to the subitem's own board
   * would produce a URL that loads a page saying nothing is there, which is
   * worse than no link.
   */
  /** A deadline anyone could act on falls in this window; the rest is noise. */
  const plausible = (d: string | null): boolean => {
    if (!d) return false
    const y = Number(d.slice(0, 4))
    return y >= 2000 && y <= 2100
  }

  const itemUrl = (a: A): string | null => {
    if (!slug) return null
    const board = a.parent_board_id ?? (a.parent_item_id ? null : a.board_id)
    const item = a.parent_item_id ?? a.item_id
    if (!board) return null
    return `https://${slug}.monday.com/boards/${board}/pulses/${item}`
  }

  type B = {
    id: number; name: string; workspace_name: string | null; included: boolean
    items_synced_at: string | null; date_title: string | null
    priority: 'high' | 'medium' | 'low'
  }
  const boardList = (boardRows ?? []) as B[]
  const boards = new Map(boardList.map(b => [b.id, b]))
  type S = { board_id: number; people_col: string; step_name: string; position: number; source: string; stages?: unknown }
  const steps = new Map(((stepRows ?? []) as S[])
    .map(s => [`${s.board_id}:${s.people_col}`, { ...s, stageList: readStages(s.stages) }]))
  /** The stage a row was read from, by the columns written on the row. */
  const stageOf = (list: StepStage[] | null, a: { status_col: string | null; due_col?: string | null }) =>
    list?.find(st => st.statusCol === a.status_col && (a.due_col == null || st.dateCol === a.due_col)) ?? null
  const personByAccount = new Map(((linkRows ?? []) as { monday_user_id: number; person_id: string }[])
    .map(l => [l.monday_user_id, l.person_id]))
  const users = (userRows ?? []) as { id: number; name: string; is_external: boolean; hidden: boolean }[]
  const mondayName = new Map(users.map(u => [u.id, u.name]))
  // Settled the other way: somebody said this account is a client or an
  // outside collaborator. It has no person on purpose, so counting it as
  // "needs linking" reports a question that was already answered. This is the
  // third reader of that rule; the screen and the discovery had to learn it
  // separately, which is what adding a state to a schema actually costs.
  const externalAccounts = new Set(users.filter(u => u.is_external).map(u => u.id))
  // Switched off in Settings. Their assignments are still ingested and still
  // counted everywhere else; they just do not belong on this page.
  const hiddenAccounts = new Set(users.filter(u => u.hidden).map(u => u.id))
  const hiddenAccountIds = [...hiddenAccounts]
  const personName = new Map(((peopleRows ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))

  type A = {
    id: number; board_id: number; item_id: number; item_name: string
    parent_item_name: string | null; group_title: string | null
    people_col: string; monday_user_id: number
    status_text: string | null; status_done: boolean | null; status_color: string | null
    due_date: string | null; item_updated_at: string | null
    parent_item_id: number | null; parent_board_id: number | null
    status_col: string | null; due_col?: string | null; item_language?: string | null
  }
  const since = new Date()
  since.setMonth(since.getMonth() - COMPLETED_MONTHS)
  const sinceIso = since.toISOString()

  // Boards that are switched off are excluded in the QUERY, not filtered out
  // after the fact.
  //
  // Dropping them afterwards looked equivalent and was not: the unfiltered view
  // reads the first 5,000 rows, so a board switched off went on consuming that
  // budget and pushed real work out of the page. Switching something off has to
  // make room, otherwise hiding a board makes the list worse instead of shorter.
  const includedBoards = boardList.filter(b => b.included).map(b => b.id)

  let SELECT = 'id, board_id, item_id, item_name, parent_item_name, parent_item_id, parent_board_id, group_title, people_col, monday_user_id, status_text, status_done, status_color, due_date, item_updated_at, status_col, due_col, item_language'
  // A builder for a select list that changes with the migrations run (SELECT
  // is reassigned below), so it has no single generated type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyFilters = (q: any): any => {
    let out = q
    out = out.in('board_id', includedBoards)
    if (hiddenAccountIds.length) out = out.not('monday_user_id', 'in', `(${hiddenAccountIds.join(',')})`)
    if (onlyAccounts) out = out.in('monday_user_id', onlyAccounts)
    if (f.openOnly) {
      out = out.or('status_done.is.null,status_done.eq.false')
    } else if (!f.includeDone) {
      // Open work, plus finished work from the recent past. Both are wanted on
      // the page; the difference is which block they land in.
      out = out.or(`status_done.is.null,status_done.eq.false,item_updated_at.gte.${sinceIso}`)
    }
    return out
  }

  if (onlyAccounts && !onlyAccounts.length) {
    return { rows: [], open: 0, total: 0, unlinked: 0, unlinkedAssignments: 0, truncated: false, matching: 0, oldestSyncAt: null }
  }

  // How many match, asked once and counted by the database rather than by
  // reading the rows and measuring the array.
  const { count: matching } = (await applyFilters(
    supabase.from('monday_assignments').select('id', { count: 'exact', head: true }),
  )) as { count: number | null }

  const cap = onlyAccounts || f.uncapped ? Number.POSITIVE_INFINITY : UNFILTERED_CAP
  const rows: A[] = []
  let truncated = false
  for (let from = 0; from < cap; from += PAGE) {
    // Open work first, soonest deadline first, when the Everyone view stops at
    // its cap. Ordered by id it kept whichever rows happened to be inserted
    // first, which after every sync is a different, arbitrary 5,000.
    const page$ = () => applyFilters(
      supabase.from('monday_assignments').select(SELECT)
        .order('status_done', { ascending: true, nullsFirst: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1),
    )
    let { data, error } = (await page$()) as { data: A[] | null; error: { message: string } | null }
    // Columns from migrations that may not have run yet (082, 083): read
    // without them rather than failing the page.
    for (const col of ['item_language', 'due_col']) {
      if (from === 0 && missingColumn(error, col)) {
        SELECT = SELECT.replace(`, ${col}`, '')
        ;({ data, error } = (await page$()) as { data: A[] | null; error: { message: string } | null })
      }
    }
    if (error) throw new Error(error.message)
    const page = (data ?? []) as A[]
    rows.push(...page)
    if (page.length < PAGE) break
    if (from + PAGE >= cap) truncated = (matching ?? 0) > rows.length
  }

  const linkedAccounts = new Set(personByAccount.keys())
  const out: WorkRow[] = []
  let open = 0
  const accountsOnWork = new Set<number>()
  let unlinkedAssignments = 0

  for (const a of rows) {
    const b = boards.get(a.board_id)
    if (!b || !b.included) continue
    if (hiddenAccounts.has(a.monday_user_id)) continue
    const st = steps.get(`${a.board_id}:${a.people_col}`)
    // A column switched off is not a step, so it is not work.
    if (st?.source === 'off') continue
    // Nor is a people column that owns no status with a deadline. Hidden here
    // as well as by the ingest, so it takes effect the moment discovery says
    // so rather than when the board's turn in the sync comes round.
    if (st?.stageList && st.stageList.length === 0) continue
    const stage = stageOf(st?.stageList ?? null, a)

    const pid = personByAccount.get(a.monday_user_id)
    accountsOnWork.add(a.monday_user_id)
    // Same rule as the links screen, from the same function, so the two
    // screens cannot report different numbers for the same question.
    if (!pid && !externalAccounts.has(a.monday_user_id)) unlinkedAssignments++

    const row: WorkRow = {
      id: a.id,
      boardId: a.board_id,
      boardName: b.name,
      workspaceName: b.workspace_name,
      itemId: a.item_id,
      itemName: a.item_name,
      parentItemName: a.parent_item_name,
      language: a.item_language ?? null,
      groupTitle: a.group_title,
      stepName: stage?.statusTitle ?? st?.step_name ?? a.people_col,
      peopleCol: a.people_col,
      statusText: a.status_text,
      statusDone: a.status_done,
      statusColor: a.status_color,
      dueDate: a.due_date,
      dueSuspect: a.due_date != null && !plausible(a.due_date),
      // The step's own deadline column when it has one: "Review by", not the
      // board's "Audit By".
      dueLabel: stage?.dateTitle ?? b.date_title ?? null,
      url: itemUrl(a),
      assigneeKnown: pid != null,
      priority: b.priority ?? 'medium',
      mondayUserId: a.monday_user_id,
      who: (pid ? personName.get(pid) : undefined) ?? mondayName.get(a.monday_user_id) ?? `User ${a.monday_user_id}`,
      itemUpdatedAt: a.item_updated_at,
    }
    if (row.statusDone !== true) open++

    out.push(row)
  }

  // Open before finished, then soonest deadline, then alphabetical. A row with
  // no date is not urgent, so it sits behind the dated ones instead of ahead.
  // A suspect date sorts as though it had none: an unreadable year is not an
  // urgency, and letting it sort puts the worst data first.
  const sortDate = (r: WorkRow) => (r.dueDate && !r.dueSuspect ? r.dueDate : '')
  out.sort((x, y) =>
    Number(x.statusDone) - Number(y.statusDone)
    || (sortDate(x) ? 0 : 1) - (sortDate(y) ? 0 : 1)
    || sortDate(x).localeCompare(sortDate(y))
    || (x.parentItemName ?? x.itemName).localeCompare(y.parentItemName ?? y.itemName))

  const stamps = boardList
    .filter(b => b.included && b.items_synced_at)
    .map(b => b.items_synced_at as string)
    .sort()

  return {
    rows: out,
    open,
    total: rows.length,
    unlinked: unresolvedAccounts(accountsOnWork, linkedAccounts, externalAccounts).size,
    unlinkedAssignments,
    truncated,
    matching: matching ?? rows.length,
    oldestSyncAt: stamps[0] ?? null,
  }
}
