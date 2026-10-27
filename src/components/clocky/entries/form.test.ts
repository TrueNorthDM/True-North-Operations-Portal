import { describe, expect, it } from 'vitest'
import type { EntryView, PanelField, PanelJob } from '@/lib/timeclock/clocky-types'
import { fieldsForJob } from '@/components/clocky/clock/clock-model'
import { fieldsOf, formFromRow, formJob } from './form'

const FIELDS: PanelField[] = [
  { key: 'company', id: '1', label: '1 Company', options: ['True North'], required: 'always' },
  { key: 'project', id: '2', label: '2 Project', options: ['In-House'], required: 'always' },
  { key: 'activity', id: '3', label: '3 Activity', options: ['WebDev'], required: 'always' },
  { key: 'billable', id: '4', label: '4 Billable', options: ['yes', 'no'], required: 'always' },
  { key: 'activity', id: '9', label: 'Activity', options: ['Design', 'Other'], required: 'always', structure: 2 },
]
const JOBS: PanelJob[] = [
  { id: 11, name: 'Web Dev', path: '1 - True North › Web Dev', short: 'TN › Web Dev', folderId: null, isI7: false, use: null, billable: false, order: 0 },
  { id: 50, name: 'Website', path: 'TN › Digital › Website', short: 'Website', folderId: null, isI7: false, use: null, billable: true, order: 0, structure: 2 },
]

/** An entry of a 2026 project as Time entries lists it. */
const row = (o: Partial<EntryView>): EntryView => ({
  key: 'e1', rowType: 'entry', id: 1, personId: 'p', personName: 'Wendy Cacka', initials: 'WC', team: null, zone: 'America/New_York', zoneAbbr: '',
  date: '2026-11-03', start: '2026-11-03T13:00:00.000Z', end: '2026-11-03T14:00:00.000Z', running: false, timeText: '', seconds: 3600,
  jobcodeId: 60, path: 'TN › Digital › Old site', short: 'Old site', client: 'TN', isI7: false, structure: 2, fields: { 9: 'Design' },
  company: '', project: '', activity: 'Design', billable: 'yes', code: '', notes: '', kind: 'clock', imported: false, pills: [],
  autoOut: null, edited: null, clockedOutBy: null, locked: false, lockWhy: null, canEdit: true, shortenOnly: false, canDelete: true,
  canContinue: false, continuesPrevious: false, attention: null, correction: null, timeOff: null, ...o,
})

describe('the entry form keeps a switched-off 2026 project\'s Activity (audit 2026-10-27)', () => {
  it('sends the Activity under the 2026 field, the one the server keeps', () => {
    // Job 60 is switched off, so it is not in the list the form offers.
    const f = formFromRow(row({}))
    expect(formJob(f, JOBS)).toEqual({ structure: 2 })
    expect(fieldsOf(f.values, fieldsForJob(FIELDS, formJob(f, JOBS)), false)).toEqual({ 9: 'Design' })
    // Without the entry's structure it went out as the TSheets Activity, which the server drops for a 2026 project.
    expect(fieldsOf(f.values, fieldsForJob(FIELDS, undefined), false)).toEqual({ 3: 'Design', 4: 'yes' })
  })

  it('a job picked from the list is the one asked, and a TSheets entry stays a TSheets one', () => {
    expect(formJob({ jobcodeId: 50, structure: 1 }, JOBS)).toBe(JOBS[1])
    expect(formJob(formFromRow(row({ jobcodeId: 11, structure: 1 })), JOBS)).toBe(JOBS[0])
    expect(formJob({ jobcodeId: 70, structure: undefined }, JOBS)).toBeUndefined()
  })
})
