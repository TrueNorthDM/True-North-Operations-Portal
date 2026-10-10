import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// Settings > Publishing targets (audit, 10 October 2026).

let fake: Fake
let granted = true
const AAAF = '462251934'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => granted }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'ben@tn.org' } } }) } }) }))

const { addTarget, saveTargetValue, deleteTarget, addPublisher, removePublisher } = await import('./targets-actions')

beforeEach(() => {
  granted = true
  fake = fakeDb({
    sites: [{ monday_board_id: AAAF, languages: ['en', 'pt', 'es', 'sw'] }],
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
