import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb } from './__fakes__/db'

// The privileged readers the page calls for Personal and HR. Mocked so a test
// can tell whether a closed tab was read at all, not only whether it was shown.
const contact = vi.fn()
const twoStep = vi.fn()
vi.mock('@/lib/hr/contact', () => ({ loadContactByPerson: (...a: unknown[]) => contact(...a) }))
vi.mock('@/lib/auth/two-step', () => ({ loadTwoStepByAccount: (...a: unknown[]) => twoStep(...a) }))
vi.mock('@/lib/settings/person', () => ({ loadSettings: async () => null }))

const { loadPersonPage, loadLedMemberIds } = await import('./person-page-data')

const SEED = {
  people: [
    { id: 'ana', full_name: 'Ana Silva', status: 'active', title: 'Writer', hire_date: '2024-02-01', email_goodnews: 'ana@goodnewsadvocates.org',
      onboarding_status: 'completed', employment_history: 'Joined as a writer.', profile_id: 'acc-ana', manager_id: 'lead' },
    { id: 'lead', full_name: 'Lia Lead', status: 'active', manager_id: null },
    { id: 'old', full_name: 'Otto Old', status: 'inactive', manager_id: 'lead' },
  ],
  teams: [{ id: 'w', name: 'Writers', color: '#123456' }, { id: 'g', name: 'Graphics', color: '#654321' }],
  team_members: [
    { person_id: 'ana', team_id: 'w', position: 'member', is_primary: false },
    { person_id: 'ana', team_id: 'g', position: 'member', is_primary: true },
    { person_id: 'lead', team_id: 'w', position: 'lead', is_primary: true },
    { person_id: 'old', team_id: 'w', position: 'member', is_primary: true },
  ],
  access_log: [],
}

const viewer = (personId: string | null, ...keys: string[]) => ({ personId, can: (k: string) => keys.includes(k) })

beforeEach(() => {
  contact.mockReset().mockResolvedValue(new Map([['ana', { dateOfBirth: '1990-05-01', phone: '+5585900000000', emailPersonal: 'ana@gmail.com', address: null }]]))
  twoStep.mockReset().mockResolvedValue(new Map())
})

describe("what a person's page reads and returns, per viewer (P13)", () => {
  it('opens nothing to someone with no page items', async () => {
    const { db } = fakeDb(SEED)
    expect(await loadPersonPage(db, 'ana', viewer('bo'), new Set())).toBeNull()
  })

  it('with Work only: no personal data and no HR, and neither is even read', async () => {
    const { db } = fakeDb(SEED)
    const page = await loadPersonPage(db, 'ana', viewer('bo', 'p-any', 'p-work'), new Set())
    expect(page?.work?.history).toBe('Joined as a writer.')
    expect(page?.personal).toBeNull()
    expect(page?.hr).toBeNull()
    expect(page?.cover.location).toBeNull()
    expect(page?.cover.whatsapp).toBeNull()
    expect(contact).not.toHaveBeenCalled()
    expect(twoStep).not.toHaveBeenCalled()
  })

  it('with Personal only: no Work, and the cover shows no team, dates or work email', async () => {
    const { db } = fakeDb(SEED)
    const page = await loadPersonPage(db, 'ana', viewer('bo', 'p-any', 'p-personal'), new Set())
    expect(page?.personal?.dateOfBirth).toBe('1990-05-01')
    expect(page?.work).toBeNull()
    expect(page?.cover).toMatchObject({ teams: [], hireDate: null, tenure: null, email: null })
  })

  it('their own page: Personal and Work, never their own HR without the HR items', async () => {
    const { db } = fakeDb(SEED)
    const page = await loadPersonPage(db, 'ana', viewer('ana'), new Set())
    expect(page?.rights.own).toBe(true)
    expect(page?.personal).not.toBeNull()
    expect(page?.work).not.toBeNull()
    expect(page?.hr).toBeNull()
    expect(twoStep).not.toHaveBeenCalled()
  })

  it('with HR: the statuses and the sign-in state', async () => {
    const { db } = fakeDb(SEED)
    const page = await loadPersonPage(db, 'ana', viewer('bo', 'p-any', 'p-hr'), new Set())
    expect(page?.hr).toMatchObject({ onboarding: 'completed', hasAccount: true })
    expect(page?.personal).toBeNull()
  })

  it("a Team Leader opens their team's pages with p-led, and nobody else's", async () => {
    const { db } = fakeDb(SEED)
    const lead = viewer('lead', 'p-led', 'p-work')
    expect(await loadPersonPage(db, 'ana', lead, new Set(['lead', 'ana']))).not.toBeNull()
    expect(await loadPersonPage(db, 'ana', lead, new Set(['lead']))).toBeNull()
  })

  it('colours the page by their main team, the primary one', async () => {
    const { db } = fakeDb(SEED)
    const page = await loadPersonPage(db, 'ana', viewer('bo', 'p-any', 'p-work'), new Set())
    expect(page?.color).toBe('#654321')
  })
})

describe('the people a Team Leader leads (P5: active people only)', () => {
  it('counts the active people on the teams they lead, themselves included', async () => {
    const { db } = fakeDb(SEED)
    expect([...await loadLedMemberIds(db, 'lead')].sort()).toEqual(['ana', 'lead'])
  })

  it('leaves out someone made inactive, so their page closes to the Team Leader', async () => {
    const { db } = fakeDb(SEED)
    expect((await loadLedMemberIds(db, 'lead')).has('old')).toBe(false)
  })

  it('is empty for someone who leads no team', async () => {
    const { db } = fakeDb(SEED)
    expect((await loadLedMemberIds(db, 'ana')).size).toBe(0)
    expect((await loadLedMemberIds(db, null)).size).toBe(0)
  })
})
