import { describe, it, expect } from 'vitest'
import { mapCodeToProject, buildI7Report } from './i7report'
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
    { user_id: 1, duration: 3600, date: '2026-07-01', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { user_id: 1, duration: 1800, date: '2026-07-02', i7Code: 'WM-SEO', activity: 'SEO: Routine' },
    { user_id: 2, duration: 3600, date: '2026-07-03', i7Code: 'BE-CONTENT', activity: 'Content: Writing' },
  ]
  const rates = { 1: 60, 2: 60 }
  const names = { 1: 'Alice', 2: 'Bob' }

  it('rolls hours + cost up the project → job code → activity tree', () => {
    const r = buildI7Report(entries, rates, names, '2026-07-01')
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
    const r = buildI7Report(entries, rates, names, '2026-07-01')
    const wm = r.projects.find(p => p.project === 'Wagner Meters (WM)')!
    expect(wm.byPerson['Alice']).toBe(1.5)
    expect(r.people).toEqual(expect.arrayContaining(['Alice', 'Bob']))
  })

  it('sets hasRates only when a rate is present', () => {
    expect(buildI7Report(entries, {}, names, '2026-07-01').hasRates).toBe(false)
    expect(buildI7Report(entries, rates, names, '2026-07-01').hasRates).toBe(true)
  })

  it('derives the month label from the start date', () => {
    expect(buildI7Report(entries, rates, names, '2026-07-01').month).toBe('July 2026')
  })
})
