import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { NAV_LABEL } from './labels'
import { buildRail } from '@/lib/access/nav'

/**
 * The rule this file exists to keep: no page spells a breadcrumb by hand.
 *
 * Seventeen pages used to, and they disagreed. The rail said "Tools &
 * Dashboards" while two reports under it said "Tools"; the home page was
 * "Home" on four pages and "Dashboard" on twelve; the i7 guide claimed
 * Settings as its parent, which is neither where it lives nor how anybody
 * reaches it. Every one of those was a copy of a trail from some other page.
 *
 * A reviewer will not catch the eighteenth. This will.
 */

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...tsxFiles(p))
    else if (e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** The separator that gives a hand-rolled trail away: a lone "/" in its own span. */
const SEPARATOR = /<span[^>]*>\s*\/\s*<\/span>/

describe('breadcrumbs', () => {
  it('are drawn by the Breadcrumb component and nowhere else', () => {
    const offenders = tsxFiles('src')
      .filter(f => !f.endsWith(join('ui', 'Breadcrumb.tsx')))
      .filter(f => SEPARATOR.test(readFileSync(f, 'utf8')))

    expect(offenders, `hand-written breadcrumb in:\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('name every place a trail can pass through', () => {
    // A parent is reached by href, so a missing entry is a crash rather than a
    // wrong word. Kept as a test anyway: it says what the table is for.
    for (const [href, label] of Object.entries(NAV_LABEL)) {
      expect(href.startsWith('/'), `${href} is not a route`).toBe(true)
      expect(label.trim().length, `${href} has no name`).toBeGreaterThan(0)
    }
  })

  // A page that is one of the named places must say so with `self`, not repeat
  // the name. The Directory did repeat it, and said "People" while the rail
  // said "People, Teams and Permissions".
  it('leave no page repeating a name the table already holds', () => {
    const names = new Set<string>(Object.values(NAV_LABEL))
    const offenders: string[] = []
    for (const f of tsxFiles('src')) {
      for (const [, quoted] of readFileSync(f, 'utf8').matchAll(/<Breadcrumb[^>]*?\snow="([^"]+)"/g)) {
        if (names.has(quoted)) offenders.push(`${f}: now="${quoted}" should be self=`)
      }
    }
    expect(offenders, offenders.join('\n  ')).toEqual([])
  })

  // The rail and the trail are the two places a person reads a name. They came
  // from different lists and drifted, so the rail reads this table: a plain
  // rail page takes its name from here by construction (lib/access/nav.ts), and
  // a panel row that is one of the named places must say the same name.
  it('leave the rail no name of its own to disagree with', () => {
    const rail = buildRail({ can: () => true, canTool: () => true, level: 3 })
    const named = new Map<string, string>(Object.entries(NAV_LABEL))
    const items = rail.flatMap(e => (e.kind === 'page' ? [e.item] : e.kind === 'hub' ? e.groups.flatMap(g => g.items) : []))
    expect(items.length, 'no rail items found, this test has stopped reading the rail').toBeGreaterThan(5)
    for (const e of rail) {
      if (e.kind === 'page') expect(e.item.label, e.item.href).toBe(NAV_LABEL[e.item.href as keyof typeof NAV_LABEL])
    }
    for (const i of items) {
      // "Hours" under My Hours is the page's short name inside its own panel.
      if (named.has(i.href) && i.key !== 'my-hours' && i.key !== 'clocky-hours') expect(i.label, i.href).toBe(named.get(i.href))
    }
  })
})
