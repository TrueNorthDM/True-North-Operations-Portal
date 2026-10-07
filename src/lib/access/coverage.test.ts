import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ALIAS, CATALOGUE } from './catalogue'

/**
 * The access audit of 7 October 2026, kept as tests: every page, file route and
 * server action asks the access rule (or is listed below with the reason it
 * needs none), and every item on Admin > Access levels is asked for somewhere,
 * so no tick there is decoration. A new page, route or action that forgets its
 * check fails here before it ships.
 *
 * These read the source as text. They prove a check is present, not that it is
 * the right one; decide.test.ts and the pages' own tests cover that.
 */

const SRC = join(__dirname, '..', '..')
const files: string[] = []
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) files.push(p)
  }
}
walk(SRC)
const rel = (p: string) => relative(SRC, p)
const read = (p: string) => readFileSync(p, 'utf8')

/** What counts as asking the access rule. */
const GUARD = /requireSurface\(|loadAccess\(|allowedTo\(|isSuperAdmin\(|requirePrivileged\(|requireAllowed\(|requireAdmin\(/

describe('every page asks the access rule', () => {
  // Pages anyone signed in (or nobody) may open, and why.
  const OPEN: Record<string, string> = {
    'app/(app)/history/page.tsx': 'History is open to everyone (always)',
    'app/auth/confirm/page.tsx': 'sign-in flow',
    'app/auth/two-step/page.tsx': 'sign-in flow',
    'app/auth/two-step/setup/page.tsx': 'sign-in flow',
    'app/login/page.tsx': 'sign-in flow',
    'app/maintenance/page.tsx': 'the maintenance notice',
  }
  const redirectsOnly = (s: string) => /export default function \w+\(\)\s*\{\s*redirect\(/.test(s)

  it('has a guard, redirects only, or is listed as open', () => {
    const missing = files
      .filter(f => f.endsWith('page.tsx') && rel(f).startsWith('app/') && !rel(f).startsWith('app/design-check/'))
      .filter(f => { const s = read(f); return !GUARD.test(s) && !redirectsOnly(s) && !(rel(f) in OPEN) })
      .map(rel)
    expect(missing).toEqual([])
  })

  it('closes every design check in production', () => {
    expect(read(join(SRC, 'app/design-check/layout.tsx'))).toMatch(/NODE_ENV === 'production'\) notFound\(\)/)
  })
})

describe('every file route asks the access rule', () => {
  const OPEN: Record<string, string> = {
    'app/auth/callback/route.ts': 'sign-in flow',
    'app/auth/no-access/route.ts': 'signs out a refused login',
    'app/api/monday/webhook/[secret]/route.ts': 'Monday, checked by the secret in its address',
    'app/design-check/project-history-export/csv/route.ts': '404 in production',
  }
  it('has a guard, the cron secret, or is listed as open', () => {
    const missing = files
      .filter(f => f.endsWith('route.ts'))
      .filter(f => { const s = read(f); return !GUARD.test(s) && !/CRON_SECRET/.test(s) && !(rel(f) in OPEN) })
      .map(rel)
    expect(missing).toEqual([])
  })

  it('refuses a cron call when the secret is not set, instead of letting it in', () => {
    const open = files.filter(f => /app\/api\/cron\//.test(f) && f.endsWith('route.ts'))
      .filter(f => /if \(secret && request/.test(read(f))).map(rel)
    expect(open).toEqual([])
  })
})

describe('every server action asks the access rule', () => {
  // Actions about the caller's own record, and the sign-in flow: each finds
  // the signed-in person itself and touches nothing of anyone else's.
  const SELF: Record<string, string> = {
    'app/(app)/access-actions.ts': 'logs the caller\'s own visit',
    'app/(app)/notifications/actions.ts': 'the caller\'s own notifications and preferences',
    'app/(app)/profile/profile-actions.ts': 'the caller\'s own profile',
    'app/(app)/settings/actions.ts': 'the caller\'s own settings',
    'app/auth/actions.ts': 'sign-in flow',
    'app/auth/two-step-actions.ts': 'sign-in flow',
  }
  // Helpers inside a file that themselves ask the rule (guard(), actor(), ...).
  const guardedHelpers = (s: string): Set<string> => {
    const fns = [...s.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)].map(m => ({ name: m[1], at: m.index! }))
    const body = (i: number) => s.slice(fns[i].at, i + 1 < fns.length ? fns[i + 1].at : undefined)
    const out = new Set<string>()
    for (let pass = 0; pass < 3; pass++) {
      fns.forEach((f, i) => {
        const b = body(i)
        if (GUARD.test(b) || [...out].some(h => new RegExp(`\\b${h}\\(`).test(b))) out.add(f.name)
      })
    }
    // The access rule itself, for actions that decide with it directly.
    fns.forEach((f, i) => { if (/\bdecide\(|\bpriorityRights\(/.test(body(i))) out.add(f.name) })
    return out
  }

  it('checks access in each exported action, unless it only touches the caller\'s own record', () => {
    const missing: string[] = []
    for (const f of files) {
      const s = read(f)
      if (!/^\s*['"]use server['"]/.test(s) || rel(f) in SELF) continue
      const ok = guardedHelpers(s)
      for (const m of s.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)) if (!ok.has(m[1])) missing.push(`${rel(f)}: ${m[1]}`)
    }
    expect(missing).toEqual([])
  })
})

describe('every item on Access levels is asked for', () => {
  // The access page, its preview and the rail list items; they do not enforce them.
  const LISTS = /lib\/access\/(catalogue|nav|tools|simulate)\.ts$|components\/access\/|app\/design-check\//
  const code = files.filter(f => !LISTS.test(rel(f))).map(read).join('\n')
  const aliased = new Map(Object.entries(ALIAS).map(([old, now]) => [now, old]))

  it('finds every configurable item in a check somewhere', () => {
    const unasked = CATALOGUE
      .filter(i => i.kind !== 'module' && !i.always)
      .filter(i => !code.includes(`'${i.key}'`) && !(aliased.has(i.key) && code.includes(`'${aliased.get(i.key)}'`)))
      .map(i => i.key)
    expect(unasked).toEqual([])
  })
})
