import { describe, expect, it } from 'vitest'
import {
  ACTIVITIES, ACTIVITY_FAMILIES, OLD_ACTIVITIES, OLD_PROJECTS, OLD_TASKS, STRUCTURE, allProjects, i7DivisionOf, oldI7Code, placeText,
  oldEntryClient, reportActivity, translateActivity, translateOldEntry, translateProject, translatesActivityOn, type Place,
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

describe('the client of an old entry (owner, 29 October 2026)', () => {
  it('keeps the folder\'s client outside "1 - True North"', () => {
    expect(oldEntryClient('i7 Marketing', 'AAAF', 'True North')).toBe('i7 Marketing')
    expect(oldEntryClient('COE Group', 'In-House', 'True North')).toBe('COE Group')
    expect(oldEntryClient(null, 'AAAF', 'COE')).toBeNull()
  })
  it('reads the Project first under "1 - True North", whatever the Company says', () => {
    expect(oldEntryClient('True North Internal', 'AAAF', 'True North')).toBe('COE Group')
    expect(oldEntryClient('True North Internal', 'Africa', 'True North')).toBe('COE Group')
    expect(oldEntryClient('True North Internal', 'GP church', null)).toBe('COE Group')
  })
  it('falls back to the Company for In-House or no project', () => {
    expect(oldEntryClient('True North Internal', 'In-House', 'True North')).toBe('True North Internal')
    expect(oldEntryClient('True North Internal', 'In-House', 'COE')).toBe('COE Group')
    expect(oldEntryClient('True North Internal', '', 'GNA/COEI')).toBe('COE Group')
    expect(oldEntryClient('True North Internal', 'not listed--ask Dave', 'DDI')).toBe('COE Group')
    expect(oldEntryClient('True North Internal', null, null)).toBe('True North Internal')
    expect(oldEntryClient('True North Internal', 'In-House', 'True North', 'Fundraising')).toBe('COE Group')
  })
  it('settles the values that were waiting for a decision', () => {
    for (const t of OLD_ACTIVITIES) expect(t.sure, t.old).not.toBe('check')
    for (const t of OLD_TASKS) expect(t.sure, t.old).not.toBe('check')
    const fund = translateActivity('Fundraising')
    expect(fund?.to).toBe('Marketing: Strategy & Campaigns')
    expect(fund?.place && exists(fund.place)).toBe(true)
    expect(ACTIVITIES.some(a => a.name === fund?.to)).toBe(true)
  })
})

describe('a whole TSheets entry, translated (owner, 29 October 2026)', () => {
  const tn = { folderClient: 'True North Internal', folderName: '1 - True North' }
  it('reads an i7 job by its code, and says so when the code is not one', () => {
    expect(translateOldEntry({ folderClient: 'i7 Marketing', folderName: '2 -  i7 Marketing', code: 'WMFL-MKTG', activity: 'WebDev' }))
      .toEqual({ client: 'i7 Marketing', division: 'Wagner Meters', project: 'WMFL-MKTG', activity: 'Web Dev & Systems', sure: 'same' })
    expect(translateOldEntry({ folderClient: 'i7 Marketing', folderName: '2 - i7 Marketing', code: '1 None', activity: 'WebDev' }))
      .toMatchObject({ client: 'i7 Marketing', division: null, project: null, sure: 'none' })
  })
  it('places the HFA folder under Africa › HopeFor.Africa', () => {
    expect(translateOldEntry({ folderClient: 'COE Group', folderName: 'Adventist Messengers/HFA', activity: 'Translation' }))
      .toEqual({ client: 'COE Group', division: 'Africa', project: 'HopeFor.Africa', activity: 'Content: Translation', sure: 'same' })
  })
  it('reads "1 - True North" by its Project, then its Company', () => {
    expect(translateOldEntry({ ...tn, project: 'AAAF', company: 'True North', activity: 'Content: Writing' }))
      .toMatchObject({ client: 'COE Group', division: 'Seeker Outreach', project: 'AAAF', activity: 'Content: Writing', sure: 'same' })
    expect(translateOldEntry({ ...tn, project: 'In-House', company: 'COE', activity: 'General admin' }))
      .toMatchObject({ client: 'COE Group', division: null, project: null, activity: 'Admin', sure: 'closest' })
    expect(translateOldEntry({ ...tn, project: 'In-House', company: 'True North', activity: 'Management' }))
      .toMatchObject({ client: 'True North Internal', division: null, project: null, activity: 'Leadership/Management' })
    expect(translateOldEntry({ ...tn, project: 'Africa', company: 'COE' })).toMatchObject({ client: 'COE Group', division: 'Africa', project: null })
  })
  it('places Fundraising in its division, whatever the Company says', () => {
    expect(translateOldEntry({ ...tn, project: 'In-House', company: 'True North', activity: 'Fundraising' }))
      .toMatchObject({ client: 'COE Group', division: 'Fundraising', project: 'Fundraising General', activity: 'Marketing: Strategy & Campaigns', sure: 'closest' })
  })
  it('falls back to Tasks for the Activity', () => {
    expect(translateOldEntry({ ...tn, project: 'AAAF', task: 'Translation: Review/Edit' }).activity).toBe('Content: Translation')
    expect(translateOldEntry({ ...tn, project: 'AAAF', activity: 'SEO Research', task: 'Graphics' }).activity).toBe('SEO: Research')
  })
  it('says nothing it does not know', () => {
    expect(translateOldEntry({ folderClient: null, folderName: 'Mystery', activity: 'WebDev' })).toMatchObject({ client: null, division: null, project: null, sure: 'none' })
    expect(translateOldEntry({ ...tn, project: 'In-House', company: 'COE', activity: 'Basket weaving' })).toMatchObject({ client: 'COE Group', activity: null, sure: 'none' })
  })
})

describe('report Activity names by date', () => {
  it('names a TSheets Activity in the 2026 list from the switch date\'s month, never with no date', () => {
    expect(translatesActivityOn('2026-11-01', '2026-11-08')).toBe(true)
    expect(translatesActivityOn('2026-10-31', '2026-11-08')).toBe(false)
    expect(translatesActivityOn('2026-11-30', null)).toBe(false)
    expect(reportActivity('WebDev', '', '2026-11-02', '2026-11-08')).toBe('Web Dev & Systems')
    expect(reportActivity('WebDev', '', '2026-10-02', '2026-11-08')).toBe('WebDev')
    expect(reportActivity('', 'Graphics', '2026-11-02', '2026-11-08')).toBe('Design/Graphics')
    expect(reportActivity('Basket weaving', '', '2026-11-02', '2026-11-08')).toBe('Basket weaving')
    expect(reportActivity(null, null, '2026-11-02', '2026-11-08')).toBe('')
  })
})
