import { describe, it, expect, vi, beforeEach } from 'vitest'

// The person drawer's read answers only for someone the reader's People tab
// already lists (audit, 9 October 2026).

let view: { tab: string; period: number; filter: { personId?: string } }
let verified = true
const loaded: string[] = []

vi.mock('@/lib/access/resolve', () => ({
  verifiedSession: async () => (verified ? { id: 'u' } : null),
  loadAccess: async () => ({ can: (k: string) => k === 'report' }),
}))
vi.mock('@/lib/auth/session', () => ({ getCurrentPerson: async () => ({ id: 'me' }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/report/view', () => ({ resolveReportView: async () => view }))
vi.mock('@/lib/report/drawer-data', () => ({
  loadPersonDetail: async (id: string) => { loaded.push(id); return { deliveries: [], hours: [], totalDeliveries: 0 } },
}))

const { personDetail } = await import('./actions')

beforeEach(() => {
  verified = true
  loaded.length = 0
  view = { tab: 'people', period: 90, filter: { personId: 'ana' } }
})

describe('the person drawer', () => {
  it('answers for a person the People tab lists', async () => {
    expect((await personDetail('ana', '90')).ok).toBe(true)
    expect(loaded).toEqual(['ana'])
  })

  // The view clamps the person to the reader's scope: a lead asking for
  // someone outside their teams gets their own work back, not that person.
  it('refuses anyone else, without reading them', async () => {
    view = { tab: 'people', period: 90, filter: { personId: 'me' } }
    expect(await personDetail('stranger', '90')).toEqual({ ok: false, error: 'This person is not in your Report.' })
    expect(loaded).toEqual([])
  })

  it('refuses without the People tab, and without a verified session', async () => {
    view = { tab: 'overview', period: 90, filter: { personId: 'ana' } }
    expect((await personDetail('ana', '90')).ok).toBe(false)
    view = { tab: 'people', period: 90, filter: { personId: 'ana' } }
    verified = false
    expect((await personDetail('ana', '90')).ok).toBe(false)
    expect(loaded).toEqual([])
  })
})
