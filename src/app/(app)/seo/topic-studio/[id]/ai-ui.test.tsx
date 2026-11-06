import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('../actions-ai', () => ({ runAi: vi.fn(async () => ({ ok: true, model: 'claude-opus-5-5' })) }))
vi.mock('../actions-originality', () => ({ saveOriginality: vi.fn(async () => ({ ok: true })) }))

import * as ai from '../actions-ai'
import * as orig from '../actions-originality'
import { readAiResults } from '@/lib/topic-studio/ai/results'
import { originalityView } from '@/lib/topic-studio/originality'
import { AiBtn } from './AiBtn'
import { PlacementsResult, ReviewResult } from './AiResults'
import { OriginalityTab } from './OriginalityTab'

const run = vi.mocked(ai.runAi)
const ON = { connected: true, on: {} }
beforeEach(() => { vi.clearAllMocks() })
afterEach(() => { cleanup() })

describe('AiBtn', () => {
  it('runs the feature, shows it is working, says what happened and refreshes the page', async () => {
    let finish: () => void = () => {}
    run.mockImplementationOnce(() => new Promise(res => { finish = () => res({ ok: true, model: 'm' }) }))
    render(<AiBtn id="t1" feature="group" ai={ON} label="Group with Claude" done="Grouped." />)
    fireEvent.click(screen.getByRole('button', { name: 'Group with Claude' }))
    expect(await screen.findByRole('button', { name: 'Claude is working…' })).toBeDisabled()
    finish()
    expect(run).toHaveBeenCalledWith('t1', 'group')
    expect(await screen.findByText('Grouped.')).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
  })
  it('rests with a reason until Claude is connected, and when an Admin has switched the feature off', () => {
    const { rerender } = render(<AiBtn id="t1" feature="group" ai={{ connected: false, on: {} }} label="Go" done="x" />)
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
    expect(screen.getByText('Not connected yet')).toBeTruthy()
    rerender(<AiBtn id="t1" feature="group" ai={{ connected: true, on: { group: false } }} label="Go" done="x" />)
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled()
    expect(screen.getByText('Switched off')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(run).not.toHaveBeenCalled()
  })
  it('shows the sentence when the run is refused', async () => {
    run.mockResolvedValueOnce({ ok: false, error: 'Wait a few seconds before running this again (9s).' })
    render(<AiBtn id="t1" feature="review" ai={ON} label="Review" done="Done." />)
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    expect(await screen.findByText(/Wait a few seconds/)).toBeTruthy()
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('results', () => {
  it('shows a review as guidance: ratings, fixes, opening and closing, section verdicts', () => {
    const r = readAiResults({ review: { at: 0, hash: 'h', criteria: [{ name: 'E-E-A-T', rating: 'needs work', summary: 'Thin on proof', fixes: ['Add a test result'] }], opening: { ok: true, note: 'Clear' }, closing: { ok: false, note: 'No takeaway' }, original: [{ type: 'story', excerpt: 'I burned wet wood', heading: 'Intro' }], sections: [{ heading: 'Why', verdict: 'commodity', note: 'Everyone says this' }] } }).review!
    render(<ReviewResult review={r} />)
    expect(screen.getByText('E-E-A-T')).toBeTruthy()
    expect(screen.getByText('Add a test result')).toBeTruthy()
    expect(screen.getByText('works')).toBeTruthy()
    expect(screen.getByText(/I burned wet wood/)).toBeTruthy()
    expect(screen.getByText('Commodity')).toBeTruthy()
  })
  it('shows placements and the terms to skip, or says there was nothing to add', () => {
    const { rerender } = render(<PlacementsResult placements={{ at: 1, list: [{ term: 'creosote', heading: 'Why seasoning matters', how: 'Add a sentence.' }], skip: [{ term: 'my own', reason: 'forced' }] }} />)
    expect(screen.getByText('creosote')).toBeTruthy()
    expect(screen.getByText('Better to skip')).toBeTruthy()
    rerender(<PlacementsResult placements={{ at: 1, list: [], skip: [] }} />)
    expect(screen.getByText('Claude found nothing to add.')).toBeTruthy()
  })
})

describe('OriginalityTab', () => {
  const view = originalityView(readAiResults({ commodity: { at: 1, baseline: [{ point: 'Everyone says A', sources: ['#1 a.com'] }], unique: [], gaps: [{ point: 'Nobody says B', why: 'a gap' }] }, opps: ['Show a reading'], angle: [], interview: { at: 1, who: ['A sawyer'], sme: ['What do you check?'], stories: [] }, interviewManual: [] }), 'test results')
  it('shows the map, the lists and the interview prompts, with the Claude buttons', () => {
    render(<OriginalityTab id="t1" view={view} ai={ON} />)
    expect(screen.getByText('Everyone says A')).toBeTruthy()
    expect(screen.getByText('a gap')).toBeTruthy()
    expect(screen.getByText('Show a reading')).toBeTruthy()
    expect(screen.getByText('What do you check?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Map again with Claude' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Draft interview prompts again' })).toBeTruthy()
  })
  it('saves a hand-written line as the whole list, and a removal as the list without it', async () => {
    render(<OriginalityTab id="t1" view={view} ai={ON} />)
    fireEvent.change(screen.getByLabelText('Add an opportunity'), { target: { value: 'Interview a sawyer' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])
    await waitFor(() => expect(orig.saveOriginality).toHaveBeenCalledWith('t1', { opps: ['Show a reading', 'Interview a sawyer'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove: Show a reading' }))
    await waitFor(() => expect(orig.saveOriginality).toHaveBeenLastCalledWith('t1', { opps: [] }))
  })
})
