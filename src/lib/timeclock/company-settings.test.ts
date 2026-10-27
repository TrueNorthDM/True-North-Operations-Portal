import { describe, it, expect } from 'vitest'
import { jobErrorText } from './company-settings'

const nameOf = (id: string) => (id === 'p1' ? 'Tina Gennette' : 'Someone else')
const NY = 'America/New_York'

describe('Integrations errors (13A)', () => {
  it('names the person of a time off job, with its kind and days', () => {
    expect(jobErrorText({ who: 'Tina Gennette', kind: 'Vacation', start: '2026-10-29', end: '2026-10-29' }, 'Forbidden', nameOf, NY))
      .toMatch(/^Tina Gennette, Vacation, Thu, Oct 29.*: "Forbidden"$/)
    expect(jobErrorText({ person_id: 'p1', start: '2026-10-04', end: '2026-10-17' }, 'Forbidden', nameOf, NY))
      .toBe('Tina Gennette, Oct 4 to Oct 17: "Forbidden"')
  })

  it('names an Agenda event by its title and day, never "Someone" (audit, 27 October 2026)', () => {
    const allDay = jobErrorText({ summary: 'All hands', start: '2026-11-02', end: '2026-11-02' }, 'Not found', nameOf, NY)
    expect(allDay).toMatch(/^"All hands", Mon, Nov 2.*: "Not found"$/)
    // A timed event carries instants: its day in the viewer's zone (10 PM in New York, 02:00 UTC the next day).
    const timed = jobErrorText({ summary: 'Planning', startAt: '2026-11-03T03:00:00.000Z', endAt: '2026-11-03T04:00:00.000Z', timeZone: NY }, 'Not found', nameOf, NY)
    expect(timed).toMatch(/^"Planning", Mon, Nov 2.*: "Not found"$/)
    expect(timed).not.toMatch(/Someone/)
  })
})
