/**
 * What each notification looks for. A generator returns drafts, "this person
 * should hear about this", and nothing else: whether they do, and when, is
 * deliver.ts's decision, from the admin's rule and the person's choice.
 *
 * Every draft has a dedupe key chosen so that looking again finds the same
 * thing under the same key. The runs happen six times a day and repeat
 * themselves freely; the table's unique key is what makes it one notification.
 *
 * Work is read through My Work's own loader (loadWorklist), so "open", "late"
 * and "due" mean here exactly what they mean on the page the notification
 * links to: switched-off boards, hidden accounts, columns that are not steps
 * and implausible dates are left out by the same code.
 */

import type { Db } from '@/lib/supabase/types'
import { selectAllPages } from '@/lib/monday/worklist/resilience'
import { loadWorklist, type WorkRow } from '@/lib/monday/worklist/data'
import { loadPublishingWeeks } from '@/lib/boards/publishing-weeks'
import { workingDaysGone } from '@/lib/boards/publishing-cycles'
import { loadI7Carryover } from '@/lib/tsheets/report-data'
import { HEALTH_LABEL, type HealthResult } from '@/lib/health/checks'
import { ROLE_TYPE_LABEL } from '@/lib/directory/people-types'
import { ROUTES } from '@/lib/nav/routes'
import { LATE_PILE, TYPE_BY_KEY } from './catalogue'
import { addDays, weekOf, zoneDate } from './schedule'
import { readState } from './store'
import type { Audience, Recipient } from './audience'
import type { Draft } from './deliver'
import { MONTH_LONG, MONTH_SHORT } from '@/lib/format/months'

type Client = Db

export interface Ctx {
  db: Client
  aud: Audience
  now: Date
  /** Today in New York, YYYY-MM-DD. */
  today: string
}

export const makeCtx = (db: Client, aud: Audience, now = new Date()): Ctx => ({ db, aud, now, today: zoneDate(now) })

/**
 * A person-shaped list: "A, B and 3 more". Names that repeat (two steps on
 * items with the same name) are shown once, but "more" counts every entry, so
 * the number agrees with the count in the title. Pass a set when the entries
 * themselves should be counted once (board names).
 */
export function listOf(names: readonly string[], max = 2): string {
  const shown = [...new Set(names)].slice(0, max)
  const more = names.length - shown.length
  if (more > 0) return `${shown.join(', ')} and ${more} more`
  return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown.join(', ')
}

