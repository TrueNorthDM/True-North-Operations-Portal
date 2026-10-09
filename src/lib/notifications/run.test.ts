import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'
import { fakeAudience, recipient } from './__fakes__/audience'

const sinces: (string | null)[] = []
vi.mock('./audience', () => ({
  loadAudience: async () => fakeAudience([recipient('sa', { isAdmin: true, canTool: k => k === 'monday-accounts' })]),
}))
vi.mock('./generators', async importOriginal => {
  const real = await importOriginal<typeof import('./generators')>()
  return {
    ...real,
    workDrafts: async (_c: unknown, o: { since: string | null }) => { sinces.push(o.since); return [] },
    publishingDrafts: async () => [], i7Drafts: async () => [], firstLoginDrafts: async () => [],
  }
})

const { notifyAfterSync, notifyUnlinked } = await import('./run')

let fake: Fake
const tables = (extra: Record<string, Record<string, unknown>[]> = {}) => ({
  notifications: [], notification_rules: [], notification_prefs: [], person_settings: [], notification_state: [], ...extra,
})
const upto = () => fake.tables.notification_state.find(r => r.key === 'step-assigned-upto')?.value

beforeEach(() => { sinces.length = 0 })

describe('"a step was assigned" reads from where it left off (audit, 9 October 2026)', () => {
  it('the first run reads its own sync, then remembers where it got to', async () => {
    fake = fakeDb(tables())
    const now = new Date('2026-10-14T13:30:00Z')
    await notifyAfterSync({ since: '2026-10-14T13:15:00Z', now, db: fake.db })
    expect(sinces).toEqual(['2026-10-14T13:15:00Z'])
    expect(upto()).toBe(now.toISOString())
  })

  it('a later run reads from the last one, so a sync with no run in between is not lost', async () => {
    fake = fakeDb(tables({ notification_state: [{ key: 'step-assigned-upto', value: '2026-10-14T09:30:00.000Z' }] }))
    await notifyAfterSync({ since: '2026-10-14T13:15:00Z', now: new Date('2026-10-14T13:30:00Z'), db: fake.db })
    expect(sinces).toEqual(['2026-10-14T09:30:00.000Z'])
  })

  it('never reaches back more than three days', async () => {
    fake = fakeDb(tables({ notification_state: [{ key: 'step-assigned-upto', value: '2026-09-01T00:00:00.000Z' }] }))
    await notifyAfterSync({ since: '2026-10-14T13:15:00Z', now: new Date('2026-10-14T13:30:00Z'), db: fake.db })
    expect(sinces).toEqual(['2026-10-11T13:30:00.000Z'])
  })

  it('does not move on when the state cannot be read', async () => {
    fake = fakeDb(tables(), { fail: ['notification_state'] })
    const res = await notifyAfterSync({ since: '2026-10-14T13:15:00Z', now: new Date('2026-10-14T13:30:00Z'), db: fake.db })
    expect(res.failed.run).toMatch(/could not be read/)
    expect(sinces).toEqual([])
  })
})

describe('new Monday accounts are remembered only once they are told', () => {
  const unlinked = [{ id: 1, name: 'Old', email: null }, { id: 2, name: 'New', email: null }]

  it('tells about the new one, then saves both as seen', async () => {
    fake = fakeDb(tables({ notification_state: [{ key: 'monday-unlinked-seen', value: [1] }] }))
    await notifyUnlinked(fake.db, unlinked)
    expect(fake.tables.notifications.map(r => r.type_key)).toEqual(['monday-account-unlinked'])
    expect(fake.tables.notification_state.find(r => r.key === 'monday-unlinked-seen')?.value).toEqual([1, 2])
  })

  it('a delivery that fails saves nothing, so the next run tells again', async () => {
    fake = fakeDb(tables({ notification_state: [{ key: 'monday-unlinked-seen', value: [1] }] }),
      { rejectRow: t => t === 'notifications' })
    await notifyUnlinked(fake.db, unlinked)
    expect(fake.tables.notification_state.find(r => r.key === 'monday-unlinked-seen')?.value).toEqual([1])
  })
})
