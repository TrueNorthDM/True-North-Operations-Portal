import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublishingGoalsWidget, updatedLabel, otherText, showsEnglish, GREEN, AMBER } from './PublishingGoalsWidget'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'

const week = (start: string, done: number, target: number, untargeted = 0) => ({
  start, label: start.slice(5), done, target, untargeted, en: { done: 1, target: 2 },
})

const BOARD: PublishingBoardWeeks = {
  boardId: '462251934',
  name: 'AskAnAdventistFriend',
  cycleWeeks: 1,
  perPeriod: 11,
  enPerPeriod: 2,
  firstCycleEnds: null,
  weeks: [week('2026-09-14', 11, 11), week('2026-09-21', 9, 11, 2), week('2026-09-28', 12, 11, 1), week('2026-10-05', 4, 11)],
  hits: 2,
  enHits: 0,
}

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

  it('names the total "Targeted languages" and shows pages with no target beside it', () => {
    render(<PublishingGoalsWidget data={{ boards: [BOARD], updatedAt: null }} />)
    expect(screen.getByText('Targeted languages')).toBeInTheDocument()
    expect(screen.queryByText('All languages')).toBeNull()
    expect(screen.getByText('+2 other')).toBeInTheDocument()
    expect(screen.getByText('2 pages in languages with no target')).toBeInTheDocument()
    expect(screen.getByText('+1 other').parentElement).toHaveAttribute('title', '1 page in languages with no target')
    // Weeks with none show nothing extra.
    expect(screen.getAllByText(/\+\d other/)).toHaveLength(2)
  })

  it('gives the card link a short name of its own', () => {
    render(<PublishingGoalsWidget data={{ boards: [BOARD], updatedAt: null }} linked />)
    expect(screen.getByRole('link', { name: 'Publishing goals, open the dashboard' })).toBeInTheDocument()
  })

  it('shows when the data was last read, in New York time', () => {
    render(<PublishingGoalsWidget data={{ boards: [BOARD], updatedAt: '2026-10-09T19:05:00Z' }} />)
    expect(screen.getByText('Updated Oct 9, 3:05 PM')).toBeInTheDocument()
  })

  it('formats the helpers plainly', () => {
    expect(updatedLabel(null)).toBeNull()
    expect(updatedLabel('not a date')).toBeNull()
    // 2:30 AM in London is still the 8th in New York.
    expect(updatedLabel('2026-10-09T02:30:00Z')).toBe('Updated Oct 8, 10:30 PM')
    expect(otherText(1)).toBe('1 page in languages with no target')
  })

  it('colours its figures in shades that reach 4.5:1 on white', () => {
    expect(contrastOnWhite(GREEN)).toBeGreaterThanOrEqual(4.5)
    expect(contrastOnWhite(AMBER)).toBeGreaterThanOrEqual(4.5)
  })
})

// A board counted in two-week cycles (Bessemeters, 15 October 2026).
describe('PublishingGoalsWidget, a two-week board', () => {
  const cycle = (start: string, label: string, done: number) =>
    ({ start, label, done, target: 1, untargeted: 0, en: { done, target: 1 } })
  const BM: PublishingBoardWeeks = {
    boardId: '1764094550', name: 'Bessemeters', cycleWeeks: 2, perPeriod: 1, enPerPeriod: 1,
    weeks: [cycle('2026-10-12', 'Oct 12 to Oct 25', 1), cycle('2026-10-26', 'Oct 26 to Nov 8', 0)],
    hits: 1, enHits: 1, firstCycleEnds: null,
  }

  it('shows one row per cycle, "1 of 1", and no English column when English is the whole target', () => {
    render(<PublishingGoalsWidget data={{ boards: [BM], updatedAt: null }} />)
    expect(screen.getByText('Oct 12 to Oct 25')).toBeInTheDocument()
    expect(screen.getByText('Oct 26 to Nov 8')).toBeInTheDocument()
    expect(screen.getByText('1 of 1')).toBeInTheDocument()
    expect(screen.getByText('0 of 1')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()   // on target, of two rows
    expect(screen.getByText('every 2 weeks')).toBeInTheDocument()
    expect(screen.queryByText('English')).toBeNull()
    expect(screen.getByText('Last 4 weeks · last 2 cycles')).toBeInTheDocument()
    expect(showsEnglish(BM)).toBe(false)
    expect(showsEnglish(BOARD)).toBe(true)
  })

  it('says when the first cycle ends while none has', () => {
    render(<PublishingGoalsWidget data={{ boards: [{ ...BM, weeks: [], perPeriod: 0, enPerPeriod: 0, hits: 0, enHits: 0, firstCycleEnds: '2026-10-25' }], updatedAt: null }} />)
    expect(screen.getByText('First cycle ends Oct 25')).toBeInTheDocument()
    expect(screen.queryByText('No target set for this board.')).toBeNull()
  })

  it('sits beside a weekly board, which keeps its four weeks and English column', () => {
    render(<PublishingGoalsWidget data={{ boards: [BOARD, BM], updatedAt: null }} />)
    expect(screen.getByText('2/4')).toBeInTheDocument()
    expect(screen.getAllByText('English')).toHaveLength(1)
    expect(screen.getByText('11/11')).toBeInTheDocument()
  })
})
