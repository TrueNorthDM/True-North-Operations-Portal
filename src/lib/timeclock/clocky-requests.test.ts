import { describe, expect, it } from 'vitest'
import { attentionOrder, goesToLabel, requestHistoryLines, teamLeadNames, waitingOrder } from './clocky-requests'

describe('who a correction goes to (3K-3)', () => {
  const led = new Map<string, Set<string>>([
    ['rock', new Set(['social', 'seo'])],
    ['wendy', new Set(['web'])],
    ['dave', new Set(['writers', 'social'])],
    ['gone', new Set(['social'])],
  ])
  const names: Record<string, string> = { rock: 'Rock Kai', wendy: 'Wendy Cacka', dave: 'Dave Sharpe', gone: 'Old Lead' }
  const leads = (id: string, teams: string[]) => teamLeadNames(id, teams, led, x => x !== 'gone', x => names[x])

  it("names the person's Team Leader", () => {
    expect(goesToLabel(leads('clarise', ['web']))).toBe('Wendy Cacka')
  })
  it('names every lead of their teams, by name, and never an inactive one', () => {
    expect(goesToLabel(leads('stephanie', ['social']))).toBe('Dave Sharpe and Rock Kai')
    expect(goesToLabel(['A', 'B', 'C'])).toBe('A, B and C')
  })
  it('never sends a lead their own request; with no lead it goes to the Admins and Super Admins', () => {
    expect(goesToLabel(leads('wendy', ['web']))).toBe('the Admins and Super Admins')
    expect(goesToLabel(leads('olivia', []))).toBe('the Admins and Super Admins')
  })
})

describe("a request's history (3G)", () => {
  const base = {
    owner: 'Clarise Nixon', requestedAt: '2026-10-15T12:40:00.000Z', seconds: 5400, job: '2 - i7 Marketing › Content',
    reason: 'I kept working on the i7 LinkedIn posts.', viewerZone: 'America/New_York',
  }
  it('says who asked, when and what happened', () => {
    expect(requestHistoryLines({ ...base, decided: null })).toEqual([{
      at: base.requestedAt, when: 'Oct 15, 2026, 8:40 AM', who: 'Clarise Nixon',
      text: 'Clarise Nixon requested a time correction: 1h 30m · 2 - i7 Marketing › Content',
      changes: [], reason: 'I kept working on the i7 LinkedIn posts.', dot: '#1E7D7F',
    }])
  })
  it('puts the decision on top, with the reason for a denial', () => {
    const lines = requestHistoryLines({ ...base, decided: { by: 'Rock Kai', at: '2026-10-15T14:02:00.000Z', state: 'denied', note: 'This hour is in your entries.' } })
    expect(lines.map(l => l.text)).toEqual(['Rock Kai denied the correction', 'Clarise Nixon requested a time correction: 1h 30m · 2 - i7 Marketing › Content'])
    expect(lines[0]).toMatchObject({ when: 'Oct 15, 2026, 10:02 AM', reason: 'This hour is in your entries.' })
  })
})

describe('the orders the prototype keeps', () => {
  const r = (rowType: string, date: string, personName = 'A', start: string | null = null) => ({ rowType, date, personName, start, k: `${rowType}${date}${personName}` })
  it('lists Needs attention oldest first, the entries before the requests', () => {
    const out = attentionOrder([
      r('correction', '2026-10-12'), r('entry', '2026-10-14'), r('time_off', '2026-10-16'), r('entry', '2026-10-13', 'B'), r('entry', '2026-10-13', 'A', '2026-10-13T13:00:00Z'),
    ])
    expect(out.map(x => x.k)).toEqual(['entry2026-10-13A', 'entry2026-10-13B', 'entry2026-10-14A', 'correction2026-10-12A', 'time_off2026-10-16A'])
  })
  it('lists Approvals "Waiting" by the request day, keeping the order of one day', () => {
    const rows = [{ date: '2026-10-16', k: 'off' }, { date: '2026-10-13', k: 'samuel' }, { date: '2026-10-12', k: 'stephanie' }, { date: '2026-10-13', k: 'other' }, { date: '2026-10-14', k: 'clarise' }]
    expect(waitingOrder(rows).map(x => x.k)).toEqual(['stephanie', 'samuel', 'other', 'clarise', 'off'])
  })
})
