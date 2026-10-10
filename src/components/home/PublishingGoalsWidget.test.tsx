import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublishingGoalsWidget, updatedLabel, otherText, GREEN, AMBER } from './PublishingGoalsWidget'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'

const week = (start: string, done: number, target: number, untargeted = 0) => ({
  start, label: start.slice(5), done, target, untargeted, en: { done: 1, target: 2 },
})

const BOARD: PublishingBoardWeeks = {
  boardId: '462251934',
  name: 'AskAnAdventistFriend',
  perWeek: 11,
  enPerWeek: 2,
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
