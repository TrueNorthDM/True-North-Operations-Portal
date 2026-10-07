/**
 * The one access rule (7 October 2026). Every page guard, the navigation, the
 * Access page's preview, "Check a person" and the impact shown before saving
 * ask this function, so they can never disagree.
 *
 *   1. Super Admin                          -> yes ("Super Admin")
 *   2. an exception for the person and item, still in date
 *                                           -> its answer ("Exception until ...")
 *   3. an item unknown to the catalogue, or Super Admin only
 *                                           -> no
 *   4. the parent page or tool must open    -> else no ("Needs <parent>")
 *   5. always-on items                      -> yes ("Everyone")
 *   6. the level's tick (saved rule, else the catalogue's default)
 *                                           -> else no ("<Level> is off")
 *   7. a tool needs one of the person's teams on its list, whole team or
 *      Leads only, unless the list is "every team"
 *                                           -> else no ("Not on its team list")
 *
 * Every answer carries its reasons, which the Access page shows. Pure: rules
 * and the person come in as data, so the same function runs on saved rules
 * (the portal) and on saved plus unsaved ones (the preview and the impact).
 */

import { CHILDREN, ITEM, LEVEL_LABEL, type AccessLevel, type CatalogueItem, type ConfigurableLevel } from './catalogue'

export type Audience = 'team' | 'lead'

/** Which teams may use a tool. `every`: any team. Otherwise only the listed ones. */
export interface ToolScope { every: boolean; teams: ReadonlyMap<string, Audience> }

export interface Rules {
  /** "level|item" -> ticked. Missing rows fall back to the catalogue's default. */
  levels: ReadonlyMap<string, boolean>
  /** Tool item key -> its team list. Missing: no team yet (closed to all but Super Admin). */
  tools: ReadonlyMap<string, ToolScope>
}

export interface Exception { key: string; effect: 'grant' | 'deny'; until: string | null }

export interface Subject {
  level: AccessLevel
  /** team id -> leads that team */
  teams: ReadonlyMap<string, boolean>
  exceptions?: readonly Exception[]
}

export type ReasonKind = 'super' | 'exception' | 'unknown' | 'super-only' | 'parent' | 'always' | 'level' | 'level-off' | 'team' | 'no-team'
export interface Reason { kind: ReasonKind; text: string }
export interface Decision { ok: boolean; reasons: Reason[] }

export const ruleKey = (level: ConfigurableLevel, key: string) => `${level}|${key}`

/** The level's tick for an item: the saved row, else the catalogue default. */
export function ticked(rules: Rules, level: ConfigurableLevel, item: CatalogueItem): boolean {
  const saved = rules.levels.get(ruleKey(level, item.key))
  return saved ?? item.defaults?.[level] ?? false
}

/** The person's level: Super Admin and Admin are given; Team Leader follows being Lead of any team. */
export function levelOf(given: string | null | undefined, leadsAnyTeam: boolean): AccessLevel {
  if (given === 'super_admin' || given === 'admin') return given
  return leadsAnyTeam ? 'team_leader' : 'user'
}

export interface DecideOptions {
  /** Today in the company calendar, YYYY-MM-DD, for exception end dates. */
  today: string
  /** team id -> name, for the reasons. */
  teamNames?: ReadonlyMap<string, string>
  /** Memo across one person's many questions. */
  memo?: Map<string, Decision>
}

export function decide(subject: Subject, key: string, rules: Rules, opts: DecideOptions): Decision {
  const memo = opts.memo
  const hit = memo?.get(key)
  if (hit) return hit
  const out = decideOnce(subject, key, rules, opts)
  memo?.set(key, out)
  return out
}

