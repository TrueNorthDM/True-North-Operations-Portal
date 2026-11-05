import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// Moving a person to no wave (owner, 5 November 2026, migration 154): the same gate as the waves.
let fake: Fake
let allowed = true
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => allowed, isSuperAdmin: async () => allowed }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/auth/session', () => ({ getRealPerson: async () => ({ id: 'arn', full_name: 'Arnaldo Oliveira' }) }))

const { moveToWave } = await import('./rollout-actions')
const ED = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  allowed = true
  fake = fakeDb({ people: [{ id: ED, full_name: 'Ed Wagner' }], tc_rollout_people: [], settings_change_log: [] })
})

describe('moveToWave and no wave', () => {
  it('saves 0 for no wave, and accepts "none" the same way', async () => {
    const r = await moveToWave({ personId: ED, wave: 0 })
    expect(r.ok).toBe(true)
    expect(fake.tables.tc_rollout_people).toMatchObject([{ person_id: ED, wave: 0, set_by: 'arn' }])
    expect(await moveToWave({ personId: ED, wave: 'none' })).toMatchObject({ ok: true })
    expect(fake.tables.tc_rollout_people).toHaveLength(1)
    expect(fake.tables.settings_change_log.at(-1)).toMatchObject({ setting: 'north_time_wave_person', action: 'Ed Wagner: moved to no wave' })
  })

  it('back to their level removes the row', async () => {
    await moveToWave({ personId: ED, wave: 0 })
    expect(await moveToWave({ personId: ED, wave: null })).toMatchObject({ ok: true })
    expect(fake.tables.tc_rollout_people).toHaveLength(0)
  })

  it('refuses anyone but a Super Admin really signed in (View Stage included), and any other value', async () => {
    allowed = false
    expect(await moveToWave({ personId: ED, wave: 0 })).toEqual({ ok: false, error: 'Only Super Admins change the North Time rollout.' })
    allowed = true
    expect(await moveToWave({ personId: ED, wave: 3 as never })).toEqual({ ok: false, error: 'Pick wave 1, wave 2 or No wave.' })
    expect(fake.tables.tc_rollout_people).toHaveLength(0)
  })
})
