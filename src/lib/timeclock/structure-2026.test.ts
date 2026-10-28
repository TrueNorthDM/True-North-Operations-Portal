import { describe, expect, it } from 'vitest'
import {
  ACTIVITIES, ACTIVITY_FAMILIES, OLD_ACTIVITIES, OLD_PROJECTS, OLD_TASKS, STRUCTURE, allProjects, i7DivisionOf, oldI7Code, placeText,
  translateActivity, translateProject, type Place,
} from './structure-2026'

const projects = allProjects()
const exists = (pl: Place) => STRUCTURE.some(c => c.name === pl.client
  && (pl.division == null || c.divisions.some(d => d.name === pl.division && (pl.project == null || d.projects.some(p => p.name === pl.project))))
  && (pl.division != null || pl.project == null || c.projects.some(p => p.name === pl.project)))

describe('the 2026 structure', () => {
  it('has the 26 activities of David\'s document, in 8 families, each once', () => {
    expect(ACTIVITIES).toHaveLength(26)
    expect(ACTIVITY_FAMILIES).toEqual(['Content', 'Creative', 'Web & Systems', 'SEO', 'Marketing', 'Outreach', 'Events', 'Operations'])
    expect(new Set(ACTIVITIES.map(a => a.name)).size).toBe(26)
    expect(ACTIVITIES.filter(a => a.notesRequired).map(a => a.name)).toEqual(['Meeting: Other', 'Other'])
  })
  it('gives i7 four divisions with the 21 codes, and keeps billable by client', () => {
    const i7 = projects.filter(p => p.client === 'i7 Marketing')
    expect(i7).toHaveLength(21)
    expect(new Set(i7.map(p => p.division))).toEqual(new Set(['i7 Marketing', 'Wagner Meters', 'Bessemeter', 'Moisture Meters']))
    expect(projects.filter(p => p.client === 'True North Internal').every(p => !p.billable)).toBe(true)
    expect(projects.filter(p => p.client !== 'True North Internal').every(p => p.billable)).toBe(true)
  })
  it('never repeats a project inside a division', () => {
    const keys = projects.map(p => placeText(p))
    expect(new Set(keys).size).toBe(keys.length)
  })
  it('names events "Event: " and keeps the Grants Pass names the report looks for', () => {
    const coe = STRUCTURE.find(c => c.name === 'COE Group')!
    expect(coe.divisions.map(d => d.name)).toContain('Event: ASI')
    expect(coe.divisions.find(d => d.name === 'Client: Grants Pass')!.projects.map(p => p.name).every(n => /^GP (Church|School)$/.test(n))).toBe(true)
  })
})

describe('the translation table', () => {
  it('points only at places and activities that exist', () => {
    for (const t of OLD_PROJECTS) if (t.to && typeof t.to !== 'string') expect(exists(t.to), t.old).toBe(true)
    const names = new Set(ACTIVITIES.map(a => a.name))
    for (const t of [...OLD_ACTIVITIES, ...OLD_TASKS]) if (typeof t.to === 'string') expect(names.has(t.to), t.old).toBe(true)
  })
  it('explains every line that is not the same thing', () => {
    for (const t of [...OLD_PROJECTS, ...OLD_ACTIVITIES, ...OLD_TASKS]) if (t.sure === 'check' || t.sure === 'none') expect(t.why, t.old).toBeTruthy()
  })
  it('reads old values whatever their case and spacing', () => {
    expect(translateProject('  gp CHURCH ')?.to).toEqual({ client: 'COE Group', division: 'Client: Grants Pass', project: 'GP Church' })
    expect(translateActivity('Content: Revision')?.to).toBe('Content: Editing')
    expect(translateProject('Nowhere')).toBeNull()
  })
  it('puts each i7 code under the block of the i7 report', () => {
    expect(i7DivisionOf('MME-WEBDVT')).toBe('Moisture Meters')
    expect(i7DivisionOf('WMFL-MKTG')).toBe('Wagner Meters')
    expect(i7DivisionOf('i7-ADMIN')).toBe('i7 Marketing')
    expect(i7DivisionOf('1 None')).toBeNull()
    expect(oldI7Code('BE-MKTG').to).toEqual({ client: 'i7 Marketing', division: 'Bessemeter', project: 'BE-MKTG' })
  })
})