/** Ends a sentence without doubling what a title already ends with ("Important?."). */
const sentence = (s: string) => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`)

const shortDate = (iso: string) => `${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

/** "Review: Salvation page (AAAF Pages)" */
const stepLabel = (r: WorkRow) => `${r.stepName}: ${r.parentItemName ?? r.itemName}`

/** Only to people the type can reach at all (the catalogue's audience). */
function draftFor(ctx: Ctx, type: string, r: Recipient | undefined, d: Omit<Draft, 'personId' | 'type'>): Draft[] {
  const t = TYPE_BY_KEY.get(type)
  if (!t || !r || !ctx.aud.reached(t, r)) return []
  return [{ personId: r.personId, type, ...d }]
}

// ── My Work: new, due tomorrow, late, and a team's late pile ──────────────────

// Every read here throws on failure (audit, 9 October 2026): an empty answer
// would be taken for "nothing happened", and an event window that moves on
// without its events never reads them again.

async function accountOwners(db: Client): Promise<Map<number, string>> {
  const { data, error } = await db.from('monday_user_links').select('monday_user_id, person_id')
  if (error) throw new Error(`Monday account owners could not be read: ${error.message}`)
  return new Map(((data ?? []) as { monday_user_id: number; person_id: string }[]).map(l => [l.monday_user_id, l.person_id]))
}

/**
 * The "assigned" events of this sync that are real hand-offs.
 *
 * A board read for the first time has no "before", so every step on it comes
 * out as newly assigned: hundreds of notifications about work people have had
 * for months. A board with no history before this sync is therefore skipped;
 * from its second read on, its events are the real thing.
 */
async function newAssignments(db: Client, since: string): Promise<Set<string>> {
  // Every one, in order: a single read stops at 1,000 rows, in no order, and
  // real hand-offs past it went unannounced. A step already finished when it
  // "landed" is not new work for anyone (audit, 10 October 2026).
  type E = { board_id: number; item_id: number; people_col: string; monday_user_id: number }
  const { data: events, error } = await selectAllPages<E>((from, to) => db.from('monday_assignment_events')
    .select('board_id, item_id, people_col, monday_user_id')
    .eq('event', 'assigned').gte('detected_at', since)
    .or('status_done.is.null,status_done.eq.false')
    .order('id').range(from, to))
  if (error) throw new Error(`Assignment events could not be read: ${error.message}`)
  const boards = [...new Set(events.map(e => e.board_id))]
  const known = new Set<number>()
  await Promise.all(boards.map(async b => {
    const { data: older, error: e } = await db.from('monday_assignment_events').select('id').eq('board_id', b).lt('detected_at', since).limit(1)
    if (e) throw new Error(`Assignment history could not be read: ${e.message}`)
    if (older?.length) known.add(b)
  }))
  return new Set(events.filter(e => known.has(e.board_id)).map(e => `${e.item_id}:${e.people_col}:${e.monday_user_id}`))
}

/**
 * T1, T2, T3 and T8 from one read of everyone's open work.
 *
 * Grouped per person: five steps assigned in one sync are one notification
 * that says five, not five notifications. Due and late are grouped per day for
 * the same reason.
 */
export async function workDrafts(ctx: Ctx, opts: { since: string | null }): Promise<Draft[]> {
  const { db, aud, today } = ctx
  const everyone = new Set<string>(aud.people.map(r => r.personId))
  for (const ids of aud.teamMembers.values()) for (const id of ids) everyone.add(id)
  const [list, owners, fresh] = await Promise.all([
    loadWorklist(db, { personIds: [...everyone], openOnly: true }),
    accountOwners(db),
    opts.since ? newAssignments(db, opts.since) : Promise.resolve(new Set<string>()),
  ])

  const byPerson = new Map<string, WorkRow[]>()
  for (const r of list.rows) {
    if (r.statusDone === true) continue
    const pid = owners.get(r.mondayUserId)
    if (!pid) continue
    ;(byPerson.get(pid) ?? byPerson.set(pid, []).get(pid)!).push(r)
  }

  const out: Draft[] = []
  const tomorrow = addDays(today, 1)
  const dated = (r: WorkRow) => (r.dueDate && !r.dueSuspect ? r.dueDate : null)

  for (const [pid, rows] of byPerson) {
    const me = aud.byId.get(pid)

    // T1: assigned in this sync.
    const assigned = rows.filter(r => fresh.has(`${r.itemId}:${r.peopleCol}:${r.mondayUserId}`))
    if (assigned.length && opts.since) {
      out.push(...draftFor(ctx, 'step-assigned', me, {
        title: assigned.length === 1 ? 'A new step was assigned to you' : `${assigned.length} new steps were assigned to you`,
        body: assigned.length === 1
          ? `${stepLabel(assigned[0])} (${assigned[0].boardName})`
          : `${listOf(assigned.map(stepLabel), 1)}, in ${listOf([...new Set(assigned.map(r => r.boardName))])}`,
        href: '/my-work',
        dedupeKey: `sync:${opts.since}`,
      }))
    }

    // T2: due tomorrow, told the day before. Tomorrow and the day after are
    // both looked at, so the evening run can fill the next morning's summary.
    for (const due of [tomorrow, addDays(today, 2)]) {
      const soon = rows.filter(r => dated(r) === due)
      if (!soon.length) continue
      out.push(...draftFor(ctx, 'step-due-tomorrow', me, {
        title: soon.length === 1 ? 'A step of yours is due tomorrow' : `${soon.length} steps of yours are due tomorrow`,
        body: `${sentence(listOf(soon.map(stepLabel), 2))} Due ${shortDate(due)}.`,
        href: '/my-work',
        dedupeKey: due,
        deliverDay: addDays(due, -1),
      }))
    }

    // T3: became late. Yesterday's deadlines, and the day before in case a
    // run was missed; older ones are not news, and on the first run they
    // would have been a flood.
    for (const due of [addDays(today, -1), addDays(today, -2)]) {
      const late = rows.filter(r => dated(r) === due)
      if (!late.length) continue
      out.push(...draftFor(ctx, 'step-late', me, {
        title: late.length === 1 ? 'A step of yours became late' : `${late.length} steps of yours became late`,
        body: `${sentence(listOf(late.map(stepLabel), 2))} Due ${shortDate(due)}.`,
        href: '/my-work',
        dedupeKey: due,
      }))
    }
  }

  // T8: people on a team you lead with LATE_PILE or more late steps. One
  // notification per team per week, naming them, most late first: the first
  // dry run (22 September 2026) found fourteen people over the line on the
  // first day, some with over a hundred, and one notification each would have
  // been the noise that teaches leaders to stop reading.
  const PILE = LATE_PILE
  const week = weekOf(today)
  for (const [teamId, memberIds] of aud.teamMembers) {
    const leaders = aud.leadersOf(teamId)
    if (!leaders.length) continue
    const piles = memberIds
      .map(mid => ({
        mid,
        late: (byPerson.get(mid) ?? []).filter(r => { const d = dated(r); return !!d && d < today }),
      }))
      .filter(p => p.late.length >= PILE)
      .sort((a, b) => b.late.length - a.late.length)
    const team = aud.teamName.get(teamId) ?? 'your team'
    for (const l of leaders) {
      const others = piles.filter(p => p.mid !== l.personId)
      if (!others.length) continue
      const nameOf = (p: typeof others[number]) => aud.byId.get(p.mid)?.name ?? p.late[0].who
      out.push(...draftFor(ctx, 'team-late-pile', l, {
        title: others.length === 1 ? `Late steps piling up on ${team}` : `${others.length} people on ${team} have ${PILE}+ late steps`,
        body: others.length === 1
          ? `${nameOf(others[0])} has ${others[0].late.length} late steps.`
          : `${listOf(others.map(p => `${nameOf(p)} (${p.late.length})`), 3)}.`,
        href: '/my-work?tab=team',
        dedupeKey: `${teamId}:${week}`,
      }))
    }
  }
  return out
}

// ── T4: a team's priority order changed ─────────────────────────────────────

export function teamOrderDrafts(ctx: Ctx, teamId: string, actorId: string): Draft[] {
  const actor = ctx.aud.byId.get(actorId)?.name ?? 'A team leader'
  const team = ctx.aud.teamName.get(teamId) ?? 'your team'
  return ctx.aud.membersOf(teamId)
    .filter(r => r.personId !== actorId)
    .flatMap(r => draftFor(ctx, 'team-order-changed', r, {
      title: "Your team's priority order changed",
      body: `${actor} saved a new order for ${team}.`,
      href: '/my-work',
      // Once a day per team: a leader saving five times in an afternoon is
      // one change to the people who follow the order.
      dedupeKey: `${teamId}:${ctx.today}`,
    }))
}

// ── T6: Publishing Goals behind pace ────────────────────────────────────────

/**
 * The week still running, judged on the weekdays already gone: on Thursday a
 * client with a target of 10 should have 6. Monday has nothing gone yet, and
 * the weekend counts the whole week.
 */
export function expectedSoFar(target: number, today: string): number {
  const [y, m, d] = today.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const gone = dow === 0 || dow === 6 ? 5 : dow - 1
  return Math.floor((target * gone) / 5)
}

/**
 * A two-week cycle still running, judged over its ten working days the same
 * way (15 October 2026): on the second Wednesday a target of 10 should have 7.
 * `cycleStart` is the cycle's Monday.
 */
export function expectedInCycle(target: number, cycleStart: string, today: string): number {
  const gone = workingDaysGone({ start: cycleStart, end: addDays(cycleStart, 13) }, today)
  return Math.floor((target * gone) / 10)
}

/** Older than this, the boards were not read in time to say anyone is behind. */
const SNAPSHOT_FRESH_MS = 8 * 3_600_000

export async function publishingDrafts(ctx: Ctx): Promise<Draft[]> {
  // The week (or two-week cycle) still running, from its Monday 00:00 in New
  // York, not UTC midnight, which is Sunday evening there (audit, 10 October 2026).
  const { boards, updatedAt } = await loadPublishingWeeks(ctx.now, 'current')
  // A stale read would announce a client as behind on pages it already
  // published: say nothing until the boards are read again.
  if (!updatedAt || ctx.now.getTime() - Date.parse(updatedAt) > SNAPSHOT_FRESH_MS) return []
  const readers = ctx.aud.withTool('publishing')
  const out: Draft[] = []
  for (const b of boards) {
    const w = b.weeks[0]
    if (!w) continue
    const cycle = b.cycleWeeks === 2
    const expected = cycle ? expectedInCycle(b.perPeriod, w.start, ctx.today) : expectedSoFar(b.perPeriod, ctx.today)
    if (b.perPeriod <= 0 || expected <= 0 || w.done >= expected) continue
    for (const r of readers) {
      out.push(...draftFor(ctx, 'publishing-behind', r, {
        title: 'Publishing Goals behind pace',
        body: `${b.name}: ${w.done} of ${b.perPeriod} published this ${cycle ? 'cycle' : 'week'}, ${expected} expected by now.`,
        href: ROUTES.publishing,
        // Once per board and week, or per board and cycle: w.start is its Monday.
        dedupeKey: `${b.boardId}:${w.start}`,
      }))
    }
  }
  return out
}

// ── T7: i7 budget crossed 75% or 90% ────────────────────────────────────────

/** The highest threshold crossed, or null. A percentage, not dollars: who gets it may not see amounts. */
export function crossed(used: number, budget: number): 75 | 90 | null {
  if (budget <= 0) return null
  const pct = used / budget
  return pct >= 0.9 ? 90 : pct >= 0.75 ? 75 : null
}

export async function i7Drafts(ctx: Ctx): Promise<Draft[]> {
  const month = ctx.today.slice(0, 7)
  const c = await loadI7Carryover(month, ctx.db)
  // Against the money available this month (the budget plus or minus what
  // carried in), as the report, Home and the image measure it: against the
  // bare budget the screen could say 92% while this said 81% and never warned.
  const level = crossed(c.monthUsed, c.totalAvailable)
  if (!level) return []
  const pct = Math.floor((c.monthUsed / c.totalAvailable) * 100)
  return ctx.aud.withTool('i7-budget').flatMap(r => draftFor(ctx, 'i7-budget', r, {
    title: `i7 budget crossed ${level}%`,
    body: `i7 has used ${pct}% of the budget available in ${MONTH_LONG[Number(month.slice(5)) - 1]}.`,
    href: ROUTES.i7,
    dedupeKey: `${month}:${level}`,
  }))
}

// ── System ──────────────────────────────────────────────────────────────────

/** S1: an integration stopped answering. Once a day per service while it stays down. */
export function integrationDrafts(ctx: Ctx, results: readonly HealthResult[]): Draft[] {
  // Whoever sees the integration alert on Home (home-health), linked to
  // Automations when they can open it, else to Home, where the alert is.
  return results.filter(r => r.status === 'down').flatMap(res => ctx.aud.withTool('home-health').flatMap(a => draftFor(ctx, 'integration-failed', a, {
    title: `${HEALTH_LABEL[res.service] ?? res.service} is not answering`,
    body: res.detail,
    href: a.canTool('automations') ? '/admin/automations' : '/',
    dedupeKey: `${res.service}:${ctx.today}`,
  })))
}

/** S2: the Monday sync stopped before reading every board. */
export function syncDrafts(ctx: Ctx, info: { since: string; remaining: number | null; reason: string }): Draft[] {
  const started = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(info.since))
  const left = info.remaining == null ? 'before reading every board' : `with ${info.remaining} board${info.remaining === 1 ? '' : 's'} left`
  return ctx.aud.withTool('home-health').flatMap(a => draftFor(ctx, 'sync-incomplete', a, {
    title: "A sync didn't finish",
    body: `The Monday sync that started at ${started} stopped ${left}: ${info.reason}`,
    href: a.canTool('settings') ? '/admin/settings#my-work' : '/',
    dedupeKey: info.since,
  }))
}

