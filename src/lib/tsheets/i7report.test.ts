import { describe, it, expect } from 'vitest'
import { mapCodeToProject, buildI7Report, buildI7Days, personLabels } from './i7report'
import type { I7Entry } from './types'

describe('mapCodeToProject', () => {
  it('maps a code to its project by prefix', () => {
    expect(mapCodeToProject('WM-SEO')).toBe('Wagner Meters (WM)')
    expect(mapCodeToProject('BE-CONTENT')).toBe('Bessemeter')
    expect(mapCodeToProject('MME-X')).toBe('Moisture Meters (MME)')
    expect(mapCodeToProject('I7-MKTG')).toBe('i7 Marketing')
  })
  it('is case-insensitive and trims whitespace', () => {
    expect(mapCodeToProject('  wm-seo ')).toBe('Wagner Meters (WM)')
  })
  it('falls back to Unassigned for an unknown prefix', () => {
    expect(mapCodeToProject('ZZ-X')).toBe('Unassigned')
  })
})

describe('buildI7Report', () => {
  const entries: I7Entry[] = [
    { personId: 'p1', duration: 3600, date: '2026-07-01', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p1', duration: 1800, date: '2026-07-02', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p2', duration: 3600, date: '2026-07-03', i7Code: 'BE-CONTENT', activity: 'Content: Writing' },
  ]
  const rates = { p1: 60, p2: 60 }
  /** The builder asks per person and per month now; these fixtures do not vary by month. */
  const flat = (r: Record<string, number>) => (pid: string) => r[pid] ?? 0
  const names = { p1: 'Alice', p2: 'Bob' }

  it('rolls hours + cost up the project → job code → activity tree', () => {
    const r = buildI7Report(entries, flat(rates), names, '2026-07-01')
    expect(r.totalHours).toBe(2.5)  // 1 + 0.5 + 1
    expect(r.totalCost).toBe(150)   // 2.5h × $60
    const wm = r.projects.find(p => p.project === 'Wagner Meters (WM)')!
    expect(wm.hours).toBe(1.5)
    expect(wm.cost).toBe(90)
    expect(wm.jobcodes).toHaveLength(1)
    expect(wm.jobcodes[0].code).toBe('WM-SEO')
    expect(wm.jobcodes[0].activities[0]).toMatchObject({ activity: 'SEO: Routine', hours: 1.5 })
  })

  it('accumulates hours into per-person columns', () => {
    const r = buildI7Report(entries, flat(rates), names, '2026-07-01')
    const wm = r.projects.find(p => p.project === 'Wagner Meters (WM)')!
    expect(wm.byPerson['Alice']).toBe(1.5)
    expect(r.people).toEqual(expect.arrayContaining(['Alice', 'Bob']))
  })

  // A column is a person, and a person with no hours this month has no column.
  // The rows behave the other way round on purpose: a budgeted project that was
  // not worked still shows, reading zero.
  it('gives a column only to people with hours in the month', () => {
    const r = buildI7Report(entries, flat(rates), { ...names, p3: 'Barack' }, '2026-07-01')
    expect(r.people).toEqual(['Alice', 'Bob'])
    expect(r.people).not.toContain('Barack')
  })

  it('keeps a budgeted project without hours, as a row reading zero', () => {
    const r = buildI7Report(entries, flat(rates), names, '2026-07-01', {
      projects: ['Wagner Meters (WM)', 'Bessemeter', 'Moisture Meters (MME)'],
      jobcodesByProject: { 'Moisture Meters (MME)': ['MME-X'] },
    })
    const mme = r.projects.find(p => p.project === 'Moisture Meters (MME)')!
    expect(mme.hours).toBe(0)
    expect(r.people).toEqual(['Alice', 'Bob'])   // and still no empty columns
  })

  it('does not buy a column with an entry that rounds to nothing', () => {
    const r = buildI7Report(
      [...entries, { personId: 'p3', duration: 1, date: '2026-07-04', i7Code: 'WM-SEO', activity: 'SEO: Routine' }],
      flat(rates), { ...names, p3: 'Barack' }, '2026-07-01',
    )
    expect(r.people).not.toContain('Barack')
  })

  it('sets hasRates only when a rate is present', () => {
    expect(buildI7Report(entries, flat({}), names, '2026-07-01').hasRates).toBe(false)
    expect(buildI7Report(entries, flat(rates), names, '2026-07-01').hasRates).toBe(true)
  })

  it('derives the month label from the start date', () => {
    expect(buildI7Report(entries, flat(rates), names, '2026-07-01').month).toBe('July 2026')
  })
})

