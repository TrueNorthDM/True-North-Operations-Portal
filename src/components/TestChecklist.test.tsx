import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { TestChecklist } from './TestChecklist'
import { TEST_AREAS } from '@/lib/tests/data'

const FIRST = TEST_AREAS[0].cases[0].id

beforeEach(() => { try { window.localStorage.clear() } catch { /* ignore */ } })

describe('TestChecklist (audit, 10 October 2026)', () => {
  it('marks a result as pressed and keeps it in this browser', () => {
    render(<TestChecklist />)
    const pass = screen.getAllByRole('button', { name: 'Pass' })[0]
    expect(pass).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(pass)
    expect(pass).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(window.localStorage.getItem('tn:tests:v2')!).results[FIRST]).toBe('pass')
  })

  it('names the note button and says whether an area is open', () => {
    render(<TestChecklist />)
    expect(screen.getByRole('button', { name: `Add a note for ${FIRST}` })).toBeInTheDocument()
    const area = screen.getByRole('button', { name: new RegExp(TEST_AREAS[0].area) })
    expect(area).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(area)
    expect(area).toHaveAttribute('aria-expanded', 'false')
  })

  it('filter cards say which one is on', () => {
    render(<TestChecklist />)
    const failing = screen.getByRole('button', { name: /Failing/ })
    expect(failing).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(failing)
    expect(failing).toHaveAttribute('aria-pressed', 'true')
  })

  it('asks before resetting, and Cancel keeps the results', async () => {
    render(<TestChecklist />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Pass' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Reset checklist' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByRole('button', { name: 'Pass' })[0]).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Reset checklist' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Reset checklist' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Pass' })[0]).toHaveAttribute('aria-pressed', 'false'))
    expect(window.localStorage.getItem('tn:tests:v2')).toBeNull()
  })
})