/**
 * S3: someone signed in for the first time. From the access log: a login
 * whose earliest visit falls in the last three days. Three days, not one, so a
 * missed run does not lose anybody; the dedupe key is the account.
 */
export async function firstLoginDrafts(ctx: Ctx): Promise<Draft[]> {
  const from = new Date(ctx.now.getTime() - 3 * 86_400_000).toISOString()
  const { data, error } = await ctx.db.from('access_log').select('profile_id, person_id, name, email, accessed_at').gte('accessed_at', from)
  if (error) throw new Error(`The access log could not be read: ${error.message}`)
  const recent = (data ?? []) as { profile_id: string; person_id: string | null; name: string | null; email: string | null }[]
  const ids = [...new Set(recent.map(r => r.profile_id).filter(Boolean))]
  if (!ids.length) return []
  // One row per account is enough to know it came before; a failed read
  // throws, or every recent visitor would look new and flood the admins.
  const older = new Set<string>()
  for (let i = 0; i < ids.length; i += 10) {
    await Promise.all(ids.slice(i, i + 10).map(async id => {
      const { data: one, error: e } = await ctx.db.from('access_log').select('profile_id').eq('profile_id', id).lt('accessed_at', from).limit(1)
      if (e) throw new Error(`The access log could not be read: ${e.message}`)
      if (one?.length) older.add(id)
    }))
  }
  const out: Draft[] = []
  for (const id of ids) {
    if (older.has(id)) continue
    const row = recent.find(r => r.profile_id === id)!
    const person = ctx.aud.byProfile.get(id)
    const who = person?.name ?? row.name ?? row.email ?? 'Someone'
    const level = person ? ROLE_TYPE_LABEL[person.roleType] ?? person.roleType : 'no Directory person yet'
    for (const a of ctx.aud.withTool('d-log')) {
      if (a.profileId === id) continue
      out.push(...draftFor(ctx, 'first-login', a, {
        title: 'Someone signed in for the first time',
        body: `${who} signed in for the first time, as ${level}.`,
        href: '/directory',
        dedupeKey: id,
      }))
    }
  }
  return out
}