// The export splits a range back into months, while the screen adds the range
// up. If those two ever disagree, the CSV stops being the same report, and the
// person reconciling it has no way to tell which one is lying.
describe('a range split by month', () => {
  const names = { p1: 'Alice', p2: 'Bob' }
  const spread: I7Entry[] = [
    { personId: 'p1', duration: 3600, date: '2026-01-05', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p1', duration: 5400, date: '2026-02-11', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p2', duration: 7200, date: '2026-02-20', i7Code: 'BE-CONTENT', activity: 'Content: Writing' },
    { personId: 'p2', duration: 1800, date: '2026-03-02', i7Code: 'BE-CONTENT', activity: 'Content: Writing' },
  ]
  // A rate that changes inside the range, which is the case a single number per
  // person could not carry and the reason the builder asks per month.
  const rate = (_pid: string, ym: string) => (ym >= '2026-02' ? 100 : 80)
  const months = ['2026-01', '2026-02', '2026-03']

  it('adds back up to the range built in one go', () => {
    const whole = buildI7Report(spread, rate, names, '2026-01-01')
    const parts = months.map(ym =>
      buildI7Report(spread.filter(e => e.date.slice(0, 7) === ym), rate, names, `${ym}-01`))

    const hours = parts.reduce((s, r) => s + r.totalHours, 0)
    const cost = parts.reduce((s, r) => s + r.totalCost, 0)

    expect(hours).toBeCloseTo(whole.totalHours, 2)
    expect(cost).toBeCloseTo(whole.totalCost, 2)
  })

  it('costs each month at the rate that month had', () => {
    const [jan, feb] = months.map(ym =>
      buildI7Report(spread.filter(e => e.date.slice(0, 7) === ym), rate, names, `${ym}-01`))

    expect(jan.totalCost).toBeCloseTo(1 * 80, 2)          // one hour at the old rate
    expect(feb.totalCost).toBeCloseTo((1.5 + 2) * 100, 2) // three and a half at the new one
  })

  it('gives a month nobody logged to no rows at all', () => {
    const april = buildI7Report(spread.filter(e => e.date.slice(0, 7) === '2026-04'), rate, names, '2026-04-01')
    expect(april.totalHours).toBe(0)
    expect(april.people).toEqual([])
  })
})

