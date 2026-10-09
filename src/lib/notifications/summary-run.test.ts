import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'
import { TYPE_BY_KEY } from './catalogue'
import type { Audience } from './audience'
import { fakeAudience as makeAudience, recipient as person } from './__fakes__/audience'
import type { SendResult } from '@/lib/email/resend'

// Who receives, and the email service, are the two things this test plays.
let audience: () => Audience
const sent: { to: string; subject: string; idempotencyKey?: string }[] = []
let answer: () => SendResult = () => ({ sent: true })
vi.mock('./audience', () => ({ loadAudience: async () => audience() }))
vi.mock('@/lib/email/resend', () => ({
  sendEmail: async (m: { to: string; subject: string; idempotencyKey?: string }) => { sent.push(m); return answer() },
}))

const { sendDailySummaries, MAX_ATTEMPTS } = await import('./summary')

// Wednesday 14 October 2026, 9:30 in New York (13:30 UTC): past 8:00, a working day.
const NOW = new Date('2026-10-14T13:30:00Z')
const LANDED = '2026-10-14T12:00:00.000Z'
let n = 0
const row = (person_id: string, type_key: string, over: Record<string, unknown> = {}) => ({
  id: `n${++n}`, person_id, type_key, title: `${type_key} title`, body: 'body', href: '/my-work',
  timing: 'daily', deliver_at: LANDED, emailed_at: null, ...over,
})

let fake: Fake
function seed(notifications: ReturnType<typeof row>[], extra: Record<string, Record<string, unknown>[]> = {}) {
  fake = fakeDb({ notifications, notification_digests: [], notification_rules: [], notification_prefs: [], person_settings: [], ...extra },
    { unique: { notification_digests: ['person_id', 'category', 'local_day'] } })
}
const run = (now = NOW) => sendDailySummaries({ origin: 'https://portal.test', now, db: fake.db, paceMs: 0 })
const emailed = (id: string) => fake.tables.notifications.find(r => r.id === id)?.emailed_at != null

beforeEach(() => {
  sent.length = 0
  answer = () => ({ sent: true })
  audience = () => makeAudience([person('ana'), person('bo')])
})

describe('the daily summary run (audit, 9 October 2026)', () => {
  it('sends one email per category, marks the rows emailed, and nothing twice the same day', async () => {
    seed([row('ana', 'step-late'), row('ana', 'step-due-tomorrow'), row('ana', 'monday-account-unlinked')])
    audience = () => makeAudience([person('ana', { canTool: k => k === 'monday-accounts' })])
    const first = await run()
    expect(first).toMatchObject({ sent: 2, failed: 0, errors: [] })
    expect(sent.map(s => s.idempotencyKey).sort()).toEqual(['summary:ana:system:2026-10-14', 'summary:ana:tools:2026-10-14'])
    expect(fake.tables.notifications.every(r => r.emailed_at)).toBe(true)

    fake.tables.notifications.push(row('ana', 'step-late'))
    const second = await run(new Date('2026-10-14T15:00:00Z'))
    expect(second.sent).toBe(0)
    expect(sent).toHaveLength(2)
  })

  // The High finding: a failed audience read used to let everyone's rows go.
  it('stops with an error when the audience cannot be read, and lets nothing go', async () => {
    seed([row('ana', 'step-late')])
    audience = () => { throw new Error('The notification audience could not be read: 403') }
    const r = await run()
    expect(r.errors[0]).toMatch(/could not be read/)
    expect(r.letGo).toBe(0)
    expect(emailed('n' + n)).toBe(false)
    expect(sent).toHaveLength(0)
  })

  it('lets go the rows of someone no longer in the audience (inactive, not invited)', async () => {
    seed([row('gone', 'step-late')])
    const r = await run()
    expect(r.letGo).toBe(1)
    expect(sent).toHaveLength(0)
  })

  it('goes by each person\'s own calendar: Monday in Sydney is still Sunday in New York', async () => {
    // Monday 19 October 9:30 in Sydney is Sunday 18 October 18:30 in New York.
    // (Not the week before: Monday 12 October is Columbus Day, a US holiday.)
    const sunday = new Date('2026-10-18T22:30:00Z')
    seed([row('syd', 'step-late', { deliver_at: '2026-10-18T22:00:00Z' }), row('ny', 'step-late', { deliver_at: '2026-10-18T22:00:00Z' })],
      { person_settings: [{ person_id: 'syd', time_zone: 'Australia/Sydney' }] })
    audience = () => makeAudience([person('syd'), person('ny')])
    const r = await run(sunday)
    expect(sent.map(s => s.to)).toEqual(['syd@goodnewsadvocates.org'])
    expect(r.notYet).toBe(1)
  })

  it('waits for the person\'s hour', async () => {
    seed([row('ana', 'step-late')], { person_settings: [{ person_id: 'ana', summary_hour: 10 }] })
    const r = await run()
    expect(r).toMatchObject({ sent: 0, notYet: 1 })
  })

  it('leaves out what was turned off since it was queued, and keeps it in the bell', async () => {
    seed([row('ana', 'step-late'), row('ana', 'step-due-tomorrow')],
      { notification_prefs: [{ person_id: 'ana', type_key: 'step-late', enabled: false, timing: null }] })
    const r = await run()
    expect(r.sent).toBe(1)
    expect(r.letGo).toBe(1)
    // Let go means not emailed again, not deleted: the row is still there.
    expect(fake.tables.notifications).toHaveLength(2)
  })

  it('leaves out a type the person no longer reaches (lost the tool)', async () => {
    seed([row('ana', 'i7-budget')])
    const r = await run()
    expect(r.sent).toBe(0)
    expect(r.letGo).toBe(1)
  })

  it('does not send when another run holds a fresh claim', async () => {
    seed([row('ana', 'step-late')], {
      notification_digests: [{ person_id: 'ana', category: 'tools', local_day: '2026-10-14', status: 'sending', attempts: 1, updated_at: '2026-10-14T13:25:00.000Z' }],
    })
    await run()
    expect(sent).toHaveLength(0)
  })

  it('a busy email service does not use up a try; a real failure does, three at most', async () => {
    seed([row('ana', 'step-late')])
    answer = () => ({ sent: false, reason: 'rate limited', busy: true })
    const busy = await run()
    expect(busy.failed).toBe(1)
    expect(fake.tables.notification_digests[0]).toMatchObject({ status: 'failed', attempts: 0 })

    answer = () => ({ sent: false, reason: 'address refused' })
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await run(new Date(NOW.getTime() + (i + 1) * 15 * 60_000))
    expect(fake.tables.notification_digests[0]).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS })
    expect(sent).toHaveLength(1 + MAX_ATTEMPTS)
  })

  it('on staging (blocked) writes it down as skipped and lets the rows go', async () => {
    seed([row('ana', 'step-late')])
    answer = () => ({ sent: false, reason: 'staging', blocked: true })
    const r = await run()
    expect(fake.tables.notification_digests[0].status).toBe('skipped')
    expect(r.letGo).toBe(1)
  })

  it('every type it checks is a real catalogue type', () => {
    for (const k of ['step-late', 'step-due-tomorrow', 'monday-account-unlinked', 'i7-budget']) expect(TYPE_BY_KEY.has(k)).toBe(true)
  })
})