/** S4: an access level changed. Admins are told (not the one who did it), and so is the person. */
export function levelDrafts(ctx: Ctx, change: { personId: string; name: string; from: string; to: string; actorProfileId: string | null }): Draft[] {
  const label = (k: string) => ROLE_TYPE_LABEL[k] ?? k
  const key = `${change.personId}:${change.to}:${ctx.now.getTime()}`
  const out: Draft[] = []
  // Who keeps the Access log (d-log), not every admin by level (audit, 9 October 2026).
  for (const a of ctx.aud.withTool('d-log')) {
    if (a.profileId === change.actorProfileId || a.personId === change.personId) continue
    out.push(...draftFor(ctx, 'level-changed', a, {
      title: 'An access level was changed',
      body: `${change.name} is now ${label(change.to)} (was ${label(change.from)}).`,
      href: a.canTool('access-levels') ? '/admin/access-levels?tab=people' : '/directory',
      dedupeKey: key,
    }))
  }
  out.push(...draftFor(ctx, 'level-changed', ctx.aud.byId.get(change.personId), {
    title: 'Your access level changed',
    body: `You are now ${label(change.to)} in the portal (was ${label(change.from)}).`,
    href: '/',
    dedupeKey: key,
  }))
  return out
}

/** S6: access rules changed (7 October 2026). Every Super Admin but the one who did it, with the reason. */
export function accessChangeDrafts(ctx: Ctx, change: { changeId: number; summary: string; reason: string; actorPersonId: string | null }): Draft[] {
  const out: Draft[] = []
  for (const r of ctx.aud.withTool('access-levels')) {
    if (r.personId === change.actorPersonId) continue
    out.push(...draftFor(ctx, 'access-rules-changed', r, {
      title: 'Access rules were changed',
      body: `${sentence(change.summary)} Why: ${sentence(change.reason)}`,
      href: '/admin/access-levels?tab=log',
      dedupeKey: `change-${change.changeId}`,
    }))
  }
  return out
}

