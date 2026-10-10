import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditingContext } from './editing-context'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { SecretField } from './SecretField'

function mount(save = vi.fn()) {
  render(
    <EditingContext.Provider value={true}>
      <SecretField
        title="Monday API"
        description="Token"
        info={{ exists: true, last4: '1234' }}
        placeholder="Paste"
        changeWarning={{ title: 'Change the token?', confirm: 'Let me change it', body: <p>It breaks the connection.</p> }}
        clearWarning={{ title: 'Remove the token?', confirm: 'Remove token', body: <p>It stops the sync.</p> }}
        save={save}
      />
    </EditingContext.Provider>,
  )
  return save
}

describe('SecretField (audit, 10 October 2026)', () => {
  it('asks through the portal dialog before changing; Escape cancels', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('It breaks the connection.')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.queryByLabelText('Monday API')).toBeNull()
  })

  it('opens the input after confirming a change', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Let me change it' }))
    expect(await screen.findByLabelText('Monday API')).toBeInTheDocument()
  })

  it('removes only after confirming, and shows the error the action returns', async () => {
    const save = mount(vi.fn().mockResolvedValue({ ok: false, error: 'Only a Super Admin can change API tokens.' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Remove token' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ value: '' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only a Super Admin can change API tokens.')
  })
})
