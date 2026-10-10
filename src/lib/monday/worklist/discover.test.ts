import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'
import { syncMondayUsers } from './discover'

// Linking Monday accounts to people by email (audit, 10 October 2026).

let fake: Fake
const USERS = [
  { id: '1', name: 'Ana', email: 'ana@tn.org', enabled: true, is_guest: false },
  { id: '2', name: 'Bo', email: 'bo@tn.org', enabled: true, is_guest: false },
  { id: '3', name: 'Twin', email: 'twin@tn.org', enabled: true, is_guest: false },
  { id: '4', name: 'Cleared', email: 'cleared@tn.org', enabled: true, is_guest: false },
]

beforeEach(() => {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ data: { users: USERS } })))
  fake = fakeDb({
    monday_users: [{ id: 4, is_external: false, auto_link: false }],
    monday_user_links: [{ monday_user_id: 2, person_id: 'bo-manual', linked_by: 'manual' }],
    people: [
      { id: 'ana', full_name: 'Ana', status: 'active', email_true_north: 'ana@tn.org' },
      { id: 'ana-old', full_name: 'Ana (old record)', status: 'inactive', email_goodnews: 'ana@tn.org' },
      { id: 'bo', full_name: 'Bo', status: 'active', email_true_north: 'bo@tn.org' },
      { id: 'twin-a', full_name: 'Twin A', status: 'active', email_true_north: 'twin@tn.org' },
      { id: 'twin-b', full_name: 'Twin B', status: 'active', email_coe: 'twin@tn.org' },
      { id: 'cl', full_name: 'Cleared', status: 'active', email_true_north: 'cleared@tn.org' },
    ],
  }, { rpc: { monday_assignment_counts: () => ({ accounts: {}, steps: {} }) } })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('linking accounts by email', () => {
  it('links the active record when an address is shared with an inactive one', async () => {
    await syncMondayUsers(fake.db, 'token')
    expect(fake.tables.monday_user_links.find(l => l.monday_user_id === 1)?.person_id).toBe('ana')
  })

  it('leaves an address two active people share unlinked rather than guess', async () => {
    const r = await syncMondayUsers(fake.db, 'token')
    expect(fake.tables.monday_user_links.some(l => l.monday_user_id === 3)).toBe(false)
    expect(r.unlinked.map(u => u.id)).toContain(3)
  })

  it('never replaces a link made by hand, and never relinks a cleared account', async () => {
    await syncMondayUsers(fake.db, 'token')
    expect(fake.tables.monday_user_links.find(l => l.monday_user_id === 2)?.person_id).toBe('bo-manual')
    expect(fake.tables.monday_user_links.some(l => l.monday_user_id === 4)).toBe(false)
  })

  it('stops when the links cannot be read, instead of linking over them', async () => {
    fake = fakeDb({ people: [] }, { fail: ['monday_user_links'], rpc: { monday_assignment_counts: () => ({ accounts: {} }) } })
    await expect(syncMondayUsers(fake.db, 'token')).rejects.toThrow(/account links/)
  })
})
