import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const refresh = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('../actions', () => ({
  editTopic: vi.fn(async () => ({ ok: true })),
  saveCapture: vi.fn(async () => ({ ok: true, label: '#1 site1.example.com', words: 12, notes: [] })),
  removeCapture: vi.fn(async () => ({ ok: true })),
  saveSetup: vi.fn(async () => ({ ok: true, savedAt: 'now' })),
  deleteTopic: vi.fn(async () => ({ ok: true })),
  createTopic: vi.fn(async () => ({ ok: true, id: 'new-id' })),
  previewRules: vi.fn(async () => ({ ok: true, top: [{ t: 'moisture meter', single: false }], singles: 0 })),
  termContext: vi.fn(async () => ({
    ok: true,
    context: { label: 'moisture meter', stats: { df: 4, med: 2, min: 1, max: 3, ai: 2, competitors: 4, aiLabels: ['ChatGPT'], aiAnswers: 3 }, sources: [{ label: '#1 site1.example.com', uses: 2, examples: [{ text: 'Check it with a moisture meter.', under: 'Why moisture content matters', heading: false }] }] },
  })),
}))

import * as actions from '../actions'
import { PAGES, analysis, project } from '@/lib/topic-studio/test-fixture'
import { competitorsView, questionsView, termsView } from '@/lib/topic-studio/views'
import { BriefTab } from './BriefTab'
import { CompetitorsTab } from './CompetitorsTab'
import { QuestionsTab } from './QuestionsTab'
import { SetupTab } from './SetupTab'
import { TermsTab } from './TermsTab'

const edit = vi.mocked(actions.editTopic)
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers() })

const TERMS = [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }, { t: 'creosote', tier: 'low' }]

