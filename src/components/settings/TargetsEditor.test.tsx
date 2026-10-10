import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { PublishingTargetRow } from '@/lib/types/database.types'

const actions = vi.hoisted(() => ({
  saveTargetValue: vi.fn(),
  addTarget: vi.fn(),
  deleteTarget: vi.fn(),
  addPublisher: vi.fn(),
  removePublisher: vi.fn(),
}))
vi.mock('@/app/(app)/admin/settings/targets-actions', () => actions)
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

import { TargetsEditor, parseTarget, listNames, checkPublisher, fmtWhen } from './TargetsEditor'

const row = (id: string, language: string, target_value: number) =>
  ({ id, board_id: '462251934', board_short: 'AAAF-P', language, target_value, period_type: 'weekly' }) as unknown as PublishingTargetRow

const BOARDS = [{ id: '462251934', short: 'AAAF-P', name: 'AAAF · Publishing', languages: ['English', 'Portuguese', 'Spanish', 'Swahili'] }]
const TARGETS = [row('a', 'English', 2), row('b', 'Portuguese', 3), row('c', 'Spanish', 3)]

function setup(canEdit = true) {
  return render(<TargetsEditor targets={TARGETS} audit={[]} boards={BOARDS} publishers={['Samuel Manzi', 'Wendy Cacka']} canEdit={canEdit} />)
}

beforeEach(() => {
  Object.values(actions).forEach(f => f.mockReset())
  refresh.mockReset()
})

describe('TargetsEditor helpers (audit, 10 October 2026)', () => {
  it('takes whole numbers 0 or more only', () => {
    expect(parseTarget('3')).toBe(3)
    expect(parseTarget(' 0 ')).toBe(0)
    expect(parseTarget('2.5')).toBeNull()
    expect(parseTarget('-1')).toBeNull()
    expect(parseTarget('')).toBeNull()
    expect(parseTarget('1e2')).toBeNull()
  })

  it('lists names in a sentence', () => {
    expect(listNames(['English'])).toBe('English')
    expect(listNames(['English', 'Spanish'])).toBe('English and Spanish')
    expect(listNames(['English', 'Portuguese', 'Spanish'])).toBe('English, Portuguese and Spanish')
  })

  it('trims a publisher and refuses a duplicate in any capitalisation', () => {
    expect(checkPublisher('  Ana   Silva ', [])).toEqual({ name: 'Ana Silva' })
    expect(checkPublisher('samuel manzi', ['Samuel Manzi'])).toEqual({ error: 'samuel manzi is already a publisher.' })
    expect(checkPublisher('   ', [])).toHaveProperty('error')
  })

  it('dates the history in New York', () => {
    expect(fmtWhen('2026-10-09T19:05:00Z')).toBe('Oct 9, 2026, 3:05 PM')
  })
})

describe('TargetsEditor (audit, 10 October 2026)', () => {
  it('shows the lists read-only without edit controls when it cannot edit', () => {
    setup(false)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Samuel Manzi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
    expect(screen.queryByLabelText('Add a publisher')).toBeNull()
    expect(screen.queryByText(/view-only/i)).toBeNull()
  })

  it('refuses a target that is not a whole number before sending anything', async () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('English weekly target'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A target is a whole number of pages a week, 0 or more. Check English.')
    expect(actions.saveTargetValue).not.toHaveBeenCalled()
  })

  it('says which rows saved and which did not when a save fails part way', async () => {
    actions.saveTargetValue.mockImplementation(async ({ id }: { id: string }) =>
      id === 'a' ? { ok: true } : { ok: false, error: 'Not saved. Try again in a moment.' })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('English weekly target'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Portuguese weekly target'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Saved English. Not saved: Portuguese. Not saved. Try again in a moment.')
    expect(actions.saveTargetValue).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalled()
  })

  it('asks before removing a target, naming the board and language', async () => {
    actions.deleteTarget.mockResolvedValue({ ok: true })
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove the weekly target for Spanish' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Remove the weekly target for Spanish on AAAF?')
    expect(dialog).toHaveTextContent('Past weeks keep the target they had.')
    expect(actions.deleteTarget).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(actions.deleteTarget).toHaveBeenCalledWith({ id: 'c' }))
  })

  it('offers only the languages the site publishes that have no target yet', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Add a language')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Language to add on AAAF' }))
    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toEqual(['Swahili'])
  })

  it('refuses a duplicate publisher and asks before removing one', async () => {
    actions.removePublisher.mockResolvedValue({ ok: true })
    setup()
    fireEvent.change(screen.getByLabelText('Add a publisher'), { target: { value: ' wendy cacka ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add publisher' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('wendy cacka is already a publisher.')
    expect(actions.addPublisher).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Samuel Manzi from publishers' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Remove Samuel Manzi from publishers?')
    expect(dialog).toHaveTextContent('Their pages stop counting toward the goals.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(actions.removePublisher).toHaveBeenCalledWith({ name: 'Samuel Manzi' }))
  })
})
