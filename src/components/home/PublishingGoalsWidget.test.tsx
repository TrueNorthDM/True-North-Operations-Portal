import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  PublishingGoalsWidget, updatedLabel, scoreColour, langCode, cycleSpan, englishChart, GREEN, AMBER, RED,
} from './PublishingGoalsWidget'
import type { PublishingBoardWeeks, PublishingWeek } from '@/lib/boards/publishing-weeks'

const MONDAYS = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19']

/** A weekly board from [language, target, five weeks done], English first, as the prototype's sample. */
function board(boardId: string, name: string, langs: [string, number, number[]][]): PublishingBoardWeeks {
  const weeks: PublishingWeek[] = MONDAYS.map((start, i) => {
    const rows = langs.map(([lang, target, done]) => ({ lang, done: done[i], target }))
    const en = rows.find(l => l.lang === 'English')
    return {
      start, label: start, untargeted: 0, langs: rows,
      done: rows.reduce((s, l) => s + l.done, 0),
      target: rows.reduce((s, l) => s + l.target, 0),
      en: en ? { done: en.done, target: en.target } : null,
    }
  })
  const langHits = Object.fromEntries(langs.map(([lang, t, done]) => [lang, done.filter(d => d >= t).length]))
  return {
    boardId, name, cycleWeeks: 1, weeks, langHits,
    perPeriod: weeks[4].target, enPerPeriod: weeks[4].en?.target ?? 0,
    hits: weeks.filter(w => w.done >= w.target).length,
    enHits: weeks.filter(w => w.en && w.en.done >= w.en.target).length,
    firstCycleEnds: null, firstCycle: null,
  }
}

const AAAF = board('462251934', 'AAAF', [['English', 2, [2, 1, 0, 2, 2]], ['Spanish', 3, [3, 3, 1, 3, 3]], ['Portuguese', 2, [2, 2, 1, 2, 2]], ['Swahili', 2, [2, 2, 0, 2, 2]], ['Hindi', 2, [2, 2, 1, 2, 1]]])
const HFA = board('hfa', 'HFA', [['English', 5, [4, 5, 2, 6, 5]], ['French', 2, [2, 2, 1, 3, 2]], ['Swahili', 2, [1, 2, 0, 3, 1]], ['Portuguese', 1, [1, 1, 0, 1, 1]]])

/** WCAG relative luminance contrast against white. */
function contrastOnWhite(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return 1.05 / (l + 0.05)
}

