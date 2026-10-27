import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'
import { monthSpan } from './manual-data'

let fake: Fake
let granted = new Set<string>()
const ME = 'me'
const I7_CODE = 10, I7_FOLDER = 11, PH_CODE = 20
const BATCH = '11111111-1111-4111-8111-111111111111'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async (k: string) => granted.has(k) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'acc-me' } } }) } }) }))
vi.mock('@/lib/directory/current-person', () => ({ loadCurrentPerson: async () => ({ id: ME }) }))
vi.mock('./manual-fields', () => ({ loadEntryFieldKeys: async () => ({ code: '1', activity: '3', company: '4', project: '2', billable: '5' }) }))
vi.mock('./report-source', () => ({ i7JobcodeIdsHere: async () => new Set([I7_CODE, I7_FOLDER]) }))
// The limit itself is allowance-limit.ts's (allowance.test.ts); here, only what the batch asks of it.
let refusal: string | null = null
const limitCalls: { personId: string; change: { add: { day: string; seconds: number }[]; exclude?: number[] }; name: string | null }[] = []
vi.mock('./allowance-limit', () => ({
  limitRefusal: async (personId: string, change: never, _now: Date, name: string | null) => { limitCalls.push({ personId, change, name }); return refusal },
}))
vi.mock('@/lib/tsheets/report-data', () => ({ loadI7Assignments: async () => [{ personId: 'ana', rate: 95, from: '2026-01-01', to: null }] }))

const { addManualEntries, deleteManualEntry } = await import('./manual-actions')

const line = (over: Record<string, unknown> = {}) => ({
  personId: 'ana', entryDate: '2026-09-15', jobcodeId: I7_CODE, hours: 3, i7Code: 'WM-SEO', activity: 'SEO', ...over,
}) as never

beforeEach(() => {
  refusal = null
  limitCalls.length = 0
  granted = new Set(['i7-manual'])
  fake = fakeDb({
    tc_jobcodes: [
      { id: I7_CODE, active: true, parent_id: I7_FOLDER },
      { id: I7_FOLDER, active: true, parent_id: null },
      { id: PH_CODE, active: true, parent_id: null },
    ],
    tc_entries: [
      { id: 1, kind: 'manual', external_id: null, manual_batch: 'b0', person_id: 'ana', jobcode_id: I7_CODE },
      // A person's own duration-only entry from My Hours: not the panel's.
      { id: 2, kind: 'manual', external_id: null, manual_batch: null, person_id: 'bo', jobcode_id: I7_CODE },
    ],
    tc_entry_audit: [],
    people: [{ id: 'ana', full_name: 'Ana' }],
  }, { unique: { tc_entries: ['manual_batch', 'manual_line'] } })
})

describe('hours added by hand (audit, 9 October 2026)', () => {
  it('adds a batch once, even when it is sent twice', async () => {
    expect(await addManualEntries([line()], BATCH)).toEqual({ ok: true })
    expect(await addManualEntries([line()], BATCH)).toEqual({ ok: true })
    expect(fake.tables.tc_entries.filter(r => r.manual_batch === BATCH)).toHaveLength(1)
  })

  it('refuses your own hours: they would land approved', async () => {
    const r = await addManualEntries([line({ personId: ME })], BATCH)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/someone else adds your own/)
  })

  it('asks for the item of the branch: Project Hours access does not add i7 hours', async () => {
    granted = new Set(['ph-manual'])
    expect((await addManualEntries([line()], BATCH)).error).toMatch(/does not add hours to the i7 report/)
  })

  it('refuses a folder, and an i7 line without its i7 code', async () => {
    expect((await addManualEntries([line({ jobcodeId: I7_FOLDER })], BATCH)).error).toMatch(/not a folder/)
    expect((await addManualEntries([line({ i7Code: '' })], BATCH)).error).toMatch(/Choose the i7 code/)
  })

  it('removes only a line the panel added, and writes it to the history', async () => {
    expect((await deleteManualEntry(2)).ok).toBe(false)
    expect(fake.tables.tc_entries.some(r => r.id === 2)).toBe(true)
    expect(await deleteManualEntry(1)).toEqual({ ok: true })
    expect(fake.tables.tc_entries.some(r => r.id === 1)).toBe(false)
    expect(fake.tables.tc_entry_audit).toHaveLength(1)
  })

  it('says so when the line is already gone, instead of "done"', async () => {
    expect((await deleteManualEntry(99)).ok).toBe(false)
  })
})

describe('the hours allowance is a real limit here too (owner, 25 October 2026)', () => {
  it('asks once per person with all their lines, named, and adds nothing when refused', async () => {
    refusal = "That goes past Ana's 140h 00m allowance for September: 2h 00m left. Ask for extra hours to log more."
    const r = await addManualEntries([line(), line({ entryDate: '2026-09-16', hours: 1.5 })], BATCH)
    expect(r).toEqual({ ok: false, error: refusal })
    expect(limitCalls).toEqual([{ personId: 'ana', name: 'Ana', change: { add: [{ day: '2026-09-15', seconds: 10800 }, { day: '2026-09-16', seconds: 5400 }], exclude: [] } }])
    expect(fake.tables.tc_entries.filter(r => r.manual_batch === BATCH)).toHaveLength(0)
  })

  it('a batch sent twice leaves its own lines out of the count, so it lands once', async () => {
    expect(await addManualEntries([line()], BATCH)).toEqual({ ok: true })
    const id = fake.tables.tc_entries.find(r => r.manual_batch === BATCH)!.id
    expect(await addManualEntries([line()], BATCH)).toEqual({ ok: true })
    expect(limitCalls[1].change.exclude).toEqual([id])
  })
})

describe('a database refusal (audit, 13 October 2026)', () => {
  it('reads as a sentence for the person, with the database wording in the log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    fake = fakeDb({ tc_jobcodes: [], tc_entries: [] }, { fail: ['tc_jobcodes'] })
    expect(await addManualEntries([line()], BATCH)).toEqual({ ok: false, error: 'The hours were not added. Try again in a moment.' })
    fake = fakeDb({ tc_entries: [] }, { fail: ['tc_entries'] })
    expect(await deleteManualEntry(1)).toEqual({ ok: false, error: 'The line was not removed. Try again in a moment.' })
    expect(log).toHaveBeenCalledWith('[manual hours] job codes:', 'boom')
    expect(log).toHaveBeenCalledWith('[manual hours] read:', 'boom')
    log.mockRestore()
  })
})

describe('a month, read as [first day, first day of the next)', () => {
  it('has no "-31" in a 30-day month or in February', () => {
    expect(monthSpan('2026-09')).toEqual({ start: '2026-09-01', next: '2026-10-01' })
    expect(monthSpan('2026-02')).toEqual({ start: '2026-02-01', next: '2026-03-01' })
    expect(monthSpan('2026-12')).toEqual({ start: '2026-12-01', next: '2027-01-01' })
    expect(() => monthSpan('2026-13')).toThrow()
  })
})
