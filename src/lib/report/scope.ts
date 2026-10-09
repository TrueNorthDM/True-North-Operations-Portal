// Scope and period: what the Report is looking at, and over how long.
//
// Both live in the query string so a report can be pasted into Slack and open
// the same way for whoever clicks it. That is also why neither can be trusted:
// the URL is typed by people, and a level 1 person who edits ?scope=everyone
// must land on their own work, not on an error and certainly not on everyone.
//
// Clamping is done here rather than in the page because the same three cases
// have now been got wrong three times in this codebase, each time by a second
// reader of a rule that was only written down once.

import type { PeopleFilter } from '@/lib/monday/worklist/data'

export type Scope = 'me' | 'team' | 'everyone'

export const SCOPE_LABEL: Record<Scope, string> = {
  me: 'Me',
  team: 'My team',
  everyone: 'Everyone',
}

/**
 * Which scopes a person may ask for.
 *
 * Level 1 gets one option, and gets it as a control with a single segment
 * rather than as a disabled button: permission shows up as a shorter control,
 * never as something greyed out that hints at a page they are missing.
 *
 * My team is the teams the person leads, at every level (decided 9 October
 * 2026): someone who leads no team has no My team to offer. Before, an Admin
 * leading no team got "My team" reading the whole company, labelled My team on
 * the screen, the PDF and the file name.
 */
export function scopesFor(level: number, leadsATeam = true): Scope[] {
  const out: Scope[] = ['me']
  if (level >= 2 && leadsATeam) out.push('team')
  if (level >= 3) out.push('everyone')
  return out
}

/**
 * What opens when nothing is asked: Everyone for whoever may see everyone,
 * My team for a lead, themselves otherwise.
 */
export function resolveScope(asked: string | undefined, level: number, leadsATeam = true): Scope {
  const allowed = scopesFor(level, leadsATeam)
  if (asked && (allowed as string[]).includes(asked)) return asked as Scope
  if (allowed.includes('everyone')) return 'everyone'
  return allowed.includes('team') ? 'team' : 'me'
}

/**
 * Whose work the Report reads, from the scope and the filters in the URL.
 *
 * Me, at any level: themselves.
 *
 * My team, at any level: the teams they lead, taken together. A team picked in
 * the filters counts only if they lead it, and a person only if they are on
 * one of those teams; anything else in the URL is dropped rather than obeyed.
 *
 * Everyone (level 3, "See everyone"): a person or a team picked in the filters
 * is that person or team; otherwise everyone.
 *
 * `team` and `person` come back as the filters actually applied, so the
 * controls show what the page obeyed, not what was typed.
 */
export function reportFilter(o: {
  scope: Scope
  level: number
  meId: string | null
  team?: string | null
  person?: string | null
  /** The teams this person leads. */
  led: readonly string[]
  /** Everyone on those teams. */
  ledMembers: ReadonlySet<string>
}): { filter: PeopleFilter; team: string | null; person: string | null } {
  // Themselves. A login linked to nobody reads nobody: a null person would be
  // no filter at all, which is everyone.
  const me = { filter: o.meId ? { personId: o.meId } : { personIds: [] }, team: null, person: null }
  if (o.scope === 'me' || o.level < 2) return me

  if (o.scope === 'everyone' && o.level >= 3) {
    if (o.person) return { filter: { personId: o.person }, team: o.team ?? null, person: o.person }
    if (o.team) return { filter: { teamId: o.team }, team: o.team, person: null }
    return { filter: {}, team: null, person: null }
  }

  if (!o.led.length) return me
  const team = o.team && o.led.includes(o.team) ? o.team : null
  const person = o.person && o.ledMembers.has(o.person) ? o.person : null
  if (person) return { filter: { personId: person }, team, person }
  return { filter: { teamIds: team ? [team] : [...o.led] }, team, person: null }
}

/**
 * What the page is showing, in words, for the screen, the printout, the PDF
 * footer and the file name. A filter is named; without one, the scope.
 */
export function viewLabel(scope: Scope, teamName?: string | null, personName?: string | null): string {
  if (personName) return personName
  if (teamName) return `${teamName} team`
  return SCOPE_LABEL[scope]
}

export const PERIODS = [30, 90] as const
export type Period = (typeof PERIODS)[number]

export function resolvePeriod(asked: string | undefined): Period {
  const n = Number(asked)
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 90
}

export const PERIOD_LABEL: Record<Period, string> = {
  30: 'Last 30 days',
  90: 'Last 90 days',
}

/**
 * Columns on the weekly delivery chart.
 *
 * 12 on the 90-day period and 5 on the 30-day one, which is what the handoff
 * draws. Not days / 7: 90/7 is 12.86 and 30/7 is 4.29, and a part-week column
 * on the end always looks like a collapse in delivery.
 */
export function weekColumns(period: Period): number {
  return period === 90 ? 12 : 5
}

/** Everything the Report keeps in the URL. */
export type ReportState = {
  tab: string
  scope: Scope
  period: Period
  team?: string
  person?: string
}

/**
 * The one place a Report URL is built.
 *
 * Every control has to carry the rest of the state, or clicking one silently
 * resets the others. The tab bar had exactly that defect while the scope and
 * period switches did not, which is the failure mode of writing the same rule
 * twice: the copy that gets tested is the one somebody happened to look at.
 *
 * Defaults are left out of the query so the URL stays short enough to paste,
 * except the scope: its default depends on who opens the link (Everyone for
 * whoever may see everyone, My team for a lead), so it is always written.
 */
export function reportHref(base: string, state: ReportState, change: Partial<ReportState> = {}): string {
  const next = { ...state, ...change }
  const q = new URLSearchParams()
  if (next.tab !== 'overview') q.set('tab', next.tab)
  q.set('scope', next.scope)
  if (next.period !== 90) q.set('period', String(next.period))
  if (next.team) q.set('team', next.team)
  if (next.person) q.set('person', next.person)
  const s = q.toString()
  return s ? `${base}?${s}` : base
}
