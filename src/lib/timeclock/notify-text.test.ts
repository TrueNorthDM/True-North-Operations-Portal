import { describe, it, expect } from 'vitest'
import { clockedOutForText, correctionDecidedText, correctionRequestedText, timeOffDecidedText, timeOffRequestedText, timesheetDecidedText, timesheetSubmittedText } from './notify-text'
import { autoStopsLine } from '@/lib/notifications/generators'

// The bell rows of Clock Safety.dc.html (N3, N4) and the Super Admins' daily line.

const NY = 'America/New_York'
const samuel = { started_at: '2026-10-13T20:00:00Z', ended_at: '2026-10-13T21:00:00Z', entry_date: '2026-10-13' }

describe("North Time's bell rows", () => {
  it('N3: a correction to review', () => {
    expect(correctionRequestedText('Samuel Manzi', samuel, NY))
      .toBe('Samuel Manzi asked for a time correction: 1h 00m on Tue, Oct 13, 4:00 PM to 5:00 PM.')
  })

  it('N4: the decision, approved or denied with the reason', () => {
    const clarise = { started_at: '2026-10-14T19:00:00Z', ended_at: '2026-10-14T20:30:00Z', entry_date: '2026-10-14' }
    expect(correctionDecidedText('Rock Kai', clarise, true, null))
      .toBe('Rock Kai approved your time correction: 1h 30m on Wed, Oct 14. It now counts in your hours.')
    const joy = { started_at: '2026-10-08T21:00:00Z', ended_at: '2026-10-08T21:30:00Z', entry_date: '2026-10-08' }
    expect(correctionDecidedText('Rock Kai', joy, false, 'That half hour is already in your Oct 8 entries.'))
      .toBe('Rock Kai denied your time correction for Thu, Oct 8 (0h 30m). Reason: "That half hour is already in your Oct 8 entries."')
  })

  it('time off asked for', () => {
    expect(timeOffRequestedText('Olivia Hale', 'Vacation', '2026-10-16', '2026-10-16', 8 * 3600))
      .toBe('Olivia Hale asked for time off: Vacation, Fri, Oct 16 (8h 00m).')
  })

  it('time off decided, to the person who asked', () => {
    expect(timeOffDecidedText('Dave Sharpe', 'Vacation', '2026-10-16', '2026-10-16', 8 * 3600, true, null))
      .toBe('Dave Sharpe approved your time off: Vacation, Fri, Oct 16 (8h 00m).')
    expect(timeOffDecidedText('Dave Sharpe', 'Sick', '2026-10-15', '2026-10-16', 16 * 3600, false, ' Not this week. '))
      .toBe('Dave Sharpe denied your time off: Sick, Thu, Oct 15 to Fri, Oct 16. Reason: "Not this week."')
  })

  it('clocked out by someone else, with the reason', () => {
    expect(clockedOutForText('Dave Sharpe', '3:45 PM', 'Forgot to clock out.'))
      .toBe('Dave Sharpe clocked you out at 3:45 PM. Reason: "Forgot to clock out."')
  })

  it('a timesheet sent, and what was decided', () => {
    expect(timesheetSubmittedText('Samuel Manzi', 'October 2026', 168.5 * 3600)).toBe('Samuel Manzi submitted October 2026 (168h 30m).')
    expect(timesheetDecidedText('Arnaldo Oliveira', 'October 2026', 'approve', null)).toBe('Arnaldo Oliveira approved your October 2026 timesheet.')
    expect(timesheetDecidedText('Arnaldo Oliveira', 'Oct 4 to 17, 2026', 'return', ' Oct 12 is empty. '))
      .toBe('Arnaldo Oliveira returned your Oct 4 to 17, 2026 timesheet. Reason: "Oct 12 is empty."')
    expect(timesheetDecidedText('Arnaldo Oliveira', 'October 2026', 'reopen', 'Wrong client on Oct 30.'))
      .toBe('Arnaldo Oliveira reopened your October 2026 timesheet. Reason: "Wrong client on Oct 30."')
  })

  it("the Super Admins' daily line", () => {
    expect(autoStopsLine(['Wendy Cacka', 'Justus Tsofa'])).toBe('2 automatic clock-outs yesterday: Wendy Cacka, Justus Tsofa.')
    expect(autoStopsLine(['Wendy Cacka'])).toBe('1 automatic clock-out yesterday: Wendy Cacka.')
  })
})
