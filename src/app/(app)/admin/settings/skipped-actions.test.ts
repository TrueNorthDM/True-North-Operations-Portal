import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// Company settings > North Time rollout > Clocked in TSheets after switching:
// counting or discarding an entry set aside (owner, 27 October 2026).

let fake: Fake
let granted = new Set<string>()
let refusal: string | null = null
const limitCalls: { personId: string; change: { add: { day: string; seconds: number }[] }; name: string | null }[] = []

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async (k: string) => granted.has(k) }))
vi.mock('@/lib/auth/session', () => ({ getRealPerson: async () => ({ id: 'boss', full_name: 'Ben Admin' }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
// North Time open here; the lock's own test covers it closed (north-time-lock.test.ts).
const lock = { open: true }
vi.mock('@/lib/timeclock/north-time-lock', () => ({ closedRefusal: async (f: (e: string) => unknown) => (lock.open ? null : f('North Time is not open yet.')) }))
// The limit itself is allowance-limit.ts's (allowance.test.ts); here, only what the decision asks of it.
vi.mock('@/lib/timeclock/allowance-limit', () => ({
  limitRefusal: async (personId: string, change: never, _now: Date, name: string | null) => { limitCalls.push({ personId, change, name }); return refusal },
}))

const { decideSkipped } = await import('./skipped-actions')

const ANA = 'ana'
const WORK = 5, VACATION = 6
const raw = (id: number, over: Record<string, unknown> = {}) => ({
  id, user_id: 900, jobcode_id: 5005, start: '2026-11-09T13:00:00-05:00', end: '2026-11-09T15:00:00-05:00', duration: 7200,
  date: '2026-11-09', type: 'regular', state: 'APPROVED', locked: 0, on_the_clock: false, notes: 'SEO audit', customfields: { 71: 'SEO' }, ...over,
})
const aside = (id: number, over: Record<string, unknown> = {}) => ({
  external_id: id, person_id: ANA, tsheets_user_id: 900, entry_date: '2026-11-09', starts_on: '2026-11-08', duration_seconds: 7200,
  started_at: '2026-11-09T13:00:00-05:00', ended_at: '2026-11-09T15:00:00-05:00', jobcode_id: WORK, kind: 'clock', state: 'approved',
  raw: raw(id), already_in_entries: false, deleted_in_tsheets_at: null, decided_at: null, decided_by: null, decision: null, ...over,
})
const row = (id: number) => fake.tables.tc_import_skipped.find(r => r.external_id === id)!
const entriesOf = (id: number) => fake.tables.tc_entries.filter(r => r.external_id === id)
const logged = () => fake.tables.settings_change_log ?? []

beforeEach(() => {
  granted = new Set(['cs-rollout-decide'])
  lock.open = true
  refusal = null
  limitCalls.length = 0
  fake = fakeDb({
    tc_import_skipped: [
      aside(101),
      aside(102, { raw: raw(102, { date: '2026-11-10' }), entry_date: '2026-11-10' }),
      aside(103, { deleted_in_tsheets_at: '2026-11-11T00:00:00Z' }),
      aside(104, { kind: 'clock', ended_at: null, raw: raw(104, { end: '', on_the_clock: true }) }),
      aside(105, { raw: raw(105, { jobcode_id: 6006, duration: 28800 }), jobcode_id: VACATION, kind: 'absence', duration_seconds: 28800 }),
      aside(106, { raw: raw(106, { user_id: 999 }) }),
      aside(107, { already_in_entries: true }),
      aside(108, { raw: raw(108, { date: '2026-10-30' }), entry_date: '2026-10-30' }),
      aside(109, { decided_at: '2026-11-12T10:00:00Z', decided_by: 'carla', decision: 'dismissed' }),
    ],
    tc_entries: [{ id: 1, external_id: 107, person_id: ANA, entry_date: '2026-11-09', duration_seconds: 7200 }],
    tc_jobcodes: [{ id: WORK, external_id: 5005, kind: 'regular' }, { id: VACATION, external_id: 6006, kind: 'pto' }],
    tc_user_links: [{ tsheets_user_id: 900, person_id: ANA }],
    tc_fields: [{ id: 3, external_id: 71, name: 'Activity' }],
    tc_submissions: [{ id: 1, person_id: ANA, period_id: 10, state: 'submitted' }],
    tc_periods: [{ id: 10, start_date: '2026-10-01', end_date: '2026-10-31', kind: 'month' }],
    tc_entry_audit: [],
    people: [{ id: ANA, full_name: 'Ana Lima' }, { id: 'carla', full_name: 'Carla Souza' }, { id: 'boss', full_name: 'Ben Admin' }],
  }, { unique: { tc_entries: ['external_id'] } })
})

describe('who may decide', () => {
  it('needs the right to decide, and writes nothing without it', async () => {
    granted = new Set(['cs-rollout'])
    expect(await decideSkipped({ ids: [101], choice: 'count' })).toEqual({ ok: false, error: 'Only Super Admins and Admins decide these entries.' })
    expect(fake.writes).toEqual([])
  })

  it('refuses while North Time is closed, and writes nothing', async () => {
    lock.open = false
    expect(await decideSkipped({ ids: [101], choice: 'count' })).toEqual({ ok: false, error: 'North Time is not open yet.' })
    expect(fake.writes).toEqual([])
  })

  it('checks the request on the server', async () => {
    expect((await decideSkipped({ ids: [], choice: 'count' })).ok).toBe(false)
    expect((await decideSkipped({ ids: [101], choice: 'keep' as never })).ok).toBe(false)
    expect(fake.writes).toEqual([])
  })
})

describe('Count it', () => {
  it('writes the import\'s own row, open, under the TSheets id, and keeps who, when and the choice', async () => {
    const r = await decideSkipped({ ids: [101], choice: 'count' })
    expect(r).toEqual({ ok: true, toast: 'Counted 1 entry.', results: [{ id: 101, outcome: 'done', text: 'Counted.' }] })
    const [e] = entriesOf(101)
    expect(e).toMatchObject({
      external_id: 101, person_id: ANA, jobcode_id: WORK, source: 'tsheets', state: 'open', kind: 'clock',
      entry_date: '2026-11-09', duration_seconds: 7200, notes: 'SEO audit', fields: { 3: 'SEO' },
    })
    expect(e.changed_here_at).toBeTruthy()
    expect(row(101)).toMatchObject({ decision: 'imported', decided_by: 'boss', decision_reason: null, counted_entry_id: e.id })
    expect(row(101).decided_at).toBeTruthy()
    expect(fake.tables.tc_entry_audit).toEqual([expect.objectContaining({ entry_id: e.id, action: 'imported', changed_by: 'boss' })])
    expect(logged()).toEqual([expect.objectContaining({ setting: 'north_time_tsheets_entry', action: 'Ana Lima, Nov 9, 2026: TSheets entry #101 counted', actor_person_id: 'boss', actor_name: 'Ben Admin' })])
    expect(limitCalls).toEqual([{ personId: ANA, change: { add: [{ day: '2026-11-09', seconds: 7200 }] }, name: 'Ana Lima' }])
  })

  it('a second click does nothing and says so', async () => {
    await decideSkipped({ ids: [101], choice: 'count' })
    const writes = fake.writes.length
    const r = await decideSkipped({ ids: [101], choice: 'count' })
    expect(r).toMatchObject({ ok: true, results: [{ id: 101, outcome: 'already' }] })
    expect(r.ok && r.results[0].text).toMatch(/^Already decided: Counted by Ben Admin on .+\. Nothing changed\.$/)
    expect(entriesOf(101)).toHaveLength(1)
    expect(fake.writes.length).toBe(writes)
  })

  it('refuses when Time entries already holds the same TSheets id', async () => {
    const r = await decideSkipped({ ids: [107], choice: 'count' })
    expect(r).toMatchObject({ ok: true, results: [{ id: 107, outcome: 'refused', text: expect.stringMatching(/already holds this TSheets entry/) }] })
    expect(entriesOf(107)).toHaveLength(1)
    expect(row(107).decided_at).toBeNull()
  })

  it('refuses in a period the person already submitted', async () => {
    const r = await decideSkipped({ ids: [108], choice: 'count' })
    expect(r).toMatchObject({ ok: true, results: [{ id: 108, outcome: 'refused', text: 'For Ana Lima, October is submitted. Ask a Super Admin to reopen it.' }] })
    expect(entriesOf(108)).toEqual([])
    expect(row(108).decided_at).toBeNull()
  })

  it('refuses an entry deleted in TSheets, one still running, and one that no longer matches its person', async () => {
    const r = await decideSkipped({ ids: [103, 104, 106], choice: 'count' })
    expect(r.ok && r.results.map(x => x.outcome)).toEqual(['refused', 'refused', 'refused'])
    expect(r.ok && r.toast).toBe('3 entries could not be counted.')
    expect(fake.tables.tc_entries).toHaveLength(1)
    expect(logged()).toEqual([])
  })

  it('past the allowance: shows the line, writes nothing, and asks for a reason', async () => {
    refusal = 'That puts Ana Lima past the allowance of 40h for the week of Nov 8.'
    const r = await decideSkipped({ ids: [101], choice: 'count', reason: 'because' })
    expect(r).toMatchObject({ ok: true, results: [{ id: 101, outcome: 'needs-reason', text: refusal }] })
    expect(entriesOf(101)).toEqual([])
    expect(row(101).decided_at).toBeNull()
    expect(fake.writes).toEqual([])
  })

  it('past the allowance with the reason: the whole entry, never cut, the reason kept', async () => {
    refusal = 'That puts Ana Lima past the allowance of 40h for the week of Nov 8.'
    const r = await decideSkipped({ ids: [101], choice: 'count', reason: 'Approved by Ben on the phone', pastAllowance: true })
    expect(r).toMatchObject({ ok: true, results: [{ id: 101, outcome: 'done' }] })
    expect(entriesOf(101)[0]).toMatchObject({ duration_seconds: 7200, state: 'open' })
    expect(row(101)).toMatchObject({ decision: 'imported', decision_reason: 'Approved by Ben on the phone' })
    expect(fake.tables.tc_entry_audit[0]).toMatchObject({ reason: 'Approved by Ben on the phone', after: expect.objectContaining({ past_allowance: true }) })
    expect(logged()[0].action).toBe('Ana Lima, Nov 9, 2026: TSheets entry #101 counted (Approved by Ben on the phone)')
  })

  it('time off counts nothing against the allowance', async () => {
    const r = await decideSkipped({ ids: [105], choice: 'count' })
    expect(r).toMatchObject({ ok: true, results: [{ outcome: 'done' }] })
    expect(entriesOf(105)[0]).toMatchObject({ kind: 'absence', jobcode_id: VACATION, duration_seconds: 28800 })
    expect(limitCalls[0].change.add).toEqual([{ day: '2026-11-09', seconds: 0 }])
  })

  it('several selected: each by the same rules, one answer', async () => {
    const r = await decideSkipped({ ids: [101, 102, 103, 109], choice: 'count' })
    expect(r.ok && r.results.map(x => [x.id, x.outcome])).toEqual([[101, 'done'], [102, 'done'], [103, 'refused'], [109, 'already']])
    expect(r.ok && r.toast).toBe('Counted 2 entries. 1 was already decided, nothing changed. 1 entry could not be counted.')
    expect(logged()).toHaveLength(2)
  })

  it('lets the decision go again when the Time entry could not be written', async () => {
    const failing = fake
    fake = fakeDb(Object.fromEntries(Object.entries(failing.tables)), { rejectRow: (t, r) => t === 'tc_entries' && r.external_id === 101 })
    expect(await decideSkipped({ ids: [101], choice: 'count' })).toEqual({ ok: false, error: 'Not saved. Try again in a moment.' })
    expect(row(101)).toMatchObject({ decided_at: null, decided_by: null, decision: null })
    expect(logged()).toEqual([])
  })

  it('a Time entry written by someone else in between: refused, and the row undecided again', async () => {
    // The check read before the other write landed: the unique TSheets id answers.
    type Then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise<unknown>
    const client = fake.db as unknown as { from: (t: string) => { then: Then } }
    const from = client.from
    let checked = false
    client.from = (t: string) => {
      const q = from(t)
      if (t === 'tc_entries' && !checked) {
        checked = true
        const then = q.then.bind(q)
        q.then = (ok, ko) => then(v => { fake.tables.tc_entries.push({ id: 99, external_id: 101, person_id: ANA }); return ok(v) }, ko)
      }
      return q
    }
    const r = await decideSkipped({ ids: [101], choice: 'count' })
    expect(r).toMatchObject({ ok: true, results: [{ id: 101, outcome: 'refused', text: expect.stringMatching(/already holds/) }] })
    // Claimed, then let go when the insert met the other row.
    expect(fake.writes.filter(w => w.table === 'tc_import_skipped' && w.op === 'update')).toHaveLength(2)
    expect(row(101).decided_at).toBeNull()
    expect(entriesOf(101)).toEqual([{ id: 99, external_id: 101, person_id: ANA }])
  })
})

describe('Discard it', () => {
  it('writes no entry, keeps who, when and the optional reason, and logs it', async () => {
    const r = await decideSkipped({ ids: [101], choice: 'discard', reason: 'Clocked by mistake' })
    expect(r).toEqual({ ok: true, toast: 'Discarded 1 entry.', results: [{ id: 101, outcome: 'done', text: 'Discarded.' }] })
    expect(entriesOf(101)).toEqual([])
    expect(row(101)).toMatchObject({ decision: 'dismissed', decided_by: 'boss', decision_reason: 'Clocked by mistake' })
    expect(logged()[0].action).toBe('Ana Lima, Nov 9, 2026: TSheets entry #101 discarded (Clocked by mistake)')
    expect(limitCalls).toEqual([])
  })

  it('takes no reason, and discards what could not be counted', async () => {
    const r = await decideSkipped({ ids: [103, 104, 107], choice: 'discard' })
    expect(r.ok && r.results.map(x => x.outcome)).toEqual(['done', 'done', 'done'])
    expect(row(103)).toMatchObject({ decision: 'dismissed', decision_reason: null })
    // The Time entry imported before the date was set stays as it was.
    expect(entriesOf(107)).toHaveLength(1)
  })

  it('does nothing to an entry already decided, and says who did', async () => {
    const r = await decideSkipped({ ids: [109], choice: 'discard' })
    expect(r).toMatchObject({ ok: true, toast: '1 was already decided, nothing changed.', results: [{ outcome: 'already', text: expect.stringMatching(/^Already decided: Discarded by Carla Souza on Nov 12, 2026\./) }] })
    expect(fake.writes).toEqual([])
  })

  it('refuses an entry that is not set aside', async () => {
    const r = await decideSkipped({ ids: [555], choice: 'discard' })
    expect(r).toMatchObject({ ok: true, results: [{ id: 555, outcome: 'refused', text: 'That entry is no longer set aside.' }] })
  })
})