function decideOnce(subject: Subject, key: string, rules: Rules, opts: DecideOptions): Decision {
  const item = ITEM.get(key)
  if (subject.level === 'super_admin') return { ok: true, reasons: [{ kind: 'super', text: 'Super Admin' }] }

  const ex = subject.exceptions?.find(e => e.key === key && (!e.until || e.until >= opts.today))
  if (ex) return { ok: ex.effect === 'grant', reasons: [{ kind: 'exception', text: ex.until ? `Exception until ${ex.until}` : 'Exception' }] }

  if (!item) return { ok: false, reasons: [{ kind: 'unknown', text: 'Not in the catalogue' }] }
  if (item.superOnly) return { ok: false, reasons: [{ kind: 'super-only', text: 'Super Admin only' }] }

  if (item.kind === 'module') {
    // A module opens when anything inside it does.
    const ok = (CHILDREN.get(key) ?? []).some(i => decide(subject, i.key, rules, opts).ok)
    return { ok, reasons: [] }
  }

  const parent = item.parent ? ITEM.get(item.parent) : undefined
  if (parent && parent.kind !== 'module' && !decide(subject, parent.key, rules, opts).ok) {
    return { ok: false, reasons: [{ kind: 'parent', text: `Needs ${parent.label}` }] }
  }

  if (item.always) return { ok: true, reasons: [{ kind: 'always', text: 'Everyone' }] }

  const level = subject.level as ConfigurableLevel
  if (!ticked(rules, level, item)) return { ok: false, reasons: [{ kind: 'level-off', text: `${LEVEL_LABEL[level]} is off` }] }

  if (item.kind === 'tool') {
    const scope = rules.tools.get(key)
    if (scope?.every) return { ok: true, reasons: [{ kind: 'level', text: LEVEL_LABEL[level] }, { kind: 'team', text: 'Every team' }] }
    const entries = scope ? [...scope.teams] : []
    if (!entries.length) return { ok: false, reasons: [{ kind: 'no-team', text: 'No team may use it yet' }] }
    const match = entries.find(([team, aud]) => subject.teams.has(team) && (aud === 'team' || subject.teams.get(team)))
    if (!match) return { ok: false, reasons: [{ kind: 'no-team', text: 'Not on its team list' }] }
    const name = opts.teamNames?.get(match[0]) ?? 'Their team'
    return { ok: true, reasons: [{ kind: 'level', text: LEVEL_LABEL[level] }, { kind: 'team', text: `${name}, ${match[1] === 'lead' ? 'Leads only' : 'whole team'}` }] }
  }

  return { ok: true, reasons: [{ kind: 'level', text: LEVEL_LABEL[level] }] }
}

/** Every item key the person opens. */
export function allowedKeys(subject: Subject, rules: Rules, opts: DecideOptions): Set<string> {
  const memo = opts.memo ?? new Map<string, Decision>()
  const out = new Set<string>()
  for (const key of ITEM.keys()) if (decide(subject, key, rules, { ...opts, memo }).ok) out.add(key)
  return out
}

/** Rules with unsaved changes laid over the saved ones (the preview and the impact). */
export function overlay(rules: Rules, levels: ReadonlyMap<string, boolean>, tools: ReadonlyMap<string, ToolScope>): Rules {
  return { levels: new Map([...rules.levels, ...levels]), tools: new Map([...rules.tools, ...tools]) }
}

export interface ImpactRow { personId: string; gained: string[]; lost: string[] }

/** Who gains and who loses what, between two sets of rules, over everyone given. */
export function impact(
  people: readonly ({ id: string } & Subject)[],
  before: Rules,
  after: Rules,
  opts: Omit<DecideOptions, 'memo'>,
): ImpactRow[] {
  const out: ImpactRow[] = []
  for (const p of people) {
    const a = allowedKeys(p, before, { ...opts, memo: new Map() })
    const b = allowedKeys(p, after, { ...opts, memo: new Map() })
    const gained = [...b].filter(k => !a.has(k) && ITEM.get(k)?.kind !== 'module')
    const lost = [...a].filter(k => !b.has(k) && ITEM.get(k)?.kind !== 'module')
    if (gained.length || lost.length) out.push({ personId: p.id, gained, lost })
  }
  return out
}
