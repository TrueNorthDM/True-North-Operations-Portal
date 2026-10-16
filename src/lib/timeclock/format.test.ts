import { describe, it, expect } from 'vitest'
import {
  clientOf, dateLabel, dayLabel, hhmm, initials, localDate, longDateLabel, rangeLabel, rangeLabelYear, shortJob, stampLabel,
  timeLabel, timeWithZone, zoneAbbr,
} from './format'

const NY = 'America/New_York'
const NBO = 'Africa/Nairobi'

describe('times in the person\'s own zone', () => {
  it('writes 12-hour times with a plain space before AM and PM', () => {
    expect(timeLabel('2026-10-15T12:00:00Z', NY)).toBe('8:00 AM')
    expect(timeLabel('2026-10-15T17:00:00Z', NBO)).toBe('8:00 PM')
    expect(timeLabel('2026-10-15T04:00:00Z', NY)).toBe('12:00 AM')
    expect(timeLabel('2026-10-15T16:00:00Z', NY)).toBe('12:00 PM')
  })

  it('knows the day in the zone, not in UTC', () => {
    expect(localDate('2026-10-16T02:00:00Z', NY)).toBe('2026-10-15')
    expect(localDate('2026-10-15T22:00:00Z', NBO)).toBe('2026-10-16')
  })

  it('gives the time pickers "HH:MM"', () => {
    expect(hhmm('2026-10-15T13:45:00Z', NY)).toBe('09:45')
  })

  it('adds the zone where people of several zones meet ("2:15 PM EAT")', () => {
    expect(timeWithZone('2026-10-15T11:15:00Z', NBO, NY)).toBe('2:15 PM EAT')
    expect(timeWithZone('2026-10-15T18:15:00Z', NY, NY)).toBe('2:15 PM')
    expect(zoneAbbr(NY, new Date('2026-10-15T12:00:00Z'))).toBe('EDT')
    expect(zoneAbbr(NY, new Date('2026-12-15T12:00:00Z'))).toBe('EST')
    expect(zoneAbbr('America/Chicago', new Date('2026-10-15T12:00:00Z'))).toBe('CDT')
    expect(zoneAbbr(NBO, new Date('2026-10-15T12:00:00Z'))).toBe('EAT')
  })
})

describe('days and ranges as the portal writes them', () => {
  it('writes "Thu, Oct 15", "Oct 9, 2026" and "Sunday, Oct 4, 2026"', () => {
    expect(dayLabel('2026-10-15')).toBe('Thu, Oct 15')
    expect(dateLabel('2026-10-09')).toBe('Oct 9, 2026')
    expect(longDateLabel('2026-10-04')).toBe('Sunday, Oct 4, 2026')
    expect(stampLabel('2026-10-15T21:12:00Z', NY)).toBe('Oct 15, 2026, 5:12 PM')
  })

  it('writes ranges like "Oct 11 to 17" and across months "Oct 25 to Nov 7"', () => {
    expect(rangeLabel('2026-10-11', '2026-10-17')).toBe('Oct 11 to 17')
    expect(rangeLabel('2026-10-25', '2026-11-07')).toBe('Oct 25 to Nov 7')
    expect(rangeLabelYear('2026-10-04', '2026-10-17')).toBe('Oct 4 to 17, 2026')
  })
})

describe('jobs', () => {
  it('shortens a job as the top bar does', () => {
    expect(shortJob('2 - i7 Marketing › Web Dev')).toBe('i7 › Web Dev')
    expect(shortJob('1 - True North › Administrative')).toBe('TN › Administrative')
    expect(shortJob('Adventist Messengers/HFA')).toBe('HFA')
    expect(shortJob('DDI')).toBe('DDI')
  })

  it('groups hours by client', () => {
    expect(clientOf('1 - True North › SEO')).toBe('True North')
    expect(clientOf('2 - i7 Marketing › Content')).toBe('i7 Marketing')
    expect(clientOf('Adventist Messengers/HFA')).toBe('HFA')
    expect(clientOf('GNA')).toBe('GNA')
  })

  it('makes initials', () => {
    expect(initials('Arnaldo Oliveira')).toBe('AO')
  })
})
