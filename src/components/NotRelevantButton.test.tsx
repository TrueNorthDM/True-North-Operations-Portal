import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const actions = vi.hoisted(() => ({ setPageNotRelevant: vi.fn() }))
vi.mock('@/app/(app)/seo/href-links/actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { NotRelevantButton } from './NotRelevantButton'

const PAGE_ID = '00000000-0000-0000-0000-000000000001'
beforeEach(() => actions.setPageNotRelevant.mockReset())

describe('NotRelevantButton (audit, 10 October 2026)', () => {
  it('sends the page only and shows its state as pressed', async () => {
    actions.setPageNotRelevant.mockResolvedValue({ ok: true })
    render(<NotRelevantButton pageId={PAGE_ID} initialValue={false} />)
    const btn = screen.getByRole('button', { name: 'Not relevant' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    await waitFor(() => expect(actions.setPageNotRelevant).toHaveBeenCalledWith({ pageId: PAGE_ID, value: true }))
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('goes back and says why when refused', async () => {
    actions.setPageNotRelevant.mockResolvedValue({ ok: false, error: 'Not saved. Try again in a moment.' })
    render(<NotRelevantButton pageId={PAGE_ID} initialValue={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not relevant' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved')
    expect(screen.getByRole('button', { name: 'Not relevant' })).toHaveAttribute('aria-pressed', 'false')
  })
})
