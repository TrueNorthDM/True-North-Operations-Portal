import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { fakeAudience, recipient } from './__fakes__/audience'
import type { PublishingBoardWeeks } from '@/lib/boards/publishing-weeks'

// T6, behind pace, for a board counted in two-week cycles (15 October 2026):
// the cycle still running, judged over its ten working days.

const weeks = vi.hoisted(() => ({ boards: [] as unknown[], updatedAt: null as string | null, mode: '' }))
vi.mock('@/lib/boards/publishing-weeks', () => ({
  loadPublishingWeeks: async (_now: Date, mode: string) => { weeks.mode = mode; return { boards: weeks.boards, updatedAt: weeks.updatedAt } },
}))

const { expectedInCycle, expectedSoFar, makeCtx, publishingDrafts } = await import('./generators')

const board = (over: Partial<PublishingBoardWeeks>): PublishingBoardWeeks => ({
  boardId: '1764094550', name: 'Bessemeters', cycleWeeks: 2, perPeriod: 10, enPerPeriod: 10,
  weeks: [{ start: '2026-10-12', label: 'Oct 12 to Oct 25', done: 3, target: 10, en: { done: 3, target: 10 }, untargeted: 0 }],
  hits: 0, enHits: 0, firstCycleEnds: null, ...over,
})

describe('expectedInCycle', () => {
  it('spreads the target over the ten working days, the weekend closing its week', () => {
    expect(expectedInCycle(10, '2026-10-12', '2026-10-12')).toBe(0)   // first Monday
    expect(expectedInCycle(10, '2026-10-12', '2026-10-15')).toBe(3)   // first Thursday
    expect(expectedInCycle(10, '2026-10-12', '2026-10-18')).toBe(5)   // first Sunday
    expect(expectedInCycle(10, '2026-10-12', '2026-10-21')).toBe(7)   // second Wednesday
    expect(expectedInCycle(1, '2026-10-12', '2026-10-21')).toBe(0)    // 1 page: nothing due until the end
    expect(expectedInCycle(1, '2026-10-12', '2026-10-24')).toBe(1)    // second Saturday
  })
})

describe('publishingDrafts', () => {
  // Wednesday 21 October 2026, 9:30 AM in New York: the first cycle's second week.
  const NOW = new Date('2026-10-21T13:30:00Z')
  const reader = recipient('ana', { canTool: k => k === 'publishing' })
  const ctx = () => makeCtx(fakeDb({}).db, fakeAudience([reader, recipient('bo')]), NOW)

  beforeEach(() => {
    weeks.updatedAt = '2026-10-21T13:00:00Z'
  })

  it('judges a two-week board on its cycle, keyed by board and cycle start', async () => {
    weeks.boards = [board({})]
    const ds = await publishingDrafts(ctx())
    expect(weeks.mode).toBe('current')
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({
      personId: 'ana',
      body: 'Bessemeters: 3 of 10 published this cycle, 7 expected by now.',
      dedupeKey: '1764094550:2026-10-12',
    })
  })

  it('says nothing for a cycle on pace', async () => {
    weeks.boards = [board({ weeks: [{ start: '2026-10-12', label: '', done: 7, target: 10, en: null, untargeted: 0 }] })]
    expect(await publishingDrafts(ctx())).toEqual([])
  })

  it('keeps the weekly rule for a weekly board', async () => {
    weeks.boards = [board({
      boardId: '462251934', name: 'AskAnAdventistFriend', cycleWeeks: 1, perPeriod: 10,
      weeks: [{ start: '2026-10-19', label: 'Oct 19-25', done: 3, target: 10, en: null, untargeted: 0 }],
    })]
    const ds = await publishingDrafts(ctx())
    expect(expectedSoFar(10, '2026-10-21')).toBe(4)
    expect(ds[0]).toMatchObject({
      body: 'AskAnAdventistFriend: 3 of 10 published this week, 4 expected by now.',
      dedupeKey: '462251934:2026-10-19',
    })
  })

  it('says nothing on a stale read', async () => {
    weeks.boards = [board({})]
    weeks.updatedAt = '2026-10-20T13:00:00Z'
    expect(await publishingDrafts(ctx())).toEqual([])
  })
})
