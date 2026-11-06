import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('../actions', () => ({
  saveDraft: vi.fn(async (_id: string, _html: string, base: number) => ({ ok: true, saved: true, version: base + 1, savedAt: 'now' })),
  saveVersionNow: vi.fn(async () => ({ ok: true, version: null })),
  listVersions: vi.fn(async () => ({
    ok: true,
    versions: [
      { id: 2, savedAt: '2026-11-06T10:00:00Z', by: 'Wendy Cacka', kind: 'saved', note: '', words: 120 },
      { id: 1, savedAt: '2026-11-06T09:00:00Z', by: 'Jeannette Owens', kind: 'auto', note: 'Before this editing session', words: 80 },
    ],
  })),
  readVersion: vi.fn(async () => ({ ok: true, html: '<p>An older draft</p>' })),
  restoreVersion: vi.fn(async () => ({ ok: true, html: '<p>An older draft</p>', version: 9 })),
  sendTermFeedback: vi.fn(async () => ({ ok: true })),
  resolveFeedback: vi.fn(async () => ({ ok: true })),
  editTopic: vi.fn(async () => ({ ok: true })),
  termContext: vi.fn(async () => ({
    ok: true,
    context: { label: 'creosote', stats: { df: 3, med: 1, min: 1, max: 2, ai: 1, competitors: 4, aiLabels: ['ChatGPT'], aiAnswers: 3 }, sources: [] },
  })),
}))

import * as actions from '../actions'
import { analysis, project } from '@/lib/topic-studio/test-fixture'
import { workshopModel } from '@/lib/topic-studio/workshop'
import { WriterTab } from './WriterTab'
import { TermsTab } from './TermsTab'
import { termsView } from '@/lib/topic-studio/views'

const save = vi.mocked(actions.saveDraft)
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => cleanup())

const TERMS = [{ t: 'moisture meter', tier: 'high' }, { t: 'creosote', tier: 'high' }, { t: 'seasoning', tier: 'low' }]
const model = () => workshopModel(analysis(project({ terms: TERMS })))
const INITIAL = '<h1>How to dry firewood</h1><p>A moisture meter tells you when firewood is dry enough to burn in your stove this winter.</p>'
const editor = () => screen.getByRole('textbox', { name: 'Your draft' })
const type = (html: string) => { editor().innerHTML = html; fireEvent.input(editor()) }
const mount = (over: Partial<Parameters<typeof WriterTab>[0]> = {}) => render(<WriterTab id="t1" initialHtml={INITIAL} version={3} model={model()} {...over} />)

describe('WriterTab', () => {
  it('puts the saved draft in the editor and the guidance beside it', async () => {
    mount()
    expect(editor().innerHTML).toContain('<h1>How to dry firewood</h1>')
    expect(await screen.findByText('Your word count')).toBeInTheDocument()
    expect(screen.getByText('Topic coverage')).toBeInTheDocument()
    expect(screen.getByText('Readability')).toBeInTheDocument()
    // moisture meter is used, the other two are still to consider
    const missing = screen.getByText('Terms to consider').closest('section')!
    expect(within(missing).getByRole('button', { name: 'creosote' })).toBeInTheDocument()
    expect(within(missing).queryByRole('button', { name: 'moisture meter' })).not.toBeInTheDocument()
    const used = screen.getByText('Terms you’ve used').closest('section')!
    expect(within(used).getByRole('button', { name: 'moisture meter' })).toBeInTheDocument()
  })
  it('shows an empty draft with the placeholder and asks for a draft in the panels', () => {
    mount({ initialHtml: '' })
    expect(editor().className).toContain('is-empty')
    expect(screen.getByText('Paste your draft to see how well it covers the topic.')).toBeInTheDocument()
  })
  it('saves a moment after typing, naming the version it started from, and updates the panels', async () => {
    mount()
    type('<h1>How to dry firewood</h1><p>Creosote builds up when wet wood burns in a stove with poor draft.</p>')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(save).toHaveBeenCalledWith('t1', expect.stringContaining('Creosote builds up'), 3)
    await waitFor(() => expect(screen.getAllByText(/Saved \d/).length).toBeGreaterThan(0))
    const used = screen.getByText('Terms you’ve used').closest('section')!
    await waitFor(() => expect(within(used).getByRole('button', { name: 'creosote' })).toBeInTheDocument())
  })
  it('saves one at a time, each from the version the last one made', async () => {
    mount()
    type('<p>First change to the draft of this article.</p>')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 3000 })
    type('<p>Second change to the draft of this article.</p>')
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2), { timeout: 3000 })
    expect(save.mock.calls.map(c => c[2])).toEqual([3, 4])
  })
  it('refuses to overwrite someone else\'s save, and keeps the writer\'s text until they choose', async () => {
    save.mockResolvedValueOnce({ ok: true, saved: false, version: 7, savedAt: null })
    mount()
    type('<p>My words that were not saved because someone else saved first.</p>')
    const banner = await screen.findByRole('alert', undefined, { timeout: 3000 })
    expect(banner).toHaveTextContent(/Someone else saved this draft/)
    expect(editor().innerHTML).toContain('My words that were not saved')
    fireEvent.click(within(banner).getByRole('button', { name: 'Keep mine' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][2]).toBe(7)
    expect(save.mock.calls[1][1]).toContain('My words that were not saved')
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
  it('shows a refusal from the server and does not lose the draft', async () => {
    save.mockResolvedValueOnce({ ok: false, error: 'This draft is too long to save.' })
    mount()
    type('<p>Some text that the server will not accept for saving right now.</p>')
    expect(await screen.findByText('This draft is too long to save.', undefined, { timeout: 3000 })).toBeInTheDocument()
    expect(editor().innerHTML).toContain('Some text that the server will not accept')
  })
  it('saves a version by hand after sending what is waiting', async () => {
    mount()
    type('<p>Words typed just before pressing save version on the toolbar.</p>')
    fireEvent.click(screen.getByRole('button', { name: 'Save version' }))
    await waitFor(() => expect(actions.saveVersionNow).toHaveBeenCalledWith('t1'))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(actions.saveVersionNow).mock.invocationCallOrder[0])
  })
  it('opens a term in context from its chip', async () => {
    mount()
    const missing = (await screen.findByText('Terms to consider')).closest('section')!
    fireEvent.click(within(missing).getByRole('button', { name: 'creosote' }))
    expect(await screen.findByRole('dialog', { name: /creosote in context/ })).toBeInTheDocument()
    expect(actions.termContext).toHaveBeenCalledWith('t1', 'creosote', 'creosote')
  })
  it('turns groupings off and checks for overused words', async () => {
    mount()
    const missing = (await screen.findByText('Terms to consider')).closest('section')!
    fireEvent.click(within(missing).getByRole('button', { name: 'Turn groupings off' }))
    expect(within(missing).getByRole('button', { name: 'Turn groupings on' })).toBeInTheDocument()
    const used = screen.getByText('Terms you’ve used').closest('section')!
    fireEvent.click(within(used).getByRole('button', { name: 'Check for overused words' }))
    expect(within(used).getByText(/Write a bit more before checking/)).toBeInTheDocument()
  })
  it('sends feedback on the term list, asking what is wrong when it has problems', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Has problems' }))
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Missing the word stove' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    await waitFor(() => expect(actions.sendTermFeedback).toHaveBeenCalledWith('t1', 'problems', 'Missing the word stove'))
    expect(await screen.findByText(/Thank you/)).toBeInTheDocument()
  })
  it('says the SEO team has not built the list yet when there are no terms', () => {
    render(<WriterTab id="t1" initialHtml="" version={0} model={workshopModel(analysis(project()))} />)
    expect(screen.getByText(/has not built the topic term list yet/)).toBeInTheDocument()
  })
})

