import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const actions = vi.hoisted(() => ({ deletePage: vi.fn() }))
vi.mock('@/app/(app)/seo/href-links/actions', () => actions)
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

import { DeletePageButton } from './DeletePageButton'

const PAGE_ID = '00000000-0000-0000-0000-000000000001'

beforeEach(() => { actions.deletePage.mockReset(); push.mockReset() })

describe('DeletePageButton (audit, 10 October 2026)', () => {
  it('asks first, naming the page and saying Monday keeps its items', async () => {
    render(<DeletePageButton pageId={PAGE_ID} pageName="Who is God?" siteCode="aaaf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Who is God?')
    expect(dialog).toHaveTextContent('Run Link on them creates the page again')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(actions.deletePage).not.toHaveBeenCalled()
  })

  it('deletes with the page only and goes back to the site list', async () => {
    actions.deletePage.mockResolvedValue({ ok: true })
    render(<DeletePageButton pageId={PAGE_ID} pageName="Who is God?" siteCode="hfa" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Delete page')!)
    await waitFor(() => expect(actions.deletePage).toHaveBeenCalledWith({ pageId: PAGE_ID }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/seo/href-links/hfa'))
  })

  it('says when the delete was refused', async () => {
    actions.deletePage.mockResolvedValue({ ok: false, error: 'This site is not open to your access.' })
    render(<DeletePageButton pageId={PAGE_ID} pageName="X" siteCode="aaaf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete page' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Delete page')!)
    expect(await screen.findByRole('alert')).toHaveTextContent('This site is not open to your access.')
    expect(push).not.toHaveBeenCalled()
  })
})