// The dated export and the screen read the same entries. If they ever stop
// agreeing, the person reconciling the file has no way to tell which is right.
describe('buildI7Days', () => {
  const names = { p1: 'Alice', p2: 'Bob' }
  const rate = (_pid: string, ym: string) => (ym >= '2026-02' ? 100 : 80)
  const spread: I7Entry[] = [
    { personId: 'p1', duration: 3600, date: '2026-01-05', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p1', duration: 5400, date: '2026-02-11', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p2', duration: 7200, date: '2026-02-20', i7Code: 'MME-MKTG', activity: 'Content: Writing' },
    { personId: 'p2', duration: 1800, date: '2026-03-02', i7Code: 'BE-CONTENT', activity: 'Content: Writing' },
  ]

  it('adds back up to the tree over the same entries', () => {
    const tree = buildI7Report(spread, rate, names, '2026-01-01')
    const days = buildI7Days(spread, rate, names)

    expect(days.reduce((s, d) => s + d.hours, 0)).toBeCloseTo(tree.totalHours, 2)
    expect(days.reduce((s, d) => s + d.cost, 0)).toBeCloseTo(tree.totalCost, 2)
  })

  it('gives every row a real date, in order', () => {
    const days = buildI7Days(spread, rate, names)
    expect(days.map(d => d.date)).toEqual(['2026-01-05', '2026-02-11', '2026-02-20', '2026-03-02'])
    for (const d of days) expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  // One person, one code, one day, two punches. That is one line of work, and
  // two rows of it would read as a double entry.
  it('joins two entries on the same day into one row', () => {
    const twice: I7Entry[] = [
      { personId: 'p1', duration: 3600, date: '2026-01-05', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
      { personId: 'p1', duration: 1800, date: '2026-01-05', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    ]
    const days = buildI7Days(twice, rate, names)
    expect(days).toHaveLength(1)
    expect(days[0].hours).toBeCloseTo(1.5, 2)
  })

  it('sends Moisture Meters to its own invoice', () => {
    const days = buildI7Days(spread, rate, names)
    expect(days.find(d => d.code === 'MME-MKTG')?.invoice).toBe('MME')
    expect(days.find(d => d.code === 'WM-SEO')?.invoice).toBe('i7')
  })

  it('costs a day at the rate its own month had', () => {
    const days = buildI7Days(spread, rate, names)
    expect(days.find(d => d.date === '2026-01-05')?.cost).toBeCloseTo(80, 2)
    expect(days.find(d => d.date === '2026-02-11')?.cost).toBeCloseTo(150, 2)
  })
})

describe('the lines of an invoice add up to its total (audit, 9 October 2026)', () => {
  // Two job codes of 7 minutes each at $95: $11.0833 each. Rounding each level
  // on its own printed $11.08 + $11.08 under a total of $22.17.
  const entries: I7Entry[] = [
    { personId: 'p1', duration: 420, date: '2026-09-01', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 'p1', duration: 420, date: '2026-09-02', i7Code: 'WM-CONTENT', activity: 'Content: Writing' },
  ]
  const r = buildI7Report(entries, () => 95, { p1: 'Alice' }, '2026-09-01')
  const cents = (n: number) => Math.round(n * 100)

  it('job codes add up to their project, projects to the total, to the cent', () => {
    for (const p of r.projects) {
      expect(cents(p.cost)).toBe(p.jobcodes.reduce((s, j) => s + cents(j.cost), 0))
      for (const j of p.jobcodes) expect(cents(j.cost)).toBe(j.activities.reduce((s, a) => s + cents(a.cost), 0))
    }
    expect(cents(r.totalCost)).toBe(r.projects.reduce((s, p) => s + cents(p.cost), 0))
    expect(r.totalCost).toBe(22.16)
  })

  it('hours add up the same way', () => {
    expect(Math.round(r.totalHours * 100)).toBe(r.projects.reduce((s, p) => s + Math.round(p.hours * 100), 0))
  })

  it('ends a month on its last day, whatever the server time zone', () => {
    expect(r.endDate).toBe('2026-09-30')
  })
})

// Keyed by first name, two Anas were one column holding both their hours, one
// average rate and one line in the export (audit, 13 October 2026).
describe('personLabels', () => {
  it('uses the first name alone while nobody else in the report shares it', () => {
    expect(personLabels(['a', 'b'], { a: 'Ana Souza', b: 'Bob Lee' })).toEqual({ a: 'Ana', b: 'Bob' })
  })

  it('adds the last initial when two people in the report share a first name', () => {
    expect(personLabels(['a', 't', 'b'], { a: 'Ana Souza', t: 'Ana Torres', b: 'Bob Lee' }))
      .toEqual({ a: 'Ana S.', t: 'Ana T.', b: 'Bob' })
  })

  it('decides by who is in the report, not by the whole directory', () => {
    expect(personLabels(['a'], { a: 'Ana Souza', t: 'Ana Torres' })).toEqual({ a: 'Ana' })
  })

  it('treats "ana" and "Ana" as the same first name', () => {
    expect(personLabels(['a', 't'], { a: 'Ana Souza', t: 'ana torres' })).toEqual({ a: 'Ana S.', t: 'ana T.' })
  })

  it('never gives two people one label', () => {
    const fullNames = { a1000000: 'Ana Souza', s2000000: 'Ana Silva', d3000000: 'Ana Souza', o4000000: 'Ana' }
    const out = personLabels(Object.keys(fullNames), fullNames)
    expect(new Set(Object.values(out)).size).toBe(4)
    expect(out.o4000000).toBe('Ana')
    expect(out.s2000000).toBe('Ana Silva')
    expect(out.a1000000).toBe('Ana Souza (a1000000)')
  })

  it('shows the id for a person with no name, rather than nothing', () => {
    expect(personLabels(['abcdef1234'], {})).toEqual({ abcdef1234: 'Person abcdef12' })
  })
})

describe('two people with the same first name', () => {
  const entries: I7Entry[] = [
    { personId: 'a', duration: 3600, date: '2026-07-01', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { personId: 't', duration: 7200, date: '2026-07-01', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
  ]
  const names = personLabels(['a', 't'], { a: 'Ana Souza', t: 'Ana Torres' })
  const rate = (pid: string) => (pid === 'a' ? 50 : 100)

  it('keeps their hours in two columns, not one', () => {
    const r = buildI7Report(entries, rate, names, '2026-07-01')
    expect(r.people).toEqual(['Ana S.', 'Ana T.'])
    const wm = r.projects.find(p => p.project === 'Wagner Meters (WM)')!
    expect(wm.byPerson).toEqual({ 'Ana S.': 1, 'Ana T.': 2 })
    expect(r.totalCost).toBe(250)
  })

  it('keeps them on two lines of the dated export', () => {
    const days = buildI7Days(entries, rate, names)
    expect(days).toHaveLength(2)
    expect(days.map(d => [d.person, d.hours, d.cost])).toEqual([['Ana S.', 1, 50], ['Ana T.', 2, 200]])
  })
})
