import { describe, it, expect, vi, beforeEach } from 'vitest'

// Company settings > Reminders (13C), audit of 27 October 2026; Invoices, who approves reimbursements (1 November 2026).

let readFails = false
let stored: Record<string, boolean> = {}
const writes: Record<string, unknown>[] = []
let people: { id: string; status: string | null; access_level: string }[] = []

const client = {
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => (readFails ? { data: null, error: { message: 'boom' } } : { data: { clocky_reminders: stored }, error: null }) }),
      in: async (_col: string, ids: string[]) => ({ data: people.filter(p => ids.includes(p.id)), error: null }),
    }),
    update: (row: Record<string, unknown>) => ({ eq: async () => { writes.push(row); return { error: null } } }),
  }),
}

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => true }))
vi.mock('@/lib/auth/session', () => ({ getRealPerson: async () => null }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))

const { saveReimbursementApprovers, setReminder } = await import('./clocky-actions')
const { REMINDERS } = await import('@/lib/timeclock/company-settings')

beforeEach(() => {
  readFails = false
  stored = {}
  writes.length = 0
  people = []
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

describe('saveReimbursementApprovers', () => {
  const DAVE = '11111111-1111-1111-1111-111111111111'
  const TINA = '22222222-2222-2222-2222-222222222222'

  it('saves the list once each, as saveFinance does', async () => {
    people = [{ id: DAVE, status: 'active', access_level: 'super_admin' }, { id: TINA, status: 'active', access_level: 'admin' }]
    const r = await saveReimbursementApprovers({ personIds: [DAVE, TINA, DAVE] })
    expect(r.ok).toBe(true)
    expect(writes[0].reimbursement_approvers).toEqual([DAVE, TINA])
  })

  it('keeps at least one person', async () => {
    expect((await saveReimbursementApprovers({ personIds: [] })).ok).toBe(false)
    expect(writes).toEqual([])
  })

  it('takes only active Admins and Super Admins, who can open Approvals', async () => {
    people = [{ id: DAVE, status: 'active', access_level: 'user' }]
    expect((await saveReimbursementApprovers({ personIds: [DAVE] })).ok).toBe(false)
    people = [{ id: DAVE, status: 'inactive', access_level: 'admin' }]
    expect((await saveReimbursementApprovers({ personIds: [DAVE] })).ok).toBe(false)
    expect((await saveReimbursementApprovers({ personIds: ['not-a-uuid'] })).ok).toBe(false)
    expect(writes).toEqual([])
  })
})
