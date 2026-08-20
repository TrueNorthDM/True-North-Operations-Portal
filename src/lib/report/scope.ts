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

export type Scope = 'me' | 'team' | 'everyone'

export const SCOPE_LABEL: Record<Scope, string> = {
  me: 'Me',
  team: 'My team',
  everyone: 'Everyone',
}

/**
 * Which scopes a directory level may ask for.
 *
 * Level 1 gets one option, and gets it as a control with a single segment
 * rather than as a disabled button: permission shows up as a shorter control,
 * never as something greyed out that hints at a page they are missing.
 */
export function scopesFor(level: number): Scope[] {
  if (level >= 3) return ['me', 'team', 'everyone']
  if (level === 2) return ['me', 'team']
  return ['me']
}

/** My team by default, because the page is a lead's page. Level 1 has no such default. */
export function resolveScope(asked: string | undefined, level: number): Scope {
  const allowed = scopesFor(level)
  if (asked && (allowed as string[]).includes(asked)) return asked as Scope
  return allowed.includes('team') ? 'team' : 'me'
}

/**
 * The scope the page is actually showing, once a filter is in play.
 *
 * Picking a team or a person forces Everyone. A lead whose scope is their own
 * team, crossed with a different team, returns nothing at all: an empty table
 * that looks like a broken filter rather than like two conditions that cannot
 * both hold. Forcing the scope is the honest resolution, and the switch has
 * to show it, or the screen states one scope and obeys another.
 */
export function effectiveScope(scope: Scope, team?: string, person?: string): Scope {
  return team || person ? 'everyone' : scope
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
 * Defaults are left out of the query so a plain /report is the plain view and
 * the URL stays short enough to paste.
 */
export function reportHref(base: string, state: ReportState, change: Partial<ReportState> = {}): string {
  const next = { ...state, ...change }
  const q = new URLSearchParams()
  if (next.tab !== 'overview') q.set('tab', next.tab)
  if (next.scope !== 'team') q.set('scope', next.scope)
  if (next.period !== 90) q.set('period', String(next.period))
  if (next.team) q.set('team', next.team)
  if (next.person) q.set('person', next.person)
  const s = q.toString()
  return s ? `${base}?${s}` : base
}
