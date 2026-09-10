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
      const navyAt = back.lastIndexOf('bg-tn-primary')
      const whiteAt = back.lastIndexOf('bg-white')
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
