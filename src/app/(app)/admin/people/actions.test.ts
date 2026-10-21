import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

let fake: Fake
let granted = new Set<string>()
let me: string | null = 'admin'
const endSessions = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async (k: string) => granted.has(k) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }))
vi.mock('@/lib/auth/portal-access', () => ({ endSessions: (...a: unknown[]) => endSessions(...a) }))
vi.mock('@/lib/auth/session', () => ({ getRealPerson: async () => (me ? { id: me } : null) }))
vi.mock('@/lib/auth/origin', () => ({ requestOrigin: async () => 'https://portal.test' }))
vi.mock('@/lib/directory/current-person', () => ({ loadCurrentPerson: async () => null }))
vi.mock('@/lib/email/invite', () => ({ renderInvite: () => ({ subject: '', html: '', text: '' }) }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: async () => ({ sent: true }) }))

const { createPerson, deletePerson } = await import('./actions')

const ANA = '11111111-1111-4111-8111-111111111111'
const BO = '22222222-2222-4222-8222-222222222222'
const TEAM = '33333333-3333-4333-8333-333333333333'

beforeEach(() => {
  granted = new Set(['d-edit'])
  me = 'admin'
  endSessions.mockReset()
  fake = fakeDb({
    people: [
      { id: ANA, full_name: 'Ana', status: 'active', profile_id: 'acc-ana', email_goodnews: 'ana@goodnewsadvocates.org' },
      { id: BO, full_name: 'Bo', status: 'active', profile_id: 'acc-bo' },
    ],
    tc_entries: [{ id: 'e1', person_id: ANA }],
    tr_assignments: [],
    person_attachments: [{ person_id: BO, storage_path: `${BO}/cv.pdf` }],
    teams: [{ id: TEAM, name: 'Writers' }],
    team_members: [],
  })
})

describe('removing someone from the Directory (P3)', () => {
  it('makes someone with hours on record inactive instead, and ends their access', async () => {
    const r = await deletePerson(ANA)
    expect(r).toEqual({ ok: true, outcome: 'inactive' })
    expect(fake.tables.people.find(p => p.id === ANA)?.status).toBe('inactive')
    expect(endSessions).toHaveBeenCalledWith('acc-ana')
    expect(fake.writes.some(w => w.op === 'delete')).toBe(false)
  })

  it('deletes someone with no history, with their photo and documents', async () => {
    const r = await deletePerson(BO)
    expect(r).toEqual({ ok: true, outcome: 'removed' })
    expect(fake.tables.people.some(p => p.id === BO)).toBe(false)
    expect(endSessions).toHaveBeenCalledWith('acc-bo')
    expect(fake.removed).toEqual([
      { bucket: 'avatars', paths: [`${BO}.jpg`] },
      { bucket: 'person-files', paths: [`${BO}/cv.pdf`] },
    ])
  })

  it('refuses without the item, yourself, and an id that is not one, writing nothing', async () => {
    granted = new Set()
    expect((await deletePerson(BO)).ok).toBe(false)
    granted = new Set(['d-edit'])
    me = BO
    expect(await deletePerson(BO)).toEqual({ ok: false, error: 'You cannot remove yourself from the Directory.' })
    expect((await deletePerson('robert')).ok).toBe(false)
    expect(fake.writes).toEqual([])
  })
})

describe('Add person takes name and Work only (P4)', () => {
  const work = {
    fullName: 'Cy New', title: '', employmentType: 'us', schedule: 'full', weeklyHours: '40', status: 'active' as const,
    emails: { trueNorth: '', goodnews: '', coe: '' }, teams: [{ teamId: TEAM, position: 'lead', primary: true }],
    managerId: '', alsoReportsToId: '', hireDate: '', leftOn: '', milestones: [], history: '',
  }

  it('adds them with Work columns only, and no team without d-positions', async () => {
    const r = await createPerson({ ...work, phone: '+1 555', date_of_birth: '1990-01-01', onboarding_status: 'completed' } as never, 'monthly')
    expect(r.ok).toBe(true)
    const row = fake.writes.find(w => w.op === 'insert' && w.table === 'people')!.rows[0]
    expect(row.full_name).toBe('Cy New')
    for (const c of ['phone', 'date_of_birth', 'onboarding_status', 'email_personal', 'address', 'profile_id', 'role_type']) {
      expect(row).not.toHaveProperty(c)
    }
    expect(fake.rpcs).toEqual([])
  })

  it('sets their teams with d-positions', async () => {
    granted = new Set(['d-edit', 'd-positions'])
    const r = await createPerson(work, 'monthly')
    expect(r.ok).toBe(true)
    expect(fake.rpcs.map(x => x.fn)).toEqual(['set_person_teams'])
  })

  it("refuses a company address that is someone else's, adding nobody", async () => {
    const r = await createPerson({ ...work, emails: { trueNorth: '', goodnews: 'ANA@goodnewsadvocates.org', coe: '' } }, 'monthly')
    expect(r).toEqual({ ok: false, error: 'ana@goodnewsadvocates.org already belongs to someone else in the Directory.' })
    expect(fake.writes).toEqual([])
  })

  it('refuses without the item', async () => {
    granted = new Set()
    expect(await createPerson(work, 'monthly')).toEqual({ ok: false, error: 'That is not open to your access.' })
  })
})

describe('Add person needs how they submit their hours (owner, 20 October 2026)', () => {
  const work = {
    fullName: 'Cy New', title: '', employmentType: 'us', schedule: 'full', weeklyHours: '40', status: 'active' as const,
    emails: { trueNorth: '', goodnews: '', coe: '' }, teams: [],
    managerId: '', alsoReportsToId: '', hireDate: '', leftOn: '', milestones: [], history: '',
  }

  it('refuses without a cadence, adding nobody', async () => {
    expect(await createPerson(work)).toEqual({ ok: false, error: 'Choose how they submit their hours: Monthly or Every 2 weeks.' })
    expect(await createPerson(work, 'weekly')).toEqual({ ok: false, error: 'Choose how they submit their hours: Monthly or Every 2 weeks.' })
    expect(fake.writes).toEqual([])
  })

  it('keeps the cadence from the start of the records, set by whoever added them', async () => {
    const r = await createPerson(work, 'monthly')
    expect(r.ok).toBe(true)
    const row = fake.writes.find(w => w.op === 'insert' && w.table === 'tc_person_cadence')!.rows[0]
    expect(row).toMatchObject({ person_id: (r as { id: string }).id, cadence: 'monthly', effective_from: '2017-01-01', set_by: 'admin' })
  })

  it('refuses every 2 weeks while pay periods have no start day', async () => {
    fake.tables.tc_settings = [{ singleton_id: 1, pay_period_anchor: null }]
    expect((await createPerson(work, 'biweekly')).ok).toBe(false)
    expect(fake.writes).toEqual([])
    fake.tables.tc_settings = [{ singleton_id: 1, pay_period_anchor: '2026-10-04' }]
    expect((await createPerson(work, 'biweekly')).ok).toBe(true)
  })

  it('takes the person back out if the cadence cannot be kept', async () => {
    fake = fakeDb({ people: [], tc_settings: [] }, { fail: ['tc_person_cadence'] })
    const r = await createPerson(work, 'monthly')
    expect(r).toEqual({ ok: false, error: 'The person could not be added. Try again in a moment.' })
    expect(fake.tables.people).toEqual([])
  })
})
