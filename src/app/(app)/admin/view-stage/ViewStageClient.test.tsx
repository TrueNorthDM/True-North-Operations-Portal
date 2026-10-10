import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const actions = vi.hoisted(() => ({ tokenViewAs: vi.fn() }))
vi.mock('./actions', () => actions)
vi.mock('@/lib/access/preview-fidelity', () => ({ PREVIEW_CAVEATS: [] }))

import ViewStageClient from './ViewStageClient'

beforeEach(() => {
  let n = 0
  actions.tokenViewAs.mockReset().mockImplementation(async (role: string) => ({ token: `${role}-${++n}`, name: role }))
})

const frames = () => [...document.querySelectorAll('iframe')]

describe('ViewStageClient (audit, 10 October 2026)', () => {
  it('signs one token per impersonated column on load', async () => {
    render(<ViewStageClient myName="Me" />)
    await waitFor(() => expect(actions.tokenViewAs).toHaveBeenCalledTimes(3))
  })

  it('does not reload the columns when the window regains focus', async () => {
    render(<ViewStageClient myName="Me" />)
    await waitFor(() => expect(frames()).toHaveLength(4))
    const before = frames().map(f => f.getAttribute('src'))
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(actions.tokenViewAs).toHaveBeenCalledTimes(3)
    expect(frames().map(f => f.getAttribute('src'))).toEqual(before)
  })

  it('signs the tokens again when the tab becomes visible', async () => {
    render(<ViewStageClient myName="Me" />)
    await waitFor(() => expect(actions.tokenViewAs).toHaveBeenCalledTimes(3))
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(actions.tokenViewAs).toHaveBeenCalledTimes(6))
  })

  it('Refresh signs new tokens and remounts every column, the Super Admin one too', async () => {
    render(<ViewStageClient myName="Me" />)
    await waitFor(() => expect(frames()).toHaveLength(4))
    const own = frames()[0]
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(actions.tokenViewAs).toHaveBeenCalledTimes(6))
    expect(frames()[0]).not.toBe(own)
  })

  it('names the zoom buttons', async () => {
    render(<ViewStageClient myName="Me" />)
    await waitFor(() => expect(frames()).toHaveLength(4))
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
  })
})