/**
 * S5: a Monday account nobody in the Directory is. Told once per account.
 *
 * The first run only takes note: the accounts already waiting are not news,
 * and telling admins about all of them at once would bury the next real one.
 */
export const UNLINKED_SEEN = 'monday-unlinked-seen'

/**
 * The accounts seen so far, to save once the drafts below are delivered (and
 * only then: saved first, a failed delivery told nobody and never would).
 */
export async function unlinkedSeen(ctx: Ctx, unlinked: readonly { id: number }[]): Promise<number[]> {
  const seen = await readState<number[]>(ctx.db, UNLINKED_SEEN)
  return [...new Set([...(seen ?? []), ...unlinked.map(u => u.id)])]
}

/**
 * An account already deleted in Monday, kept only so its old work has an
 * owner (the "Removed account" placeholder the Monday sync writes). Nobody can
 * be linked to it, so it is not news (decided 13 October 2026, after 28 of
 * them reached five admins at once).
 */
export const isRemovedAccount = (u: { name: string; email: string | null }) =>
  !u.email && /^Removed account \d+$/.test(u.name)

export async function unlinkedDrafts(ctx: Ctx, unlinked: readonly { id: number; name: string; email: string | null }[]): Promise<Draft[]> {
  const seen = await readState<number[]>(ctx.db, UNLINKED_SEEN)
  if (seen === null) return []
  const known = new Set(seen)
  return unlinked.filter(u => !known.has(u.id) && !isRemovedAccount(u)).flatMap(u => ctx.aud.withTool('monday-accounts').flatMap(a => draftFor(ctx, 'monday-account-unlinked', a, {
    title: 'A new Monday account with no person',
    body: `${u.name}${u.email ? ` (${u.email})` : ''} has no person in the Directory, so its work shows under Unknown user.`,
    href: '/admin/monday-links',
    dedupeKey: String(u.id),
  })))
}

