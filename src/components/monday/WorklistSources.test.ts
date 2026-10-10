import { describe, it, expect } from 'vitest'
import { ago } from './WorklistSources'

const NOW = Date.parse('2026-10-10T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

describe('ago (audit, 10 October 2026)', () => {
  it('says today, then yesterday, then days', () => {
    expect(ago(daysAgo(0.5), NOW).text).toBe('today')
    expect(ago(daysAgo(1.2), NOW).text).toBe('yesterday')
    expect(ago(daysAgo(2), NOW).text).toBe('2d ago')
  })

  it('turns amber at the age the activity rule hides a board', () => {
    expect(ago(daysAgo(150), NOW).stale).toBe(false)
    expect(ago(daysAgo(185), NOW).stale).toBe(true)
    expect(ago(null, NOW)).toEqual({ text: 'never', stale: true })
  })
})
