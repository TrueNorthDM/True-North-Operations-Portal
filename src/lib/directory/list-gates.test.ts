import { describe, it, expect } from 'vitest'
import { LIST_COLUMNS, LIST_COLUMNS_BASE, listGates } from './list-gates'

const can = (...keys: string[]) => (k: string) => keys.includes(k)
const cols = (s: string) => s.split(',').map(c => c.trim())

describe("the Directory's full list (one row per person in the company)", () => {
  // These live on the person's page, each behind its own tab, or in Rates & Costs.
  const PRIVATE = [
    'email_personal', 'phone', 'date_of_birth', 'address', 'location', 'whatsapp_same_number',
    'internal_rate', 'monthly_salary', 'be_rate', 'onboarding_status', 'offboarding_status',
    'employment_history', 'milestones', 'monday_docs', 'last_name',
  ]

  it('never reads personal data, HR, pay or history', () => {
    for (const c of PRIVATE) {
      expect(cols(LIST_COLUMNS)).not.toContain(c)
      expect(cols(LIST_COLUMNS_BASE)).not.toContain(c)
    }
  })

  it('reads no emails and no Work fields at levels 1 and 2', () => {
    for (const c of ['email_true_north', 'email_goodnews', 'email_coe', 'employment_type', 'schedule', 'weekly_hours', 'hire_date']) {
      expect(cols(LIST_COLUMNS_BASE)).not.toContain(c)
    }
  })
})

describe('what each row carries, by the items open (P6)', () => {
  const none = new Set<string>()

  it('company emails with Emails only; the GoodNews one with Portal access too', () => {
    expect(listGates(can('d-emails'), none)).toMatchObject({ emails: true, login: true })
    expect(listGates(can('d-portal'), none)).toMatchObject({ emails: false, login: true })
    expect(listGates(can('d-invite'), none)).toMatchObject({ emails: false, login: true })
    expect(listGates(can('d-edit'), none)).toMatchObject({ emails: false, login: false })
  })

  it("Work fields only for the people whose Work tab the viewer opens", () => {
    expect(listGates(can('p-work', 'p-any'), none).work('anyone')).toBe(true)
    const lead = listGates(can('p-work', 'p-led'), new Set(['ana']))
    expect(lead.work('ana')).toBe(true)
    expect(lead.work('bo')).toBe(false)
    expect(listGates(can('p-any'), none).work('anyone')).toBe(false)
  })
})
