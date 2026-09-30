import { describe, it, expect } from 'vitest'
import { retryDecision, selectAllPages, goneBoards, MAX_ATTEMPTS } from './resilience'

describe('retryDecision', () => {
  it('tries a network failure again, waiting longer each time', () => {
    expect(retryDecision({ network: true }, 1)).toEqual({ retry: true, waitMs: 2000 })
    expect(retryDecision({ network: true }, 2)).toEqual({ retry: true, waitMs: 4000 })
  })

  it('stops after the last attempt', () => {
    expect(retryDecision({ network: true }, MAX_ATTEMPTS).retry).toBe(false)
  })

  it('waits for the complexity budget to reset, as Monday says', () => {
    const d = retryDecision({ status: 200, messages: ['Complexity budget exhausted, query cost 30001 budget remaining 12 out of 1000000 reset in 23 seconds'] }, 1)
    expect(d).toEqual({ retry: true, waitMs: 24_000 })
  })

  it('honours Retry-After on a 429, within a ceiling', () => {
    expect(retryDecision({ status: 429, retryAfterSeconds: 5 }, 1)).toEqual({ retry: true, waitMs: 6000 })
    expect(retryDecision({ status: 429, retryAfterSeconds: 600 }, 1).waitMs).toBe(30_000)
  })

  it('tries server errors again', () => {
    expect(retryDecision({ status: 502 }, 1).retry).toBe(true)
  })

  it('does not retry a query Monday refuses', () => {
    expect(retryDecision({ status: 200, messages: ['Field "foo" doesn\'t exist on type "Board"'] }, 1).retry).toBe(false)
    expect(retryDecision({ status: 401, messages: ['Not Authenticated'] }, 1).retry).toBe(false)
  })
})

describe('selectAllPages', () => {
  const table = Array.from({ length: 2345 }, (_, i) => i)
  const page = async (from: number, to: number) => ({ data: table.slice(from, to + 1), error: null })

  it('reads past the 1,000-row page', async () => {
    const { data, error } = await selectAllPages(page)
    expect(error).toBeNull()
    expect(data).toHaveLength(2345)
    expect(data[2344]).toBe(2344)
  })

  it('stops on an exact multiple of the page size', async () => {
    const exact = Array.from({ length: 2000 }, (_, i) => i)
    let calls = 0
    const { data } = await selectAllPages(async (from, to) => { calls++; return { data: exact.slice(from, to + 1), error: null } })
    expect(data).toHaveLength(2000)
    expect(calls).toBe(3)
  })

  it('returns the error with what it had read', async () => {
    const { data, error } = await selectAllPages(async (from) => from === 0
      ? { data: table.slice(0, 1000), error: null }
      : { data: null, error: { message: 'boom' } })
    expect(data).toHaveLength(1000)
    expect(error?.message).toBe('boom')
  })
})

describe('goneBoards', () => {
  const known = [
    { id: 1, goneAt: null }, { id: 2, goneAt: null }, { id: 3, goneAt: null }, { id: 4, goneAt: '2026-09-01T00:00:00Z' },
  ]

  it('marks what Monday stopped listing and brings back what returned', () => {
    expect(goneBoards(known, new Set([1, 2, 4]))).toEqual({ gone: [3], back: [4] })
  })

  it('refuses when the listing looks cut short', () => {
    const r = goneBoards(known, new Set([1]))
    expect(r.gone).toEqual([])
    expect(r.refused).toMatch(/not marking any/)
  })

  it('does nothing when everything is there', () => {
    expect(goneBoards(known, new Set([1, 2, 3]))).toEqual({ gone: [], back: [] })
  })
})
