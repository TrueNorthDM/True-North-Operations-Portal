// The sample data of Clock Safety.dc.html (frames 4A and 4B), worked out the
// way the prototype's renderVals does, in the shape getClockSafety returns.
// "Today" is Thu, Oct 15, 2026, New York. Development only.

import type { ClockSafetyData } from '@/lib/timeclock/clocky-types'
import { dayLabel } from '@/lib/timeclock/format'

type Period = 'month' | '3m' | 'all'

const TEAMS: Record<string, string> = { Africa: '#F0A35E', Web: '#A99BD4', 'Social Media': '#DC2626', Writers: '#86C06A' }
const TEAM: Record<string, string> = { 'Justus Tsofa': 'Africa', 'Hosea Moturi': 'Africa', 'Wendy Cacka': 'Web', 'Samuel Manzi': 'Web', 'Clarise Nixon': 'Social Media', 'Cheyenne Wilson': 'Writers' }
// [day, who, job, clock started, stopped by Clocky, confirmed or null, kept going earlier]
const OCC: [string, string, string, string, string, string | null, boolean][] = [
  ['2026-10-15', 'Wendy Cacka', '2 - i7 Marketing › Web Dev', '8:00 AM', '1:00 PM', '12:40 PM', false],
  ['2026-10-14', 'Clarise Nixon', '2 - i7 Marketing › Content', '10:00 AM', '3:00 PM', null, false],
  ['2026-10-13', 'Justus Tsofa', '2 - i7 Marketing › Content', '2:00 AM', '7:00 AM', '6:10 AM', true],
  ['2026-10-09', 'Justus Tsofa', '2 - i7 Marketing › Content', '2:15 AM', '7:15 AM', '7:15 AM', false],
  ['2026-10-07', 'Samuel Manzi', '1 - True North › Web Dev', '6:30 AM', '11:30 AM', '11:30 AM', true],
  ['2026-10-06', 'Wendy Cacka', '2 - i7 Marketing › Web Dev', '12:30 PM', '5:30 PM', '4:50 PM', false],
  ['2026-10-02', 'Clarise Nixon', '1 - True North › Management', '12:00 PM', '5:00 PM', null, false],
  ['2026-09-24', 'Justus Tsofa', '2 - i7 Marketing › Content', '1:45 AM', '6:45 AM', '5:30 AM', false],
  ['2026-09-18', 'Wendy Cacka', '1 - True North › Web Dev', '1:00 PM', '6:00 PM', '5:15 PM', false],
  ['2026-09-11', 'Cheyenne Wilson', '2 - i7 Marketing › Content', '7:00 AM', '12:00 PM', '11:20 AM', true],
  ['2026-09-03', 'Justus Tsofa', '2 - i7 Marketing › Content', '2:00 AM', '7:00 AM', '6:40 AM', false],
  ['2026-08-27', 'Samuel Manzi', '1 - True North › Web Dev', '6:30 AM', '11:30 AM', '10:45 AM', false],
  ['2026-08-20', 'Justus Tsofa', '2 - i7 Marketing › Content', '2:10 AM', '7:10 AM', '6:00 AM', true],
  ['2026-08-14', 'Clarise Nixon', '2 - i7 Marketing › Content', '7:00 AM', '12:00 PM', '11:30 AM', false],
  ['2026-07-30', 'Wendy Cacka', '2 - i7 Marketing › Web Dev', '8:00 AM', '1:00 PM', '12:15 PM', false],
]
// "Keep going" per person, July to October.
const KEEP: Record<string, number[]> = { 'Justus Tsofa': [2, 5, 4, 6], 'Samuel Manzi': [1, 3, 4, 5], 'Cheyenne Wilson': [0, 2, 3, 4], 'Wendy Cacka': [1, 1, 2, 2], 'Clarise Nixon': [0, 1, 1, 1], 'Hosea Moturi': [0, 0, 1, 1] }

const minutes = (t: string) => {
  const m = /(\d+):(\d+) (AM|PM)/.exec(t)!
  return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2])
}

export function sampleSafety(o: { period: Period; q: string; empty: boolean; access: 'full' | 'read' }): ClockSafetyData {
  const q = o.q.trim().toLowerCase()
  const from = o.period === 'month' ? '2026-10-01' : o.period === '3m' ? '2026-08-01' : '0000'
  const months = o.period === 'month' ? [3] : o.period === '3m' ? [1, 2, 3] : [0, 1, 2, 3]
  let occ = o.empty ? [] : OCC.filter(x => x[0] >= from)
  if (q) occ = occ.filter(x => x[1].toLowerCase().includes(q))
  const keepFor = (n: string) => months.reduce((a, i) => a + KEEP[n][i], 0)
  const keepPeople = Object.keys(KEEP).filter(n => !q || n.toLowerCase().includes(q))
  const names = [...new Set([...occ.map(x => x[1]), ...(o.empty ? [] : keepPeople)])]
  const byPerson = names.map(n => {
    const mine = occ.filter(x => x[1] === n)
    const all = OCC.filter(x => x[1] === n)
    return {
      personId: n,
      name: n,
      team: { name: TEAM[n], color: TEAMS[TEAM[n]] },
      autoStops: mine.length,
      keptGoing: keepFor(n),
      last: all.length ? `${dayLabel(all[0][0])}, 2026` : null,
      byMonth: ['07', '08', '09', '10'].map(m => ({ month: `2026-${m}`, count: all.filter(x => x[0].slice(5, 7) === m).length })),
    }
  }).sort((a, b) => b.autoStops - a.autoStops || b.keptGoing - a.keptGoing)
  return {
    access: o.access,
    zone: 'America/New_York',
    cards: {
      autoStops: occ.length,
      people: new Set(occ.map(x => x[1])).size,
      confirmed: occ.filter(x => x[5]).length,
      keptGoing: o.empty ? 0 : keepPeople.reduce((a, n) => a + keepFor(n), 0),
    },
    byPerson,
    occurrences: occ.map((x, i) => ({
      eventId: i + 1,
      date: x[0],
      personId: x[1],
      name: x[1],
      job: x[2],
      clockStarted: x[3],
      stoppedAt: x[4],
      confirmedEnd: x[5],
      diffMinutes: x[5] ? minutes(x[5]) - minutes(x[4]) : null,
      flagged: false,
      keptGoingEarlier: x[6],
      entryId: 1000 + i,
    })),
  }
}
