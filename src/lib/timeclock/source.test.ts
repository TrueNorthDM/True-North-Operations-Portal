import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllUsers, watermark } from './source'

describe('watermark', () => {
  // TSheets answers 417 to any fractional seconds. Both obvious sources produce
  // them, which is why this exists at all.
  it('strips the microseconds Postgres hands back', () => {
    expect(watermark('2026-08-05T17:12:33.123456+00:00')).toBe('2026-08-05T17:12:33Z')
  })

  it('strips the milliseconds toISOString adds', () => {
    expect(watermark('2026-08-05T17:12:33.123Z')).toBe('2026-08-05T17:12:33Z')
  })

  it('leaves an already clean instant alone', () => {
    expect(watermark('2026-08-05T17:12:33Z')).toBe('2026-08-05T17:12:33Z')
  })

  it('converts an offset to UTC rather than passing it through', () => {
    expect(watermark('2026-08-05T13:12:33-04:00')).toBe('2026-08-05T17:12:33Z')
  })

  it('never returns something unparseable, whatever it was given', () => {
    expect(watermark('not a date')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  })

  it('never leaves a fraction behind, for any input', () => {
    for (const v of [
      '2026-08-05T17:12:33.1+00:00',
      '2026-08-05T17:12:33.999999Z',
      '2026-01-01T00:00:00.000Z',
      '',
    ]) {
      expect(watermark(v)).not.toMatch(/\./)
    }
  })
})

describe('a call QuickBooks Time never answers (audit, 13 October 2026)', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('gives up with a sentence that says so, and sends a time limit', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    vi.stubGlobal('fetch', fetch)
    await expect(fetchAllUsers('t')).rejects.toThrow('TSheets /users: QuickBooks Time did not answer within 30 seconds')
  })

  it('passes any other failure through as it was', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    await expect(fetchAllUsers('t')).rejects.toThrow('TSheets /users: HTTP 503')
  })
})
