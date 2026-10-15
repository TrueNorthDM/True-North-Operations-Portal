import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RangeFilter } from './RangeFilter'
import type { RangeChoice } from '@/lib/tsheets/range'

// The i7 report's inline period row (approved 15 October 2026).
const CHOICE: RangeChoice = { mode: 'month', month: '2026-09', year: '2026', from: '2026-01', to: '2026-09' }
const draw = (value: RangeChoice, onChange = vi.fn()) => {
  render(
    <RangeFilter value={value} onChange={onChange} currentMonth="2026-09"
      modes={['month', 'year', 'last12', 'custom']} months={['2026-09', '2026-08']} layout="inline" />,
  )
  return onChange
}

describe('RangeFilter, inline', () => {
  it('shows the four ways at once, with the chosen one picked', () => {
    draw(CHOICE)
    const ways = screen.getAllByRole('radio')
    expect(ways.map(w => w.textContent)).toEqual(['One month', 'Year', 'Last 12 months', 'Choose months'])
    expect(screen.getByRole('radio', { name: 'One month' })).toHaveAttribute('aria-checked', 'true')
  })

  it('changes the way with one click, keeping the rest of the choice', () => {
    const onChange = draw(CHOICE)
    fireEvent.click(screen.getByRole('radio', { name: 'Year' }))
    expect(onChange).toHaveBeenCalledWith({ ...CHOICE, mode: 'year' })
  })

  it('says which months the last 12 are, from the first month the report holds', () => {
    // RANGE_FLOOR is January 2026: nothing earlier is offered.
    draw({ ...CHOICE, mode: 'last12' })
    expect(screen.getByText('Jan 2026 to Sep 2026')).toBeInTheDocument()
  })

  it('shows From and To for chosen months, and says when they are the wrong way round', () => {
    draw({ ...CHOICE, mode: 'custom', from: '2026-08', to: '2026-03' })
    expect(screen.getByLabelText('From')).toBeInTheDocument()
    expect(screen.getByLabelText('To')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('The first month has to come before the last.')
  })
})
