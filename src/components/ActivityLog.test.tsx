import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityLog } from './ActivityLog'

const row = (id: string, result: string) => ({ id, received_at: '2026-10-09T19:05:00Z', monday_item_id: '1', page_name: 'Who is God?', result })

describe('ActivityLog (audit, 10 October 2026)', () => {
  it('is titled for Monday and says when there is nothing yet', () => {
    render(<ActivityLog rows={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /recent activity from monday/i }))
    expect(screen.getByText('No activity from Monday yet.')).toBeInTheDocument()
  })

  it('opens by itself when something failed, and counts it', () => {
    render(<ActivityLog rows={[row('a', 'error:monday (timeout)'), row('b', 'ok:saved en (waiting on: sw)')]} />)
    expect(screen.getByRole('button', { name: /recent activity from monday/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Monday could not be reached')).toBeInTheDocument()
    expect(screen.getByText(/1 failed/)).toBeInTheDocument()
  })

  it('stays closed when all went well', () => {
    render(<ActivityLog rows={[row('b', 'ok:saved en (waiting on: sw)')]} />)
    expect(screen.getByRole('button', { name: /recent activity from monday/i })).toHaveAttribute('aria-expanded', 'false')
  })
})
