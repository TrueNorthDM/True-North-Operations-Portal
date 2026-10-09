import { describe, it, expect, vi } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

let fake: Fake
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/tsheets/require-admin', () => ({ requireAdmin: async () => null }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'acc' } } }) } }) }))
vi.mock('@/lib/hr/compensation', () => ({ loadPersonCompensation: async () => ({ fullName: 'Ana', internalRate: 20 }) }))

const { saveTrAssignment, savePersonCostRate } = await import('./settings-actions')

const rate = (effectiveFrom: string) => ({ personId: 'ana', tsheetsUserId: null, clientId: 1, hourlyRate: 100, effectiveFrom, justification: 'Raise' })

describe('client rates start on the 1st (decided 9 October 2026)', () => {
  it('refuses a rate from the middle of a month', async () => {
    fake = fakeDb({ tr_assignments: [], tr_audit_log: [] })
    const r = await saveTrAssignment(rate('2026-10-15'))
    expect(r).toEqual({ ok: false, error: 'A rate starts on the first day of a month. Choose the 1st.' })
    expect(fake.writes).toEqual([])
  })

  it('closes the rate before it on the last day of the previous month', async () => {
    fake = fakeDb({ tr_assignments: [{ id: 5, person_id: 'ana', client_id: 1, hourly_rate: 95, effective_to: null, active: true }], tr_audit_log: [] })
    expect(await saveTrAssignment(rate('2026-10-01'))).toEqual({ ok: true })
    expect(fake.tables.tr_assignments.find(r => r.id === 5)?.effective_to).toBe('2026-09-30')
  })
})

describe('pay settings are written by the server and checked', () => {
  it('says so when nobody was changed, instead of "saved"', async () => {
    fake = fakeDb({ people: [], tr_audit_log: [] })
    expect(await savePersonCostRate({ personId: 'nobody', costRate: 30, justification: 'x' })).toEqual({ ok: false, error: 'Person not found.' })
  })
})