describe('TermsTab', () => {
  const view = () => termsView(analysis(project({ terms: TERMS })))
  it('shows the counts, the recommended range, the groups and each term with how it is used', () => {
    render(<TermsTab id="t1" view={view()} />)
    expect(screen.getByText('2')).toBeInTheDocument() // concepts
    expect(screen.getByText(/plus 1 variant/)).toBeInTheDocument()
    expect(screen.getByText(/Recommended: 20-35 terms/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'moisture meter' })).toBeInTheDocument()
    expect(screen.getByText('same as moisture meter')).toBeInTheDocument()
    expect(screen.getAllByText(/4\/7/).length).toBeGreaterThan(0) // 4 competitors + 3 AI answers
    expect(screen.getByText('Build rules')).toBeInTheDocument()
  })
  it('sends each edit as one operation naming the term by key', async () => {
    render(<TermsTab id="t1" view={view()} />)
    fireEvent.click(screen.getAllByTitle('Change relevance')[0])
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'tier', key: 'moisture meter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove creosote' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'remove', keys: ['creosote'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Move creosote up' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'move', key: 'creosote', dir: -1 }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Not the same' })[0])
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'notVariant', key: 'meter moisture' }))
  })
  it('adds a term by hand, and refreshes the page after a save', async () => {
    render(<TermsTab id="t1" view={view()} />)
    fireEvent.change(screen.getByLabelText('Add a missing term'), { target: { value: 'seasoned wood' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'add', text: 'seasoned wood' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
  it('shows a refusal in the toast and does not refresh', async () => {
    edit.mockResolvedValueOnce({ ok: false, error: 'That term is already on the list.' })
    render(<TermsTab id="t1" view={view()} />)
    fireEvent.change(screen.getByLabelText('Add a missing term'), { target: { value: 'creosote' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('That term is already on the list.')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })
  it('selects terms for bulk edits', async () => {
    render(<TermsTab id="t1" view={view()} />)
    fireEvent.click(screen.getByLabelText('Select creosote'))
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Move to top' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'moveEnd', keys: ['creosote'], where: 'top' }))
    fireEvent.click(screen.getByLabelText('Select creosote'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'remove', keys: ['creosote'] }))
  })
  it('opens a term in context in a drawer', async () => {
    render(<TermsTab id="t1" view={view()} />)
    fireEvent.click(screen.getByRole('button', { name: 'moisture meter' }))
    const drawer = await screen.findByRole('dialog', { name: /moisture meter in context/ })
    expect(await within(drawer).findByText(/Used by 4 of 4 competitors, typically 2×/)).toBeInTheDocument()
    expect(within(drawer).getByText('#1 site1.example.com')).toBeInTheDocument()
    expect(within(drawer).getByText('moisture meter', { selector: 'mark' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /in context/ })).not.toBeInTheDocument())
  })
  it('asks before a rebuild, and builds straight away when the list is empty', async () => {
    const { unmount } = render(<TermsTab id="t1" view={view()} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Rebuild from data' })[0])
    expect(await screen.findByText('Rebuild the term list?')).toBeInTheDocument()
    unmount()
    render(<TermsTab id="t1" view={termsView(analysis(project()))} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Build term list' })[0])
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'build' }))
  })
  it('names the missing AI answers and points to Setup', () => {
    render(<TermsTab id="t1" view={termsView(analysis(project({ aiGemini: '' })))} />)
    expect(screen.getByText(/Required AI answers missing: Gemini/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Setup' })).toHaveAttribute('href', '/seo/topic-studio/t1?tab=setup')
  })
  it('leaves the Claude buttons off until phase 3', () => {
    render(<TermsTab id="t1" view={view()} />)
    expect(screen.getByRole('button', { name: 'Refine with Claude' })).toBeDisabled()
  })
})

describe('CompetitorsTab', () => {
  const view = () => competitorsView(analysis(project(), PAGES.slice(0, 2)))
  it('shows the stats and a row per competitor, captured or waiting for a paste', () => {
    render(<CompetitorsTab id="t1" view={view()} />)
    expect(screen.getByText('2/4')).toBeInTheDocument()
    expect(screen.getAllByText('Captured')).toHaveLength(2)
    expect(screen.getByLabelText('Paste the capture for site3.example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Build topic terms' })).toHaveAttribute('href', '/seo/topic-studio/t1?tab=terms')
  })
  it('reads a pasted article and sends it for the row it was pasted into', async () => {
    render(<CompetitorsTab id="t1" view={view()} />)
    const box = screen.getByLabelText('Paste the capture for site3.example.com')
    const text = 'How to dry firewood\nSeasoned firewood burns hotter and cleaner than wet wood does in any stove.'
    fireEvent.paste(box, { clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : '') } })
    await waitFor(() => expect(actions.saveCapture).toHaveBeenCalledTimes(1))
    const [id, cap, html, target] = vi.mocked(actions.saveCapture).mock.calls[0]
    expect(id).toBe('t1')
    expect(html).toBe(false)
    expect(target).toBe(2)
    expect((cap as { blocks: string[][] }).blocks).toEqual([['h1', 'How to dry firewood'], ['p', 'Seasoned firewood burns hotter and cleaner than wet wood does in any stove.']])
    expect(await screen.findByText(/Saved 12 words for #1 site1.example.com/)).toBeInTheDocument()
  })
  it('refuses an empty paste with a sentence, without calling the server', async () => {
    render(<CompetitorsTab id="t1" view={view()} />)
    fireEvent.paste(screen.getByLabelText('Paste any capture'), { clipboardData: { getData: () => '' } })
    expect(await screen.findByText(/Nothing to capture in that paste/)).toBeInTheDocument()
    expect(actions.saveCapture).not.toHaveBeenCalled()
  })
  it('removes a capture and shows the outline of a page', async () => {
    render(<CompetitorsTab id="t1" view={view()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show the heading outline of site1.example.com' }))
    expect(screen.getByText('How to dry firewood', { selector: 'li' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove the capture of site2.example.com' }))
    await waitFor(() => expect(actions.removeCapture).toHaveBeenCalledWith('t1', PAGES[1].url))
  })
  it('asks for addresses in Setup when there are none', () => {
    render(<CompetitorsTab id="t1" view={competitorsView(analysis(project({ organic: [] })))} />)
    expect(screen.getByText(/Add the competitor addresses in Setup first/)).toBeInTheDocument()
  })
})

describe('QuestionsTab', () => {
  const view = () => questionsView(analysis(project({
    answerTop: ['Say this first'],
    questions: [{ q: 'D1?', key: 'd1', direct: true, src: 'manual' }, { q: 'C1?', key: 'c1', src: 'competitor', from: ['#1 a'] }],
  })))
  it('shows the sections and what is in each', () => {
    render(<QuestionsTab id="t1" view={view()} />)
    expect(screen.getByText('Say this first')).toBeInTheDocument()
    expect(screen.getByText('D1?')).toBeInTheDocument()
    expect(screen.getByText('From competitors')).toBeInTheDocument()
    expect(screen.getByText('1 source')).toBeInTheDocument()
  })
  it('promotes, removes, adds and scans', async () => {
    render(<QuestionsTab id="t1" view={view()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Answer directly' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'qDirect', key: 'c1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove: C1?' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'qOff', key: 'c1' }))
    fireEvent.change(screen.getByLabelText('Add a question to answer directly'), { target: { value: 'How dry is dry?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'qAdd', text: 'How dry is dry?' }))
    fireEvent.click(screen.getByRole('button', { name: 'Re-scan competitors' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'syncQuestions' }))
  })
  it('edits the notes for the summary answer', async () => {
    render(<QuestionsTab id="t1" view={view()} />)
    fireEvent.change(screen.getByLabelText('Add a note for the summary answer'), { target: { value: 'Then this' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'notes', notes: ['Say this first', 'Then this'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Say this first' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'notes', notes: [] }))
  })
})

describe('BriefTab', () => {
  const props = { id: 't1', html: '<h2>BM Topic: X</h2><p>Body</p>', markdown: '# BM Topic: X', termListHtml: '<ul></ul>', termListText: '', csv: 'a,b', slug: 'x', hasTerms: true }
  it('shows the brief and shares with writers through one switch', async () => {
    render(<BriefTab {...props} shared={false} />)
    expect(screen.getByRole('heading', { name: 'BM Topic: X' })).toBeInTheDocument()
    expect(screen.getByText('Not shared')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Shared with writers' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'share', shared: true }))
  })
  it('gives a writer the brief with no sharing control', () => {
    render(<BriefTab {...props} shared={null} />)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy for Google Docs/ })).toBeInTheDocument()
  })
  it('hides the term buttons when there are no terms', () => {
    render(<BriefTab {...props} shared={false} hasTerms={false} />)
    expect(screen.queryByRole('button', { name: /terms \.csv/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy term list only' })).not.toBeInTheDocument()
  })
})

describe('SetupTab', () => {
  const base = {
    id: 't1', client: 'BM', clients: [{ code: 'BM', name: 'Bessemeter' }], topic: 'How to dry firewood', primary: 'how to dry firewood', monday: '', secondary: '', avoid: '',
    ai: { aiOverview: '', aiChatgpt: '', aiGemini: '', aiPerplexity: '' }, organic: ['https://a.test/x'], cited: [], archived: false,
  }
  it('saves a field after a short pause, with only that field', async () => {
    vi.useFakeTimers()
    render(<SetupTab {...base} />)
    fireEvent.change(screen.getByLabelText('Primary keyphrase'), { target: { value: 'dry firewood fast' } })
    expect(actions.saveSetup).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(actions.saveSetup).toHaveBeenCalledWith('t1', { primary: 'dry firewood fast' })
  })
  it('fills the list from a pasted list of addresses', async () => {
    vi.useFakeTimers()
    render(<SetupTab {...base} />)
    const first = screen.getByLabelText('Organic result 1')
    fireEvent.paste(first, { clipboardData: { getData: () => 'https://one.test/a\nhttps://two.test/b\n' } })
    expect(screen.getByLabelText('Organic result 2')).toHaveValue('https://two.test/b')
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })
    expect(actions.saveSetup).toHaveBeenCalledWith('t1', { organic: ['https://one.test/a', 'https://two.test/b', '', '', '', '', '', '', '', ''] })
  })
  it('opens each AI tool with the keyphrase ready', () => {
    render(<SetupTab {...base} />)
    expect(screen.getByRole('link', { name: /ChatGPT answer/ })).toHaveAttribute('href', expect.stringContaining('q=how%20to%20dry%20firewood'))
  })
  it('asks before deleting, then goes back to the list', async () => {
    render(<SetupTab {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete topic' }))
    expect(await screen.findByText('Delete this topic?')).toBeInTheDocument()
    expect(actions.deleteTopic).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete topic' }))
    await waitFor(() => expect(actions.deleteTopic).toHaveBeenCalledWith('t1'))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/seo/topic-studio'))
  })
  it('does not delete when the dialog is cancelled', async () => {
    render(<SetupTab {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete topic' }))
    await screen.findByText('Delete this topic?')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('Delete this topic?')).not.toBeInTheDocument())
    expect(actions.deleteTopic).not.toHaveBeenCalled()
  })
  it('archives and goes back to the list', async () => {
    render(<SetupTab {...base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Archive topic' }))
    await waitFor(() => expect(edit).toHaveBeenCalledWith('t1', { op: 'archive', archived: true }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/seo/topic-studio'))
  })
})
