import { describe, expect, it, vi } from 'vitest'

vi.mock('./clocky-context', () => ({ allRows: vi.fn(), db: vi.fn(), loadCatalog: vi.fn(), must: vi.fn() }))
vi.mock('./allowance-data', () => ({ loadAllowanceUse: vi.fn(), loadApprovedExtra: vi.fn() }))
vi.mock('./pay-terms', async () => {
  const actual = await vi.importActual<typeof import('./pay-terms')>('./pay-terms')
  return { ...actual, loadPayTerms: vi.fn(), loadRoutes: vi.fn(), loadRequestDeciders: vi.fn() }
})

import { decidersText, decidesRequest, readOnlyLine } from './request-cards'

const viewer = (personId: string) => ({ personId })

describe('who decides a request (owner, 1 November 2026: the routing, "Who approves what")', () => {
  it('a decider the routing names decides, never their own', () => {
    expect(decidesRequest(viewer('dave'), ['dave'], 'ana')).toBe(true)
    expect(decidesRequest(viewer('tina'), ['dave', 'tina'], 'ana')).toBe(true)
    expect(decidesRequest(viewer('dave'), ['dave'], 'dave')).toBe(false)
  })
  it('a Super Admin or Finance the routing does not name decides nothing', () => {
    expect(decidesRequest(viewer('arnaldo'), ['dave'], 'ana')).toBe(false)
    expect(decidesRequest(viewer('tina'), ['arnaldo'], 'ana')).toBe(false)
    expect(decidesRequest(viewer('bo'), [], 'ana')).toBe(false)
  })
  it('everyone else reads whose decision it is', () => {
    const names: Record<string, string> = { dave: 'David Sharpe', arnaldo: 'Arnaldo Oliveira' }
    expect(decidersText(['dave'], id => names[id])).toBe('David Sharpe')
    expect(decidersText(['arnaldo', 'dave'], id => names[id])).toBe('Arnaldo Oliveira or David Sharpe')
    expect(readOnlyLine(false, true, 'David Sharpe')).toBe('Read only. David Sharpe decides it.')
    expect(readOnlyLine(true, true, 'Arnaldo Oliveira')).toBe('Your own request. Arnaldo Oliveira decides it.')
    expect(readOnlyLine(false, false, 'David Sharpe')).toBeNull()
    expect(readOnlyLine(false, true, '')).toMatch(/^Nobody can decide it yet/)
  })
})
