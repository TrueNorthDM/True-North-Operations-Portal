import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('../actions-settings', () => ({ saveAiSettings: vi.fn(async () => ({ ok: true })) }))

import * as actions from '../actions-settings'
import { PROMPT_DEFS } from '@/lib/topic-studio/ai/prompt-defs'
import { DEFAULT_SETTINGS } from '@/lib/topic-studio/ai/settings'
import { SettingsForm } from './SettingsForm'

beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup() })
const mount = (connected = true) => render(<SettingsForm ai={DEFAULT_SETTINGS.ai} connected={connected} usage={[]} />)

describe('SettingsForm', () => {
  it('says whether Claude is connected', () => {
    mount(false)
    expect(screen.getByText(/not connected yet/)).toBeTruthy()
  })
  it('saves the limits as edited', async () => {
    mount()
    fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(actions.saveAiSettings).toHaveBeenCalled())
    expect(vi.mocked(actions.saveAiSettings).mock.calls[0][0]).toMatchObject({ dailyCap: 20, cooldownSec: 15 })
  })
  it('edits a prompt, shows the default can be restored, and sends only the changed prompt', async () => {
    mount()
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    const box = screen.getByLabelText('Prompt text') as HTMLTextAreaElement
    expect(box.value).toBe(PROMPT_DEFS.refine.template)
    expect(screen.getByRole('button', { name: 'Restore the default' })).toBeDisabled()
    fireEvent.change(box, { target: { value: `${PROMPT_DEFS.refine.template}\nBe brief.` } })
    expect(screen.getByRole('button', { name: 'Restore the default' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(actions.saveAiSettings).toHaveBeenCalled())
    expect(Object.keys((vi.mocked(actions.saveAiSettings).mock.calls[0][0] as { prompts: object }).prompts)).toEqual(['refine'])
    fireEvent.click(screen.getByRole('button', { name: 'Restore the default' }))
    expect(box.value).toBe(PROMPT_DEFS.refine.template)
  })
})