describe('Version history', () => {
  it('lists the versions with who and what kind, previews one and restores it into the editor', async () => {
    mount()
    fireEvent.click(screen.getAllByRole('button', { name: 'Version history' })[0])
    const drawer = await screen.findByRole('dialog', { name: 'Version history' })
    expect(await within(drawer).findByText('Wendy Cacka')).toBeInTheDocument()
    expect(within(drawer).getByText('Automatic')).toBeInTheDocument()
    expect(within(drawer).getByText(/Before this editing session/)).toBeInTheDocument()
    fireEvent.click(within(drawer).getAllByRole('button', { name: 'Preview' })[0])
    expect(await within(drawer).findByText('An older draft')).toBeInTheDocument()
    fireEvent.click(within(drawer).getAllByRole('button', { name: 'Restore' })[0])
    const ask = await screen.findByRole('alertdialog')
    expect(ask).toHaveTextContent(/saved in the history first/)
    fireEvent.click(within(ask).getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(actions.restoreVersion).toHaveBeenCalledWith('t1', 2))
    await waitFor(() => expect(editor().innerHTML).toContain('An older draft'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Version history' })).not.toBeInTheDocument())
  })
  it('does not restore when the question is cancelled', async () => {
    mount()
    fireEvent.click(screen.getAllByRole('button', { name: 'Version history' })[0])
    const drawer = await screen.findByRole('dialog', { name: 'Version history' })
    fireEvent.click((await within(drawer).findAllByRole('button', { name: 'Restore' }))[0])
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await act(async () => { await Promise.resolve() })
    expect(actions.restoreVersion).not.toHaveBeenCalled()
  })
})

describe('Writer feedback for the SEO team', () => {
  const view = () => termsView(analysis(project({ terms: TERMS })))
  const fb = [
    { id: 1, by: 'Wendy Cacka', rating: 'problems' as const, note: 'Missing stove', createdAt: '2026-11-06T10:00:00Z', resolved: false },
    { id: 2, by: 'Jeannette Owens', rating: 'good' as const, note: '', createdAt: '2026-11-05T10:00:00Z', resolved: true },
  ]
  it('lists feedback with who sent it and lets an SEO mark it dealt with or reopen it', async () => {
    render(<TermsTab id="t1" view={view()} feedback={fb} />)
    expect(screen.getByText(/1 open/)).toBeInTheDocument()
    expect(screen.getByText('Missing stove')).toBeInTheDocument()
    expect(screen.getByText('Has problems')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark as dealt with' }))
    await waitFor(() => expect(actions.resolveFeedback).toHaveBeenCalledWith('t1', 1, true))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    await waitFor(() => expect(actions.resolveFeedback).toHaveBeenCalledWith('t1', 2, false))
  })
  it('shows nothing when there is no feedback', () => {
    render(<TermsTab id="t1" view={view()} />)
    expect(screen.queryByText(/Writer feedback on this list/)).not.toBeInTheDocument()
  })
})
