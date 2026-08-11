import { describe, it, expect } from 'vitest'
import { watermark } from './source'

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
