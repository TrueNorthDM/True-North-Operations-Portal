import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRail, type ResolvedEntry } from './nav'
import { canAs, rulesWithTools } from './simulate'
import { TOOL_ITEMS, type AccessLevel } from './catalogue'

/**
 * Every place the rail offers opens for whoever is offered it (audit,
 * 8 October 2026): for each level, each row and each hub's landing page, read
 * the guard the page itself asks (requireSurface('x'), or a tool's
 * canTool('y')), and check the same answers let that level through. A rail
 * row that leads to a page that refuses, or a guard that drifted from the
 * rail, fails here.
 */

const APP = join(__dirname, '..', '..', 'app', '(app)')

/** The page file an address renders, or null for a route this test cannot see. */
function pageFile(href: string): string | null {
  const path = href.split(/[?#]/)[0].replace(/^\//, '')
  const f = join(APP, path, 'page.tsx')
  return existsSync(f) ? f : null
}

/** The keys a page's own guard asks, in order. */
function guardsOf(file: string): { surface: string[]; tool: string[] } {
  const s = readFileSync(file, 'utf8')
  return {
    surface: [...s.matchAll(/requireSurface\('([^']+)'\)/g)].map(m => m[1]),
    tool: [...s.matchAll(/canTool\('([^']+)'\)/g)].map(m => m[1]),
  }
}

const hrefsOf = (rail: ResolvedEntry[]) => rail.flatMap(e =>
  e.kind === 'page' ? [e.item.href]
    : e.kind === 'hub' ? [...e.groups.flatMap(g => g.items.map(i => i.href)), ...(e.landing ? [e.landing] : [])]
    : [])

const LEVELS: AccessLevel[] = ['super_admin', 'admin', 'team_leader', 'user']
// Every tool open to every team, so the Tools rows are offered too.
const rules = rulesWithTools(TOOL_ITEMS.map(t => t.key))

describe('every place the rail offers opens for whoever sees it', () => {
  for (const level of LEVELS) {
    it(`for ${level}`, () => {
      const can = canAs(level, { teams: [['t1', level === 'team_leader']], rules })
      const rail = buildRail({ can, canTool: can })
      const refused: string[] = []
      for (const href of hrefsOf(rail)) {
        const file = pageFile(href)
        if (!file) continue
        const g = guardsOf(file)
        for (const k of g.surface) if (!can(k)) refused.push(`${href} needs ${k}`)
        for (const k of g.tool) if (!can(k)) refused.push(`${href} needs the tool ${k}`)
      }
      expect(refused).toEqual([])
    })
  }

  it('reads real guards (the test would pass on nothing otherwise)', () => {
    const can = canAs('super_admin', { rules })
    const seen = hrefsOf(buildRail({ can, canTool: can })).map(pageFile).filter(Boolean)
    expect(seen.length).toBeGreaterThan(15)
    expect(seen.some(f => guardsOf(f!).surface.length > 0)).toBe(true)
  })
})
