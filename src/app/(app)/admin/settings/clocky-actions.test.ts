import { describe, it, expect, vi, beforeEach } from 'vitest'

// Company settings > Reminders (13C), audit of 27 October 2026.

let readFails = false
let stored: Record<string, boolean> = {}
const writes: Record<string, unknown>[] = []

const client = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => (readFails ? { data: null, error: { message: 'boom' } } : { data: { clocky_reminders: stored }, error: null }) }) }),
    update: (row: Record<string, unknown>) => ({ eq: async () => { writes.push(row); return { error: null } } }),
  }),
}

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => true }))
vi.mock('@/lib/auth/session', () => ({ getRealPerson: async () => null }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))

const { setReminder } = await import('./clocky-actions')
const { REMINDERS } = await import('@/lib/timeclock/company-settings')

beforeEach(() => {
  readFails = false
  stored = {}
  writes.length = 0
})

describe('setReminder', () => {
  it('keeps the other reminders as they were', async () => {
    const [a, b] = REMINDERS.map(r => r.key)
    stored = { [b]: false }
    expect((await setReminder({ key: a, on: false })).ok).toBe(true)
    expect(writes[0].clocky_reminders).toEqual({ [b]: false, [a]: false })
  })

  it('writes nothing when the current settings could not be read (a reminder turned off would come back on)', async () => {
    readFails = true
    const r = await setReminder({ key: REMINDERS[0].key, on: true })
    expect(r.ok).toBe(false)
    expect(writes).toEqual([])
  })
})