// ── Clocky (16 October 2026) ────────────────────────────────────────────────
//
// The text of each is decided by Clocky (lib/timeclock), in each person's own
// time zone, as the design writes it; the whole sentence is the title and the
// body is empty. The bell row's button comes from the catalogue (`button`).

/** The clock panel, opened from a bell row or an email link (the top bar reads `clock=open`). */
export const CLOCK_PANEL_HREF = '/clocky-hours?clock=open'

/**
 * N1: "Still working?" at 4h 30m, once per window. Keyed by the window's
 * start, as tc_entries holds it, so "Keep going" finds the row to mark done.
 */
export function clockyStillWorkingDrafts(ctx: Ctx, x: { personId: string; windowStartedAt: string; text: string }): Draft[] {
  return draftFor(ctx, 'clocky-still-working', ctx.aud.byId.get(x.personId), {
    title: x.text, body: '', href: CLOCK_PANEL_HREF, dedupeKey: x.windowStartedAt,
  })
}

/** N2: the clock stopped by itself (the email goes with it, run.ts). */
export function clockyStoppedDrafts(ctx: Ctx, x: { personId: string; entryId: number; text: string }): Draft[] {
  return draftFor(ctx, 'clocky-stopped', ctx.aud.byId.get(x.personId), {
    title: x.text, body: '', href: CLOCK_PANEL_HREF, dedupeKey: `stop:${x.entryId}`,
  })
}

/**
 * N3: a time correction to review, to everyone who may approve it: the Team
 * Lead of a team the person is on (with "the teams they lead"), Admins and
 * Super Admins (with "everyone's hours"), each with Approvals open; never the
 * person (lib/timeclock/scope.ts, canApproveCorrection).
 */
export function clockyCorrectionRequestedDrafts(ctx: Ctx, x: { requestId: number; personId: string; teamIds: readonly string[]; text: string }): Draft[] {
  return ctx.aud.people
    .filter(r => r.personId !== x.personId && r.canTool('clocky-approvals') && r.canTool('clocky-hours')
      && (r.canTool('ck-all') || (r.canTool('ck-team') && x.teamIds.some(t => r.teams.get(t) === true))))
    .flatMap(r => draftFor(ctx, 'clocky-correction-requested', r, {
      title: x.text, body: '', href: '/clocky-hours/approvals', dedupeKey: String(x.requestId),
    }))
}

/** N4: the requester hears the decision either way. */
export function clockyCorrectionDecidedDrafts(ctx: Ctx, x: { requestId: number; personId: string; text: string }): Draft[] {
  return draftFor(ctx, 'clocky-correction-decided', ctx.aud.byId.get(x.personId), {
    title: x.text, body: '', href: '/clocky-hours', dedupeKey: String(x.requestId),
  })
}