describe('PublishingGoalsWidget (audit, 10 October 2026)', () => {
  it('says the read failed instead of disappearing when data is null', () => {
    render(<PublishingGoalsWidget data={null} linked />)
    expect(screen.getByRole('heading', { level: 2, name: 'Publishing goals' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Publishing goals could not be read. Try again in a moment.')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('gives the card link a short name of its own, only when linked', () => {
    const { unmount } = render(<PublishingGoalsWidget data={{ boards: [AAAF], updatedAt: null }} linked />)
    expect(screen.getByRole('link', { name: 'Publishing goals, open the dashboard' })).toHaveAttribute('href', '/ops/publishing')
    unmount()
    render(<PublishingGoalsWidget data={{ boards: [AAAF], updatedAt: null }} />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows when the data was last read, in New York time, in the footer', () => {
    render(<PublishingGoalsWidget data={{ boards: [AAAF], updatedAt: '2026-10-15T06:04:00Z' }} />)
    expect(screen.getByText('Updated Oct 15, 2:04 AM · dashed lines are the targets · pills count weeks on target')).toBeInTheDocument()
  })

  it('formats the helpers plainly', () => {
    expect(updatedLabel(null)).toBeNull()
    expect(updatedLabel('not a date')).toBeNull()
    // 2:30 AM in London is still the 8th in New York.
    expect(updatedLabel('2026-10-09T02:30:00Z')).toBe('Updated Oct 8, 10:30 PM')
    expect(langCode('Spanish')).toBe('ES')
    expect(langCode('Swahili')).toBe('SW')
    expect(langCode('Hindi')).toBe('HI')
    expect(cycleSpan('2026-09-28')).toBe('Sep 28-Oct 11')
    expect(cycleSpan('2026-08-17')).toBe('Aug 17-30')
  })

  it('colours its figures in shades that reach 4.5:1 on white', () => {
    expect(contrastOnWhite(GREEN)).toBeGreaterThanOrEqual(4.5)
    expect(contrastOnWhite(AMBER)).toBeGreaterThanOrEqual(4.5)
    expect(contrastOnWhite(RED)).toBeGreaterThanOrEqual(4.5)
  })
})

// The Home redesign (owner, 25 October 2026).
describe('PublishingGoalsWidget, five weeks and every language', () => {
  it('heads the card "Last 5 weeks" and scores each client', () => {
    render(<PublishingGoalsWidget data={{ boards: [AAAF, HFA], updatedAt: null }} />)
    expect(screen.getByText('Last 5 weeks')).toBeInTheDocument()
    // AAAF: English met 3 of 5 weeks, every language 2 of 5.
    const enScore = screen.getAllByText('3/5', { selector: 'b' })[0]
    expect(enScore.parentElement).toHaveTextContent('3/5 weeks English on target · 2/5 all languages')
    expect(enScore).toHaveStyle({ color: AMBER })
  })

  it('draws English as a chart, a point and a percentage per week', () => {
    render(<PublishingGoalsWidget data={{ boards: [AAAF], updatedAt: null }} />)
    expect(screen.getByText('2 a week')).toBeInTheDocument()
    expect(screen.getAllByText('100%')).toHaveLength(3)
    expect(screen.getByText('50%')).toHaveStyle({ color: AMBER })
    expect(screen.getByText('0%')).toHaveStyle({ color: RED })
    for (const w of ['Sep 21', 'Sep 28', 'Oct 5', 'Oct 12', 'Oct 19']) expect(screen.getByText(w)).toBeInTheDocument()
  })

  it('places the chart on the prototype geometry', () => {
    const c = englishChart(AAAF.weeks)
    // 16 units in from each end of 330; 100% at 22 + 118 / 3 down the 150.
    expect(c.pts.map(p => p.x)).toEqual([16, 90.5, 165, 239.5, 314])
    expect(c.line100).toBeCloseTo(61.33, 2)
    expect(c.pts[2].y).toBe(140)   // 0% sits on the floor, 10 above the bottom
    // 150% and over are clamped to the top.
    const over = englishChart([{ ...AAAF.weeks[0], en: { done: 9, target: 2 } }])
    expect(over.pts[0].y).toBe(22)
    expect(over.pts[0].value).toBe('450%')
  })

  it('gives every other language a row: code, target, five cells and a pill', () => {
    render(<PublishingGoalsWidget data={{ boards: [AAAF], updatedAt: null }} />)
    for (const code of ['ES', 'PT', 'SW', 'HI']) expect(screen.getByText(code)).toBeInTheDocument()
    expect(screen.queryByText('EN')).toBeNull()
    expect(screen.getByText('3/wk')).toBeInTheDocument()
    // Spanish: met, met, part, met, met.
    expect(screen.getAllByText('3/3')).toHaveLength(4)
    expect(screen.getByText('1/3')).toHaveStyle({ background: '#fbe9cf', color: AMBER })
    // Swahili's empty week is red.
    expect(screen.getByText('0/2')).toHaveStyle({ color: RED })
    // Pills: Spanish, Portuguese and Swahili 4 of 5, Hindi 3 of 5.
    expect(screen.getAllByText('4/5')).toHaveLength(3)
  })

  it('says so when a board has no weekly target', () => {
    render(<PublishingGoalsWidget data={{ boards: [{ ...AAAF, perPeriod: 0 }], updatedAt: null }} />)
    expect(screen.getByText('No weekly target set for this board.')).toBeInTheDocument()
  })

  it('colours a header score green when every row but one met it', () => {
    expect(scoreColour(4, 5)).toBe(GREEN)
    expect(scoreColour(3, 5)).toBe(AMBER)
    expect(scoreColour(0, 1)).toBe(AMBER)
    expect(scoreColour(1, 1)).toBe(GREEN)
  })
})

// A board counted in two-week cycles (Bessemeters, 15 October 2026).
describe('PublishingGoalsWidget, a two-week board', () => {
  const cycle = (start: string, done: number, target = 2): PublishingWeek =>
    ({ start, label: start, done, target, untargeted: 0, en: { done, target }, langs: [{ lang: 'English', done, target }] })
  const BM: PublishingBoardWeeks = {
    boardId: '1764094550', name: 'Bessemeters', cycleWeeks: 2, perPeriod: 2, enPerPeriod: 2,
    weeks: [cycle('2026-08-17', 2), cycle('2026-08-31', 1), cycle('2026-09-14', 2), cycle('2026-09-28', 2), cycle('2026-10-12', 3)],
    hits: 4, enHits: 4, langHits: { English: 4 }, firstCycleEnds: null, firstCycle: null,
  }

  it('shows five cycle cells under the weekly clients', () => {
    render(<PublishingGoalsWidget data={{ boards: [AAAF, HFA, BM], updatedAt: null }} />)
    expect(screen.getByText('English · every 2 weeks · 2 per cycle')).toBeInTheDocument()
    expect(screen.getByText('4/5', { selector: 'b' }).parentElement).toHaveTextContent('4/5 cycles on target')
    expect(screen.getByText('Sep 28-Oct 11')).toBeInTheDocument()
    expect(screen.getByText('Aug 31-Sep 13')).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toHaveStyle({ color: AMBER })
    expect(screen.getByText('3 of 2')).toHaveStyle({ color: GREEN })
  })

  it('shows the first cycle so far, and the day it ends, while none has ended', () => {
    const first = { ...BM, weeks: [], perPeriod: 0, enPerPeriod: 0, hits: 0, enHits: 0, langHits: {}, firstCycleEnds: '2026-10-25', firstCycle: { ...cycle('2026-10-12', 0, 1), label: 'Oct 12 to Oct 25' } }
    render(<PublishingGoalsWidget data={{ boards: [AAAF, HFA, first], updatedAt: null }} />)
    expect(screen.getByText('English · every 2 weeks · 1 per cycle')).toBeInTheDocument()
    expect(screen.getByText('First cycle, Oct 12 to 25')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 so far')).toBeInTheDocument()
    expect(screen.getByText('Ends Sun, Oct 25')).toBeInTheDocument()
    expect(screen.queryByText('No target set for this board.')).toBeNull()
  })
})
