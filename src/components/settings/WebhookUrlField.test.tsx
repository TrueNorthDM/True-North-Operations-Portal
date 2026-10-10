import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { EditingContext } from './editing-context'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { WebhookUrlField, maskedWebhookUrl } from './WebhookUrlField'

const ORIGIN = 'https://portal.test'
const SECRET = 'abcdef0123456789wxyz'
const FULL = `${ORIGIN}/api/monday/webhook/${SECRET}`

function mount(regenerate = vi.fn(), editing = true) {
  render(
    <EditingContext.Provider value={editing}>
      <WebhookUrlField origin={ORIGIN} secret={SECRET} regenerate={regenerate} />
    </EditingContext.Provider>,
  )
  return regenerate
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('WebhookUrlField (audit, 10 October 2026)', () => {
  it('shows the URL masked, with only the last 4 characters of the secret', () => {
    mount()
    expect(maskedWebhookUrl(ORIGIN, SECRET)).toBe(`${ORIGIN}/api/monday/webhook/${'•'.repeat(12)}wxyz`)
    expect(screen.getByText(maskedWebhookUrl(ORIGIN, SECRET))).toBeInTheDocument()
    expect(screen.queryByText(FULL)).toBeNull()
  })

  it('Show toggles the full URL and says so with aria-pressed', () => {
    mount()
    const show = screen.getByRole('button', { name: 'Show' })
    expect(show).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(show)
    expect(show).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(FULL)).toBeInTheDocument()
  })

  it('Copy copies the full URL even while it is masked', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(FULL))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('says when the copy failed', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText(/Copy failed/)).toBeInTheDocument()
  })

  it('asks before generating a new secret, and Cancel changes nothing', async () => {
    const regenerate = mount(vi.fn().mockResolvedValue({ ok: true, secret: 'newsecret0000' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate a new secret' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('Monday deliveries to the old address will be refused until you paste the new one in Monday.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(regenerate).not.toHaveBeenCalled()
  })

  it('generates on confirm and shows the error the action returns', async () => {
    const regenerate = mount(vi.fn().mockResolvedValue({ ok: false, error: 'Only a Super Admin can do this.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate a new secret' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate a new secret' }))
    await waitFor(() => expect(regenerate).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toHaveTextContent('Only a Super Admin can do this.')
  })
})
