import { describe, it, expect } from 'vitest'
import { cleanWork, type WorkInput } from './person-validate'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const T = '33333333-3333-4333-8333-333333333333'

const input = (over: Partial<WorkInput> = {}): WorkInput => ({
  fullName: 'Ana Silva', title: 'Writer', employmentType: 'contractor', schedule: 'part', weeklyHours: '20', status: 'active',
  emails: { trueNorth: '', goodnews: 'Ana@GoodNewsAdvocates.org ', coe: '' },
  teams: [], managerId: '', alsoReportsToId: '', hireDate: '2026-01-05', leftOn: '', milestones: [], history: '',
  ...over,
})

const error = (over: Partial<WorkInput>, id: string | null = null) => {
  const r = cleanWork(input(over), id)
  return r.ok ? null : r.error
}

describe('the Work fields, checked once for Add person and the person page', () => {
  it('turns a good form into columns, with addresses lowercased and blanks as null', () => {
    const r = cleanWork(input(), null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cols).toMatchObject({
      full_name: 'Ana Silva', employment_type: 'contractor', schedule: 'part', weekly_hours: 20,
      email_goodnews: 'ana@goodnewsadvocates.org', email_true_north: null, email_coe: null,
      manager_id: null, hire_date: '2026-01-05', left_on: null, employment_history: null,
    })
  })

  it('needs a name', () => {
    expect(error({ fullName: '   ' })).toBe('The name is required.')
  })

  it('refuses a type, schedule or status the screen does not offer', () => {
    expect(error({ employmentType: 'intern' })).toMatch(/US Employee or Contractor/)
    expect(error({ schedule: 'weekends' })).toMatch(/Full-Time or Part-Time/)
    expect(error({ status: 'gone' as never })).toMatch(/Active or Inactive/)
  })

  it('keeps weekly hours between 0 and 168', () => {
    expect(error({ weeklyHours: '169' })).toMatch(/between 0 and 168/)
    expect(error({ weeklyHours: '-1' })).toMatch(/between 0 and 168/)
    expect(error({ weeklyHours: 'forty' })).toMatch(/between 0 and 168/)
    expect(error({ weeklyHours: '' })).toBeNull()
  })

  it('refuses an address that is not one', () => {
    expect(error({ emails: { trueNorth: 'ana at truenorth', goodnews: '', coe: '' } })).toMatch(/does not look right/)
  })

  // One mailbox in two fields would match two people at sign-in (P1).
  it('refuses the same address in two fields, whatever its case', () => {
    expect(error({ emails: { trueNorth: 'ana@x.org', goodnews: 'ANA@x.org', coe: '' } })).toMatch(/written twice/)
  })

  it('refuses a date it cannot read', () => {
    expect(error({ hireDate: '05/01/2026' })).toBe('A date could not be read.')
  })

  it('refuses a manager that is not an id, and reporting to yourself', () => {
    expect(error({ managerId: 'robert' })).toBe('That manager does not exist.')
    expect(error({ managerId: A }, A)).toBe('A person cannot report to themselves.')
    expect(error({ alsoReportsToId: A }, A)).toBe('A person cannot report to themselves.')
    expect(error({ managerId: B }, A)).toBeNull()
  })

  it('keeps only teams named by a real id', () => {
    const r = cleanWork(input({ teams: [{ teamId: T, position: 'lead', primary: true }, { teamId: 'writers', position: 'member', primary: false }] }), null)
    expect(r.ok && r.teams).toEqual([{ teamId: T, position: 'lead', primary: true }])
  })

  it('never throws on a form sent by hand with missing parts', () => {
    expect(() => cleanWork({ fullName: 'X', status: 'active' } as never, null)).not.toThrow()
  })
})
