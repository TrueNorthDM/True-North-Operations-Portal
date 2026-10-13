import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchUsers } from './client'

describe('a call QuickBooks Time never answers (audit, 13 October 2026)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('gives up with a sentence that says so, and sends a time limit', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    vi.stubGlobal('fetch', fetch)
    await expect(fetchUsers('t')).rejects.toThrow('TSheets API /users: QuickBooks Time did not answer within 30 seconds')
  })

  it('passes any other failure through as it was', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(fetchUsers('t')).rejects.toThrow('TSheets API /users: HTTP 503')
  })
})
