import { describe, it, expect, vi } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'

// The access rule is tested on its own (lib/access); here each subject simply
// holds the keys it is given.
vi.mock('@/lib/access/store', () => ({
  loadRules: async () => ({}),
  loadSubjects: async () => [
    { id: 'ana', level: 'user', keys: ['my-team'] },
    { id: 'old', level: 'user', keys: [] },
    { id: 'revoked', level: 'admin', keys: ['d-log'] },
    { id: 'founder', level: 'super_admin', keys: ['d-log'] },
    { id: 'lead', level: 'team_leader', keys: ['my-team'] },
  ],
}))
vi.mock('@/lib/access/decide', () => ({ allowedKeys: (s: { keys: string[] }) => new Set(s.keys) }))

const { loadAudience } = await import('./audience')

const SEED = {
  people: [
    { id: 'ana', full_name: 'Ana', status: 'active', profile_id: 'p-ana', portal_invited_at: '2026-10-01' },
    { id: 'old', full_name: 'Otto', status: 'inactive', profile_id: 'p-old', portal_invited_at: '2026-10-01' },
    // Invitation withdrawn: still active, still has an account.
    { id: 'revoked', full_name: 'Rita', status: 'active', profile_id: 'p-rev', portal_invited_at: null },
    // The founding account signs in without an invitation (lib/auth/portal-rule).
    { id: 'founder', full_name: 'Founder', status: 'active', profile_id: 'p-f', portal_invited_at: null },
    { id: 'lead', full_name: 'Lia', status: 'active', profile_id: 'p-lead', portal_invited_at: '2026-10-01' },
  ],
  profiles: [
    { id: 'p-ana', email: 'ana@goodnewsadvocates.org' }, { id: 'p-old', email: 'old@goodnewsadvocates.org' },
    { id: 'p-rev', email: 'rita@goodnewsadvocates.org' }, { id: 'p-f', email: 'arnaldo.oliveira@me.com' },
    { id: 'p-lead', email: 'lia@goodnewsadvocates.org' },
  ],
  team_members: [
    { team_id: 'w', person_id: 'lead', position: 'lead' },
    { team_id: 'w', person_id: 'ana', position: 'member' },
    { team_id: 'w', person_id: 'old', position: 'member' },
  ],
  teams: [{ id: 'w', name: 'Writers' }],
}

describe('who notifications go to (audit, 9 October 2026)', () => {
  it('only people who can sign in: active AND invited (the founding account excepted)', async () => {
    const aud = await loadAudience(fakeDb(SEED).db)
    expect(aud.people.map(p => p.personId).sort()).toEqual(['ana', 'founder', 'lead'])
    expect(aud.byId.has('revoked')).toBe(false)
  })

  it('counts nobody inactive on a team, so no leader is told about their work', async () => {
    const aud = await loadAudience(fakeDb(SEED).db)
    expect(aud.teamMembers.get('w')).toEqual(['lead', 'ana'])
  })

  it('throws when a read fails, instead of answering "nobody"', async () => {
    await expect(loadAudience(fakeDb(SEED, { fail: ['profiles'] }).db)).rejects.toThrow(/could not be read/)
    await expect(loadAudience(fakeDb(SEED, { fail: ['people'] }).db)).rejects.toThrow(/could not be read/)
  })

  it('follows the access items, not the level', async () => {
    const aud = await loadAudience(fakeDb(SEED).db)
    expect(aud.withTool('d-log').map(p => p.personId)).toEqual(['founder'])
  })
})
