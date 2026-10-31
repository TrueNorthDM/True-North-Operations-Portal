/**
 * The button rule, checked against the source rather than trusted.
 *
 *   navy button  -> white words, gold symbol
 *   white button -> navy words,  green symbol
 *
 * This reads the .tsx files the way the sweep that introduced the rule did.
 * That is deliberate: the rule was applied by hand across nine files, and a
 * rule applied by hand is a rule that drifts the next time somebody adds a
 * tenth. The breadcrumb table has the same kind of test and it caught a real
 * regression the same day it was written.
 *
 * It only judges a LABELLED ACTION BUTTON: a symbol with words after it. A
 * dropdown's chevron, a dialog's close cross, a search field's magnifier and an
 * icon sitting in a coloured chip are not button symbols and are left alone.
 * The Export menu is the reference: gold download symbol, white chevron.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { BTN } from './buttons'
import { join } from 'node:path'

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) tsxFiles(p, out)
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/**
 * Deliberate exceptions, each with the reason it is not an action button.
 *
 * Written out rather than quietly skipped: every one of these was a judgment
 * call, and the next person deserves the reasoning rather than a silent gap.
 * Adding to this list should feel like a decision, because it is one.
 */
const ALLOWED: { file: string; label: string; why: string }[] = [
  {
    file: 'PersonModal.tsx', label: 'Remove',
    why: 'Destructive. The symbol matches the red words, not the button palette.',
  },
  {
    file: 'MyWork.tsx', label: 'Board',
    why: 'Segmented control. currentColor is correct: the symbol must follow the selected state.',
  },
  { file: 'MyWork.tsx', label: 'List', why: 'The other half of the same segmented control.' },
  {
    file: 'UserMenu.tsx', label: 'My profile',
    why: 'A row in a dropdown menu, with no button shell around it.',
  },
  {
    file: 'ActivityLog.tsx', label: 'Recent activity',
    why: 'A disclosure header for a section, not something you press to act.',
  },
  {
    file: 'AvatarEditor.tsx', label: 'Drag',
    why: 'A dashed drop zone. The symbol labels the area, it does not label an action.',
  },
  {
    file: 'design-check/my-work/page.tsx', label: 'My Work',
    why: 'The design check renders the real tabs, which are tabs and not buttons.',
  },
  { file: 'design-check/my-work/page.tsx', label: 'My Team', why: 'The other tab.' },
  { file: 'design-check/my-team/page.tsx', label: 'My Team', why: 'The same tabs, on the other check.' },
]

const excused = (file: string, label: string) =>
  ALLOWED.some(a => file.replace(/\\/g, '/').includes(a.file) && label.startsWith(a.label))

interface Offence { file: string; line: number; tone: string; colour: string; label: string }

function offences(): Offence[] {
  const found: Offence[] = []
  for (const file of tsxFiles('src')) {
    const t = readFileSync(file, 'utf8')
    for (const m of t.matchAll(/<svg[^>]*>[\s\S]*?<\/svg>/g)) {
      // A symbol followed by words is a labelled button. A symbol followed by
      // anything else is decoration and none of this test's business.
      const after = t.slice(m.index! + m[0].length, m.index! + m[0].length + 90)
      if (!/^\s*(<span[^>]*>|\{[^}]*\}\s*<span|[A-Z][a-z])/.test(after)) continue

      const back = t.slice(Math.max(0, m.index! - 1400), m.index!)
      // The shells now come from BTN (and North Time's aliases of it), so the
      // constant's name marks the tone as well as a literal class does.
      const lastOf = (re: RegExp) => Math.max(-1, ...[...back.matchAll(re)].map(x => x.index!))
      const navyAt = lastOf(/bg-tn-primary|BTN\.(navy|smallNavy)\b|BTN_[A-Z_]*NAVY\b/g)
      const whiteAt = lastOf(/bg-white|BTN\.(white|smallWhite)\b|BTN_[A-Z_]*WHITE\b/g)
      if (navyAt < 0 && whiteAt < 0) continue
      const tone = navyAt > whiteAt ? 'navy' : 'white'

      const tag = m[0].slice(0, m[0].indexOf('>') + 1)
      const colour = (/stroke="([^"]*)"/.exec(tag) ?? /fill="([^"]*)"/.exec(tag))?.[1]
      // An svg with no literal colour either uses the token or paints by class.
      if (!colour || colour === 'none') continue
      if (tag.includes('BTN_ICON')) continue

      const want = tone === 'navy' ? '#F2C40A' : '#1E9E6A'
      if (colour.toUpperCase() === want.toUpperCase()) continue

      const label = after.replace(/<[^>]*>/g, '').trim().slice(0, 24)
      if (excused(file, label)) continue

      found.push({
        file: file.replace('src/', ''),
        line: t.slice(0, m.index!).split('\n').length,
        tone,
        colour,
        label,
      })
    }
  }
  return found
}

describe('button symbols', () => {
  it('are gold on navy and green on white, everywhere', () => {
    const bad = offences()
    const report = bad
      .map(o => `${o.file}:${o.line} ${o.tone} button "${o.label}" draws its symbol ${o.colour}, wanted ${o.tone === 'navy' ? 'gold' : 'green'}`)
      .join('\n  ')
    expect(bad, report).toEqual([])
  })

  // The rule is only worth testing if the test can see a break. If the detector
  // stops matching anything at all, it would pass silently forever.
  it('can actually see the buttons it is judging', () => {
    const seen = tsxFiles('src')
      .map(f => readFileSync(f, 'utf8'))
      .join('')
      .match(/BTN_ICON\.(navy|white)/g) ?? []
    expect(seen.length).toBeGreaterThan(8)
  })
})

// The owner's set (31 October 2026): one source, so one look per kind.
describe('button shells', () => {
  it('write white words as #ffffff, which dark mode cannot remap', () => {
    for (const [kind, cls] of Object.entries(BTN)) {
      expect(cls, kind).not.toMatch(/(^|\s)text-white(\s|$)/)
    }
    for (const kind of ['navy', 'danger', 'smallNavy', 'smallDanger'] as const) {
      expect(BTN[kind], kind).toContain('text-[#ffffff]')
    }
  })

  it('share one shape per size', () => {
    for (const kind of ['navy', 'white', 'danger', 'whiteDanger'] as const) {
      expect(BTN[kind], kind).toContain('rounded-[10px]')
      expect(BTN[kind], kind).toContain('py-[11px]')
      expect(BTN[kind], kind).toContain('text-[13px]')
    }
    for (const kind of ['smallNavy', 'smallWhite', 'smallDanger', 'smallWhiteDanger'] as const) {
      expect(BTN[kind], kind).toContain('rounded-[9px]')
      expect(BTN[kind], kind).toContain('py-[7px]')
      expect(BTN[kind], kind).toContain('text-[12.5px]')
    }
  })

  // A full-size navy or red button drawn by hand is a copy that will drift.
  it('are not copied by hand outside buttons.ts', () => {
    const copies: string[] = []
    for (const file of tsxFiles('src')) {
      if (file.replace(/\\/g, '/').includes('design-check/')) continue
      const t = readFileSync(file, 'utf8')
      for (const m of t.matchAll(/['"`][^'"`]*['"`]/g)) {
        const s = m[0]
        if (/bg-(tn-primary|\[#c8323d\])/.test(s) && s.includes('py-[11px]') && /rounded-\[10px\]/.test(s)) {
          copies.push(`${file}:${t.slice(0, m.index!).split('\n').length}`)
        }
      }
    }
    expect(copies, copies.join('\n  ')).toEqual([])
  })
})
