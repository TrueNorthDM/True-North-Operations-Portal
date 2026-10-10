import { describe, it, expect } from 'vitest'
import { healthSummary } from './summary'
import type { HealthResult } from './checks'

// What the health results add up to (audit, 10 October 2026).

const NOW = new Date('2026-10-10T12:00:00Z')
const row = (service: string, status: HealthResult['status'], at = '2026-10-10T10:00:00Z'): HealthResult =>
  ({ service, ok: status === 'ok', status, detail: `${service} ${status}`, checked_at: at })

describe('healthSummary', () => {
  it('counts every service and shows a warning, not only a failure', () => {
    const s = healthSummary({ a: row('monday_events', 'warn'), b: row('monday_api', 'ok') }, NOW)
    expect(s.status).toBe('warn')
    expect(s.problems.map(p => p.service)).toEqual(['monday_events'])
  })

  it('puts failures first', () => {
    const s = healthSummary({ a: row('monday_events', 'warn'), b: row('db_protections', 'down') }, NOW)
    expect(s.status).toBe('down')
    expect(s.problems[0].service).toBe('db_protections')
  })

  // A health job that stopped kept the page green with an old date.
  it('turns results older than nine hours into a failure of their own', () => {
    const s = healthSummary({ a: row('monday_api', 'ok', '2026-10-09T20:00:00Z') }, NOW)
    expect(s.stale).toBe(true)
    expect(s.status).toBe('down')
  })
})
