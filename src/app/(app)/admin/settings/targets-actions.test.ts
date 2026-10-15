import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// Settings > Publishing targets (audit, 10 October 2026).

let fake: Fake
let granted = true
const AAAF = '462251934'
const BM = '1764094550'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => granted }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'ben@tn.org' } } }) } }) }))

const { addTarget, saveTargetValue, deleteTarget, addPublisher, removePublisher, saveTargetRhythm } = await import('./targets-actions')

beforeEach(() => {
  granted = true
  fake = fakeDb({
    sites: [
      { id: 's-aaaf', monday_board_id: AAAF, languages: ['en', 'pt', 'es', 'sw'], target_cycle_weeks: 1, target_cycle_start: null },
      { id: 's-bm', monday_board_id: BM, languages: ['en'], target_cycle_weeks: 1, target_cycle_start: null },
    ],
    publishing_targets: [{ id: 't1', board_id: AAAF, board_short: 'AAAF-P', language: 'English', period_type: 'weekly', target_value: 2 }],
    publishing_publishers: [{ name: 'Samuel Manzi' }],
  }, { rpc: { publishing_set_target: () => null, publishing_remove_target: () => true } })
})

describe('weekly targets', () => {
  it('takes only a language the site publishes, spelt the way the site spells it', async () => {
    expect((await addTarget({ boardId: AAAF, language: 'french', targetValue: 2 })).error).toMatch(/languages this site publishes/)
    expect(await addTarget({ boardId: AAAF, language: 'spanish', targetValue: 3 })).toEqual({ ok: true })
    expect(fake.rpcs.at(-1)).toMatchObject({ fn: 'publishing_set_target', args: { p_language: 'Spanish', p_value: 3, p_actor: 'ben@tn.org' } })
  })

  it('refuses a board that is not a publishing board, and a fraction', async () => {
    expect((await addTarget({ boardId: '123', language: 'English', targetValue: 2 })).ok).toBe(false)
    expect((await saveTargetValue({ id: 't1', targetValue: 2.5 })).error).toMatch(/whole number/)
    expect(fake.rpcs).toEqual([])
  })

  it('applies a change from this week, through the function that keeps the history', async () => {
    expect(await saveTargetValue({ id: 't1', targetValue: 4 })).toEqual({ ok: true })
    const call = fake.rpcs[0] as { fn: string; args: { p_week: string } }
    expect(call.fn).toBe('publishing_set_target')
    expect(new Date(`${call.args.p_week}T12:00:00Z`).getUTCDay()).toBe(1)
  })

  it('removes under the name of who removed it', async () => {
    expect(await deleteTarget({ id: 't1' })).toEqual({ ok: true })
    expect(fake.rpcs[0]).toMatchObject({ fn: 'publishing_remove_target', args: { p_actor: 'ben@tn.org' } })
  })

  it('needs Publishing targets', async () => {
    granted = false
    expect((await addTarget({ boardId: AAAF, language: 'Spanish', targetValue: 3 })).ok).toBe(false)
    expect(fake.rpcs).toEqual([])
  })
})

describe('the publishers list', () => {
  it('adds a full name and removes it', async () => {
    expect(await addPublisher({ name: '  Wendy   Cacka ' })).toEqual({ ok: true })
    expect(fake.tables.publishing_publishers.map(p => p.name)).toContain('Wendy Cacka')
    expect(await removePublisher({ name: 'Samuel Manzi' })).toEqual({ ok: true })
    expect(fake.tables.publishing_publishers.map(p => p.name)).not.toContain('Samuel Manzi')
  })

  it('refuses something that is not a name', async () => {
    expect((await addPublisher({ name: '<script>' })).ok).toBe(false)
  })
})

// The rhythm: every week or every two weeks (15 October 2026).
describe('a board\'s rhythm', () => {
  const bm = () => fake.tables.sites.find(s => s.id === 's-bm')!
  const history = () => fake.writes.filter(w => w.table === 'audit_log').flatMap(w => w.rows)

  it('counts in two-week cycles from this week\'s Monday, under the name of who changed it', async () => {
    expect(await saveTargetRhythm({ boardId: BM, weeks: 2 })).toEqual({ ok: true })
    expect(bm().target_cycle_weeks).toBe(2)
    const start = String(bm().target_cycle_start)
    expect(new Date(`${start}T12:00:00Z`).getUTCDay()).toBe(1)
    expect(history()).toMatchObject([{
      user_email: 'ben@tn.org', action: 'update', entity_id: 's-bm',
      before: { board_short: 'BM-P', target_cycle_weeks: 1, target_cycle_start: null },
      after: { board_short: 'BM-P', target_cycle_weeks: 2, target_cycle_start: start },
    }])
  })

  it('goes back to every week and clears the start', async () => {
    Object.assign(bm(), { target_cycle_weeks: 2, target_cycle_start: '2026-10-12' })
    expect(await saveTargetRhythm({ boardId: BM, weeks: 1 })).toEqual({ ok: true })
    expect(bm()).toMatchObject({ target_cycle_weeks: 1, target_cycle_start: null })
    expect(history()[0]).toMatchObject({ after: { target_cycle_weeks: 1, target_cycle_start: null } })
  })

  it('changes nothing when the rhythm is already the one asked for', async () => {
    expect(await saveTargetRhythm({ boardId: BM, weeks: 1 })).toEqual({ ok: true })
    expect(fake.writes).toEqual([])
  })

  it('refuses another rhythm, a board that is not a publishing board, and anyone without Publishing targets', async () => {
    expect((await saveTargetRhythm({ boardId: BM, weeks: 3 })).ok).toBe(false)
    expect((await saveTargetRhythm({ boardId: '123', weeks: 2 })).ok).toBe(false)
    granted = false
    expect((await saveTargetRhythm({ boardId: BM, weeks: 2 })).error).toMatch(/not open to your access/)
    expect(fake.writes).toEqual([])
  })
})
