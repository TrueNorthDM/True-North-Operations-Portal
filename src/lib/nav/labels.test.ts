import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { NAV_LABEL } from './labels'

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

  // The rail and the trail are the two places a person reads a name. They came
  // from different lists and drifted, so the rail reads this table now. If a
  // name is ever typed back into the rail as a literal, this catches it.
  it('leave the rail no name of its own to disagree with', () => {
    const sidebar = readFileSync(join('src', 'components', 'Sidebar.tsx'), 'utf8')
    const items = [...sidebar.matchAll(/href: '([^']+)',\n\s*label: ([^,]+),/g)]

    expect(items.length, 'no rail items found, this test has stopped reading the rail').toBeGreaterThan(5)
    for (const [, href, label] of items) {
      expect(label, `the rail names ${href} itself instead of reading the table`)
        .toBe(`NAV_LABEL['${href}']`)
    }
  })
})
