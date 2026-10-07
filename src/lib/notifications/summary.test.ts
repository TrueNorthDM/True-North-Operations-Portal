import { describe, it, expect } from 'vitest'
import { holidayOn, isWorkingDay, missedDays, previousWorkingDay, usHolidays } from './calendar'
import { zoneDate, zoneHour, validZone } from './schedule'
import { categoryOf, firstName } from './summary'
import { countOf, renderSummary, sectionsOf, statsOf, subjectOf, type SummaryItem } from '@/lib/email/summary'
import { zoneLabel, zoneOptions } from './zones'

describe('the US federal holidays', () => {
  it('works out 2026 as the government observes it', () => {
    expect([...usHolidays(2026).keys()]).toEqual([
      '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03',
      '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
    ])
  })

  it('moves a Saturday holiday to Friday and a Sunday one to Monday', () => {
    expect(holidayOn('2026-07-03')).toBe('Independence Day') // 4 July 2026 is a Saturday
    expect(holidayOn('2027-12-24')).toBe('Christmas Day') // 25 December 2027 is a Saturday
    expect(holidayOn('2028-01-17')).toBe('Martin Luther King Jr. Day')
    expect(holidayOn('2027-12-31')).toBe("New Year's Day") // 1 January 2028 is a Saturday
  })
})

describe('the working calendar', () => {
  it('skips weekends and holidays', () => {
    expect(isWorkingDay('2026-10-09')).toBe(true) // Friday
    expect(isWorkingDay('2026-10-10')).toBe(false) // Saturday
    expect(isWorkingDay('2026-10-12')).toBe(false) // Columbus Day
    expect(isWorkingDay('2026-10-13')).toBe(true)
  })

  it('knows what a catch-up covers', () => {
    expect(previousWorkingDay('2026-10-13')).toBe('2026-10-09')
    expect(missedDays('2026-10-13')).toEqual([
      { day: '2026-10-10', holiday: null },
      { day: '2026-10-11', holiday: null },
      { day: '2026-10-12', holiday: 'Columbus Day' },
    ])
    expect(missedDays('2026-10-08')).toEqual([])
  })
})

describe('time zones', () => {
  it('tells the day and the hour in a zone', () => {
    const t = new Date('2026-10-07T02:30:00Z')
    expect(zoneDate(t)).toBe('2026-10-06')
    expect(zoneDate(t, 'Asia/Manila')).toBe('2026-10-07')
    expect(zoneHour(t, 'America/Sao_Paulo')).toBe(23)
  })

  it('falls back to New York for a zone nobody knows', () => {
    expect(validZone('Mars/Olympus')).toBe('America/New_York')
    expect(validZone(null)).toBe('America/New_York')
    expect(validZone('Europe/Lisbon')).toBe('Europe/Lisbon')
  })

  it('says zones the way people read them', () => {
    expect(zoneLabel(null)).toBe('New York (US Eastern)')
    expect(zoneLabel('Asia/Ho_Chi_Minh')).toBe('Ho Chi Minh')
    expect(zoneOptions()[0]).toEqual({ value: 'America/New_York', label: 'New York (US Eastern)', group: 'Common' })
  })
})

const item = (type: string, title: string, day = '2026-10-07'): SummaryItem => ({ type, title, body: 'Body.', href: '/my-work', day })

describe('the summary email', () => {
  it('counts what a folded notification stands for', () => {
    expect(countOf('3 new steps were assigned to you')).toBe(3)
    expect(countOf('A step of yours is due tomorrow')).toBe(1)
  })

  it('splits by category and keeps the catalogue order', () => {
    expect(categoryOf('step-late')).toBe('tools')
    expect(categoryOf('first-login')).toBe('system')
    const items = [item('step-late', 'A step of yours became late'), item('step-assigned', '2 new steps were assigned to you'), item('first-login', 'x')]
    const s = sectionsOf('tools', items)
    expect(s.map(x => x.type)).toEqual(['step-assigned', 'step-late'])
    expect(statsOf(s)).toEqual([
      { type: 'step-assigned', count: 2, label: 'assigned', alarm: false },
      { type: 'step-late', count: 1, label: 'late', alarm: true },
    ])
  })

  it('names the day in the subject, and the catch-up says since when', () => {
    const stats = statsOf(sectionsOf('tools', [item('step-assigned', '2 new steps were assigned to you')]))
    expect(subjectOf({ category: 'tools', today: '2026-10-07', missed: [] }, stats)).toBe('Your day: 2 assigned')
    expect(subjectOf({ category: 'tools', today: '2026-10-13', missed: missedDays('2026-10-13') }, stats)).toBe('What you missed since Friday: 2 updates')
    expect(subjectOf({ category: 'system', today: '2026-10-07', missed: [], test: true }, stats)).toBe('Test: The portal today: 2 assigned')
  })

  it('writes a whole email with links back to the portal, safely', () => {
    const mail = renderSummary({
      category: 'tools', firstName: 'Ana', today: '2026-10-13', missed: missedDays('2026-10-13'), origin: 'https://truenorthportal.online',
      zoneLabel: 'New York (US Eastern)', items: [item('step-late', 'A step <b>late</b>', '2026-10-12')],
    })
    expect(mail.html).toContain('What you missed since Friday')
    expect(mail.html).toContain('Columbus Day')
    expect(mail.html).toContain('https://truenorthportal.online/my-work')
    expect(mail.html).toContain('A step &lt;b&gt;late&lt;/b&gt;')
    expect(mail.html).not.toContain(String.fromCharCode(0x2014))
    expect(mail.text).toContain('[Mon, Oct 12] A step <b>late</b>: Body.')
  })

  it('greets by first name', () => {
    expect(firstName('Ana Maria Souza')).toBe('Ana')
    expect(firstName('  ')).toBe('there')
  })
})
