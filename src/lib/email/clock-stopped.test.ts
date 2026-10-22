import { describe, it, expect } from 'vitest'
import { renderClockStopped } from './clock-stopped'

// N2, Clocky's one email (Clock Safety.dc.html).

const base = { stoppedAt: '1:00 PM', clockedInAt: '8:00 AM', url: 'https://truenorthportal.online/clocky-hours?clock=open', origin: 'https://truenorthportal.online' }

describe('renderClockStopped', () => {
  it('says what happened, with one button to confirm the end time', () => {
    const m = renderClockStopped(base)
    expect(m.subject).toBe('Your clock stopped by itself at 1:00 PM')
    expect(m.html).toContain('Your clock stopped by itself</h1>')
    expect(m.html).toContain('Your clock stopped by itself at 1:00 PM. Confirm when you really stopped.')
    expect(m.html).toContain('>Confirm end time</a>')
    expect(m.html).toContain('href="https://truenorthportal.online/clocky-hours?clock=open"')
    expect(m.html).toContain('It ran 5h 00m without an answer since you clocked in at 8:00 AM.')
    expect(m.html).toContain('Sent to you because North Time stopped your clock.')
    expect(m.html).toContain('https://truenorthportal.online/logos/true-north.png')
    expect(m.text).toContain(base.url)
  })

  it('escapes what it is given, leaves no placeholders, and uses no dashes as punctuation', () => {
    const m = renderClockStopped({ ...base, stoppedAt: '<b>1:00 PM</b>' })
    expect(m.html).not.toContain('<b>1:00 PM</b>')
    expect(m.html).not.toMatch(/\{\{|\$\{/)
    expect(m.html + m.text + m.subject).not.toMatch(/[—–]/)
  })
})
