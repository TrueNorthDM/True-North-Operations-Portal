import { describe, expect, it, vi } from 'vitest'

vi.mock('./clocky-context', () => ({ allRows: vi.fn(), db: vi.fn(), loadCatalog: vi.fn(), must: vi.fn() }))
vi.mock('./allowance-data', () => ({ loadAllowanceUse: vi.fn(), loadApprovedExtra: vi.fn() }))
vi.mock('./pay-terms', async () => {
  const actual = await vi.importActual<typeof import('./pay-terms')>('./pay-terms')
  return { ...actual, loadPayTerms: vi.fn(), loadRoutes: vi.fn() }
})

import type { Viewer } from './clocky-context'
import { decidesRequest } from './request-cards'

const viewer = (personId: string, keys: string[]) => ({ personId, can: (k: string) => keys.includes(k) }) as unknown as Viewer
const settings = { finance: ['tina'] }

describe('who decides a request (owner, 29 October 2026: Finance decides reimbursements)', () => {
  it('Finance decides a reimbursement, never their own', () => {
    expect(decidesRequest(viewer('tina', []), 'rmb', 'ana', settings)).toBe(true)
    expect(decidesRequest(viewer('tina', []), 'rmb', 'tina', settings)).toBe(false)
  })
  it('Finance does not decide extra hours or time off', () => {
    expect(decidesRequest(viewer('tina', []), 'xh', 'ana', settings)).toBe(false)
    expect(decidesRequest(viewer('tina', []), 'off', 'ana', settings)).toBe(false)
  })
  it('Super Admins keep every kind, never their own', () => {
    const sa = viewer('arnaldo', ['rq-decide', 'ck-timeoff'])
    expect(decidesRequest(sa, 'rmb', 'ana', settings)).toBe(true)
    expect(decidesRequest(sa, 'xh', 'ana', settings)).toBe(true)
    expect(decidesRequest(sa, 'off', 'ana', settings)).toBe(true)
    expect(decidesRequest(sa, 'rmb', 'arnaldo', settings)).toBe(false)
  })
  it('anyone else decides nothing', () => {
    expect(decidesRequest(viewer('bo', []), 'rmb', 'ana', settings)).toBe(false)
  })
})