/** Time off asked for: to the Super Admins who decide it, never the person. */
export function clockyTimeOffRequestedDrafts(ctx: Ctx, x: { requestId: number; personId: string; text: string }): Draft[] {
  return ctx.aud.withTool('ck-timeoff').filter(r => r.personId !== x.personId)
    .flatMap(r => draftFor(ctx, 'clocky-timeoff-requested', r, {
      title: x.text, body: '', href: '/clocky-hours/approvals', dedupeKey: String(x.requestId),
    }))
}

/** A timesheet sent: to whoever decides it first (README_PART2 routing), never the person. */
export function clockyTimesheetSubmittedDrafts(ctx: Ctx, x: { submissionId: number; sentAt: string; personId: string; to: readonly string[]; text: string }): Draft[] {
  return x.to.filter(id => id !== x.personId).map(id => ctx.aud.byId.get(id))
    .flatMap(r => draftFor(ctx, 'clocky-timesheet-submitted', r, {
      title: x.text, body: '', href: '/clocky-hours/approvals', dedupeKey: `${x.submissionId}:${x.sentAt}`,
    }))
}

/** A timesheet approved, returned or reopened: to its person. */
export function clockyTimesheetDecidedDrafts(ctx: Ctx, x: { submissionId: number; at: string; personId: string; text: string }): Draft[] {
  return draftFor(ctx, 'clocky-timesheet-decided', ctx.aud.byId.get(x.personId), {
    title: x.text, body: '', href: '/clocky-hours', dedupeKey: `${x.submissionId}:${x.at}`,
  })
}

/** Time off approved or denied: to the person who asked. */
export function clockyTimeOffDecidedDrafts(ctx: Ctx, x: { requestId: number; personId: string; text: string }): Draft[] {
  return draftFor(ctx, 'clocky-timeoff-decided', ctx.aud.byId.get(x.personId), {
    title: x.text, body: '', href: '/clocky-hours', dedupeKey: String(x.requestId),
  })
}

/** Someone else ended the person's running clock (Who's working, 2E): to that person. */
export function clockyClockedOutForDrafts(ctx: Ctx, x: { entryId: number; personId: string; text: string }): Draft[] {
  return draftFor(ctx, 'clocky-clocked-out-for', ctx.aud.byId.get(x.personId), {
    title: x.text, body: '', href: `/clocky-hours?entry=${x.entryId}`, dedupeKey: String(x.entryId),
  })
}

/** The line in the Super Admins' daily summary: "2 automatic clock-outs yesterday: Wendy Cacka, Justus Tsofa." */
export function autoStopsLine(names: readonly string[]): string {
  const n = names.length
  return `${n} automatic clock-out${n === 1 ? '' : 's'} yesterday: ${names.join(', ')}.`
}

/**
 * Yesterday's automatic clock-outs (New York's calendar, as the summaries),
 * one line per Super Admin, once a day. Nothing on a day with none.
 */
export async function clockyAutoStopDrafts(ctx: Ctx): Promise<Draft[]> {
  const yesterday = addDays(ctx.today, -1)
  const from = new Date(Date.parse(`${yesterday}T00:00:00Z`) - 36 * 3_600_000).toISOString()
  const { data, error } = await ctx.db.from('tc_safety_events')
    .select('person_id, stopped_at').eq('kind', 'auto_stop').gte('stopped_at', from).order('stopped_at')
  if (error) throw new Error(`Clock safety could not be read: ${error.message}`)
  const rows = ((data ?? []) as { person_id: string; stopped_at: string | null }[])
    .filter(r => r.stopped_at && zoneDate(new Date(r.stopped_at)) === yesterday)
  if (!rows.length) return []
  const { data: people, error: pe } = await ctx.db.from('people').select('id, full_name').in('id', [...new Set(rows.map(r => r.person_id))])
  if (pe) throw new Error(`People could not be read: ${pe.message}`)
  const nameOf = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
  // One name per person, in the order their clocks stopped; the count is every stop.
  const names = [...new Set(rows.map(r => nameOf.get(r.person_id) ?? 'Someone'))]
  const title = rows.length === names.length ? autoStopsLine(names) : `${rows.length} automatic clock-outs yesterday: ${names.join(', ')}.`
  return ctx.aud.withTool('access-levels').flatMap(r => draftFor(ctx, 'clocky-auto-stops', r, {
    title, body: '', href: '/clocky-hours/safety', dedupeKey: yesterday,
  }))
}
