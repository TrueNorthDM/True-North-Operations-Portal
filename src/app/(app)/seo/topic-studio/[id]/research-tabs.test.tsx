import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const refresh = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('../actions', () => ({
  editTopic: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../actions-research', () => ({
  saveCurated: vi.fn(async () => ({ ok: true })),
  saveDiscussion: vi.fn(async () => ({ ok: true, title: 'A thread', words: 14 })),
  removeDiscussion: vi.fn(async () => ({ ok: true })),
}))

import * as actions from '../actions'
import * as research from '../actions-research'
import { citationsView, readCurated } from '@/lib/topic-studio/citations'
import { discussionSearchLinks, discussionsView } from '@/lib/topic-studio/discussions'
import type { TopicPage } from '@/lib/topic-studio/project'
import { analysis, project } from '@/lib/topic-studio/test-fixture'
import { CitationsTab } from './CitationsTab'
import { DiscussionsTab } from './DiscussionsTab'

const save = vi.mocked(research.saveCurated)
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup() })

const page = (n: number, extra: string[], links: [string, string][]): TopicPage => ({
  artifactId: `c${n}`, kind: 'competitor', url: `https://site${n}.example.com/dry-firewood`, title: `Dry firewood ${n}`, desc: '',
  blocks: [['h1', 'Dry firewood'], ['p', 'Seasoned firewood burns hotter and cleaner than wet wood does.'], ...extra.map(t => ['p', t] as [string, string])], links, capturedAt: null, method: 'button',
})
const PAGES = [
  page(1, ['As Psalm 51:10 says, create in me a clean heart. Also John 3:16.', 'According to the Mayo Clinic, dry wood is safer to burn.'], [['https://www.cdc.gov/wood', 'Wood smoke facts'], ['https://forest.example.org/a', 'Forest guide']]),
  page(2, ['Read Psalm 51:10 and Romans 8:28.'], [['https://www.cdc.gov/wood', 'here'], ['https://other.example.net/x', 'Other thing']]),
]
const view = (curated: unknown = {}, faith = true) => citationsView(analysis(project(), PAGES), readCurated(curated), { faith })

