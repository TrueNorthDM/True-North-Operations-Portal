import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// The safety job acts only on North Time's own clocks, from each person's
// start date in their own zone (audit, 5 November 2026): a clock the import
// copied from TSheets is never stopped or marked changed.

const calls = vi.hoisted(() => ({ stopped: [] as number[], starts: new Map<string, string>(), startsFail: false }))
vi.mock('@/lib/notifications/run', () => ({ notifyClockyAutoStops: async () => null }))
vi.mock('./clocky-notify', () => ({ announceClockStop: async () => {} }))
vi.mock('./pay-terms', () => ({ loadPayTerms: async () => new Map() }))
vi.mock('./allowance-limit', () => ({
  stopClockIfDue: async (_c: unknown, e: { id: number }) => { calls.stopped.push(e.id); return { kind: 'safety', stop: {} } },
}))
vi.mock('./waves-data', () => ({
  loadStartDates: async () => { if (calls.startsFail) throw new Error('The North Time rollout dates could not be read: boom'); return calls.starts },
}))
vi.mock('./clocky-context', () => ({
  loadCatalog: async () => ({}),
  loadDirectory: async () => ({ zoneOf: (id: string) => (id === 'tok' ? 'Asia/Tokyo' : 'America/New_York') }),
  allRows: async (page: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
    const { data, error } = await page(0, 999)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}))

const { runClockSafety, clocksToWatch } = await import('./clocky-safety-run')

// 13 hours on the clock by 21 Nov 18:00Z: past the 12-hour mark.
const START = '2026-11-21T05:00:00.000Z'
const clock = (id: number, person: string, source: 'portal' | 'tsheets') => ({
  id, person_id: person, source, kind: 'clock', started_at: START, ended_at: null, window_started_at: START, session_started_at: START,
  started_at_real: START, entry_date: '2026-11-21', jobcode_id: 1, fields: {}, notes: null,
})

let fake: Fake
beforeEach(() => {
  calls.stopped = []
  calls.startsFail = false
  calls.starts = new Map([['ana', '2026-11-08'], ['bo', '2026-11-22'], ['tok', '2026-11-22']])
  fake = fakeDb({
    tc_entries: [
      clock(1, 'ana', 'portal'),    // started on Nov 8: stopped
      clock(2, 'ana2', 'tsheets'),  // a TSheets clock: never
      clock(3, 'bo', 'portal'),     // wave 2, before Nov 22 in New York: left alone
      clock(4, 'ed', 'portal'),     // no wave or no date: left alone
      clock(5, 'tok', 'portal'),    // wave 2, already Nov 22 in Tokyo: stopped
    ],
  })
})

describe('runClockSafety', () => {
  it('stops only North Time\'s own clocks of people whose start date has arrived in their own zone', async () => {
    const r = await runClockSafety(fake.db as never, { now: new Date('2026-11-21T18:00:00.000Z'), origin: 'https://x' })
    expect(calls.stopped.sort()).toEqual([1, 5])
    expect(r.running).toBe(2)
    expect(r.stopped).toBe(2)
    expect(r.errors).toEqual([])
  })

  it('never touches a TSheets clock, even of someone who started', async () => {
    fake.tables.tc_entries = [clock(9, 'ana', 'tsheets')]
    const r = await runClockSafety(fake.db as never, { now: new Date('2026-11-21T18:00:00.000Z'), origin: 'https://x' })
    expect(calls.stopped).toEqual([])
    expect(r.running).toBe(0)
    expect(fake.writes).toEqual([])
  })

  it('an unread start date fails the run instead of acting on everyone', async () => {
    calls.startsFail = true
    await expect(runClockSafety(fake.db as never, { now: new Date('2026-11-21T18:00:00.000Z'), origin: 'https://x' })).rejects.toThrow(/could not be read/)
    expect(calls.stopped).toEqual([])
  })
})

describe('clocksToWatch', () => {
  it('filters by source and by the start date in each person\'s zone', () => {
    const rows = [clock(1, 'ana', 'portal'), clock(2, 'ana', 'tsheets'), clock(3, 'bo', 'portal'), clock(5, 'tok', 'portal')]
    const zoneOf = (id: string) => (id === 'tok' ? 'Asia/Tokyo' : 'America/New_York')
    const ids = (now: string) => clocksToWatch(rows as never[], calls.starts, zoneOf, new Date(now)).map((e: { id: number }) => e.id)
    expect(ids('2026-11-21T18:00:00.000Z')).toEqual([1, 5])
    expect(ids('2026-11-22T06:00:00.000Z')).toEqual([1, 3, 5])
  })
})
