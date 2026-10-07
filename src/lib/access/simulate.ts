/**
 * The access rule without a database: a level, some teams and some rules, for
 * the tests and the design checks. Pure.
 */

import { ALIAS, type AccessLevel } from './catalogue'
import { allowedKeys, type Rules } from './decide'

/** Nothing configured: every tick at the catalogue's starting answer, no tool team lists. */
export const NO_RULES: Rules = { levels: new Map(), tools: new Map() }

/** Rules where these tools are open to every team (the level ticks still apply). */
export function rulesWithTools(toolKeys: Iterable<string>, base: Rules = NO_RULES): Rules {
  const tools = new Map(base.tools)
  for (const k of toolKeys) tools.set(k, { every: true, teams: new Map() })
  return { levels: base.levels, tools }
}

/** `can` for a level, as loadAccess would answer it. */
export function canAs(level: AccessLevel, opts: { teams?: [string, boolean][]; rules?: Rules; today?: string } = {}): (key: string) => boolean {
  const open = allowedKeys({ level, teams: new Map(opts.teams ?? []) }, opts.rules ?? NO_RULES, { today: opts.today ?? '2026-10-07' })
  return (key: string) => open.has(ALIAS[key] ?? key)
}