describe('CitationsTab', () => {
  it('asks for captured pages first when there are none', () => {
    render(<CitationsTab id="t1" view={citationsView(analysis(project(), []), readCurated({}), { faith: true })} />)
    expect(screen.getByText('Capture competitor pages first.')).toBeInTheDocument()
  })
  it('shows Scripture, linked sources and authorities for a faith client, with the ticked ones in the brief', () => {
    render(<CitationsTab id="t1" view={view()} />)
    expect(screen.getByText('Bible books and passages')).toBeInTheDocument()
    expect(screen.getByText('Linked sources')).toBeInTheDocument()
    expect(screen.getByText('Named authorities')).toBeInTheDocument()
    expect(screen.getByLabelText('Include Psalm 51:10 in the brief')).toBeChecked()
    expect(screen.getAllByText('cited by 2 competitors').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Include Wood smoke facts in the brief')).toBeChecked()
    expect(screen.getByRole('link', { name: 'Wood smoke facts' })).toHaveAttribute('href', 'https://www.cdc.gov/wood')
  })
  it('leaves the Scripture out for a client without a faith profile', () => {
    render(<CitationsTab id="t1" view={view({}, false)} />)
    expect(screen.queryByText('Bible books and passages')).not.toBeInTheDocument()
    expect(screen.getByText('Linked sources')).toBeInTheDocument()
  })
  it('sends a tick as one change naming the entry', async () => {
    render(<CitationsTab id="t1" view={view()} />)
    fireEvent.click(screen.getByLabelText('Include Psalm 51:10 in the brief'))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'citePick', kind: 'refs', name: 'Psalm 51:10', on: false }))
    fireEvent.click(screen.getByLabelText('Include Wood smoke facts in the brief'))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'srcPick', n: 'cdc.gov/wood', on: false }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
  it('lists the unticked ones under "Others found" and ticks one', async () => {
    render(<CitationsTab id="t1" view={view({ curated: { citePicks: { auth: { 'Mayo Clinic': false } } } })} />)
    expect(screen.getByText('Others found (1)')).toBeInTheDocument()
    const box = screen.getByLabelText('Include Mayo Clinic in the brief')
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'citePick', kind: 'auth', name: 'Mayo Clinic', on: true }))
  })
  it('adds a name of your own, and clears the box once it is saved', async () => {
    render(<CitationsTab id="t1" view={view()} />)
    const input = screen.getByLabelText('Add to Named authorities')
    const add = within(input.parentElement as HTMLElement).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()
    fireEvent.change(input, { target: { value: 'World Health Organization' } })
    fireEvent.click(add)
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'citeAdd', kind: 'auth', name: 'World Health Organization' }))
    await waitFor(() => expect(input).toHaveValue(''))
  })
  it('removes what you added, and adds a source with its title', async () => {
    const v = view({ curated: { citeManual: { auth: ['WHO'] }, srcManual: [{ url: 'https://who.int/x', title: 'WHO guide', added: 1 }] } })
    render(<CitationsTab id="t1" view={v} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove WHO from the brief' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'citeRemove', kind: 'auth', name: 'WHO' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove WHO guide from the brief' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'srcRemove', n: 'who.int/x' }))
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://new.example.org/a' } })
    fireEvent.change(screen.getByLabelText('Source title'), { target: { value: 'New one' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith('t1', { op: 'srcAdd', url: 'https://new.example.org/a', title: 'New one' }))
  })
  it('shows a refusal in the toast and keeps what was typed', async () => {
    save.mockResolvedValueOnce({ ok: false, error: 'That source is already in the brief.' })
    render(<CitationsTab id="t1" view={view()} />)
    fireEvent.change(screen.getByLabelText('Source URL'), { target: { value: 'https://www.cdc.gov/wood' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add source' }))
    expect(await screen.findByText('That source is already in the brief.')).toBeInTheDocument()
    expect(screen.getByLabelText('Source URL')).toHaveValue('https://www.cdc.gov/wood')
    expect(refresh).not.toHaveBeenCalled()
  })
  it('offers a book as a topic term', async () => {
    render(<CitationsTab id="t1" view={view()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add John to the topic terms' }))
    await waitFor(() => expect(actions.editTopic).toHaveBeenCalledWith('t1', { op: 'add', text: 'John', key: 'john', tier: 'medium' }))
  })
})

describe('DiscussionsTab', () => {
  const thread = (id: string, title: string, url: string): TopicPage => ({ artifactId: id, kind: 'discussion', url, title, desc: '', blocks: [['p', 'I split it last spring and it still hisses.']], links: [], capturedAt: null, method: 'text' })
  const searches = discussionSearchLinks('dry firewood', false)
  const v = () => discussionsView([thread('d1', 'My firewood is wet', 'https://www.reddit.com/r/x/1'), thread('d2', 'Another one', '')])

  it('shows the search links and the paste box, and no list or Claude button before a thread is captured', () => {
    render(<DiscussionsTab id="t1" view={discussionsView([])} searches={searches} />)
    expect(screen.getByRole('link', { name: 'Reddit' })).toHaveAttribute('href', 'https://www.reddit.com/search/?q=dry%20firewood')
    expect(screen.getByLabelText('Paste a discussion thread')).toBeInTheDocument()
    expect(screen.queryByText('Captured threads', { exact: false })).not.toBeInTheDocument()
  })
  it('reads a pasted thread and sends it', async () => {
    render(<DiscussionsTab id="t1" view={discussionsView([])} searches={searches} />)
    const text = 'Is my firewood dry\nI split it last spring and it still hisses when it burns in the stove.'
    fireEvent.paste(screen.getByLabelText('Paste a discussion thread'), { clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : '') } })
    await waitFor(() => expect(research.saveDiscussion).toHaveBeenCalledTimes(1))
    const [id, cap, html] = vi.mocked(research.saveDiscussion).mock.calls[0]
    expect(id).toBe('t1')
    expect(html).toBe(false)
    expect((cap as { blocks: string[][] }).blocks).toEqual([['h1', 'Is my firewood dry'], ['p', 'I split it last spring and it still hisses when it burns in the stove.']])
    expect(await screen.findByText('Discussion added: 14 words.')).toBeInTheDocument()
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
  it('refuses an empty paste with a sentence, without calling the server', async () => {
    render(<DiscussionsTab id="t1" view={discussionsView([])} searches={searches} />)
    fireEvent.paste(screen.getByLabelText('Paste a discussion thread'), { clipboardData: { getData: () => '' } })
    expect(await screen.findByText('Nothing to capture in that paste.')).toBeInTheDocument()
    expect(research.saveDiscussion).not.toHaveBeenCalled()
  })
  it('refuses a paste too big for the server', async () => {
    render(<DiscussionsTab id="t1" view={discussionsView([])} searches={searches} />)
    fireEvent.paste(screen.getByLabelText('Paste a discussion thread'), { clipboardData: { getData: (t: string) => (t === 'text/plain' ? `Title\n${'word '.repeat(200_000)}` : '') } })
    expect(await screen.findByText(/too long to capture/)).toBeInTheDocument()
    expect(research.saveDiscussion).not.toHaveBeenCalled()
  })
  it('lists the threads, removes one by its id, and shows the Claude button waiting for phase 3', async () => {
    render(<DiscussionsTab id="t1" view={v()} searches={searches} />)
    expect(screen.getByRole('link', { name: 'My firewood is wet' })).toHaveAttribute('href', 'https://www.reddit.com/r/x/1')
    expect(screen.getByText('Another one')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Summarize with Claude' })).toBeDisabled()
    expect(screen.getByText('Phase 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove the thread Another one' }))
    await waitFor(() => expect(research.removeDiscussion).toHaveBeenCalledWith('t1', 'd2'))
  })
})
