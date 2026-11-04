/**
 * The System manual's Report pictures (owner, 4 November 2026: the guides show
 * the real screens with made-up data). Every person and number here is
 * invented. Seen by someone who may see everyone, over the last 90 days.
 */

import { AGE_BUCKETS, type Overview } from '@/lib/report/overview'
import type { PersonRow, StepWait, BoardWait, StuckItem, Source } from '@/lib/report/types'
import type { WorkloadRow } from '@/lib/report/workload'
import type { ReportState, Scope } from '@/lib/report/scope'
import type { TabRights } from '@/lib/report/tabs'

export const REPORT_STATE: ReportState = { tab: 'overview', scope: 'everyone', period: 90 }
export const REPORT_SCOPES: Scope[] = ['me', 'team', 'everyone']
export const REPORT_RIGHTS: TabRights = { overview: true, people: true, workload: true, waits: true, method: true }
export const REPORT_NOTE = 'change log since Sep 8, 2026'

const WEEKS: [string, number, number][] = [
  ['Aug 17', 31, 6], ['Aug 24', 28, 4], ['Aug 31', 22, 5], ['Sep 7', 34, 7],
  ['Sep 14', 30, 3], ['Sep 21', 36, 5], ['Sep 28', 29, 4], ['Oct 5', 33, 6],
  ['Oct 12', 27, 2], ['Oct 19', 38, 5], ['Oct 26', 32, 4], ['Nov 2', 35, 3],
]
const AGES = [14, 11, 6, 2]

export const overviewSample: Overview = {
  kpis: [
    { label: 'Delivered', value: '375', unit: 'steps', note: 'Marked done in the period' },
    { label: 'On time', value: '86%', unit: '', note: '323 of 375 met their due date' },
    { label: 'Median held', value: '3.1d', unit: '', note: 'From hand-off to done' },
    { label: 'Open now', value: '33', unit: 'steps', note: 'Current snapshot, not the period' },
    { label: 'Late now', value: '7', unit: 'steps', note: 'Open with the due date behind them' },
  ],
  weeks: WEEKS.map(([label, total, late]) => ({ label, total, late })),
  aging: AGE_BUCKETS.map((b, i) => ({ label: b.label, color: b.color, count: AGES[i] })),
  held: [
    { name: 'Alex Rivera', median: 2.4, p90: 7 },
    { name: 'Ben Carter', median: 3.8, p90: 11 },
    { name: 'Jordan Lee', median: 5.2, p90: 16 },
    { name: 'Maria Gomez', median: 1.9, p90: 5 },
    { name: 'Sam Patel', median: 4.1, p90: 13 },
  ],
}

export const peopleSample: PersonRow[] = [
  { id: 'alex', name: 'Alex Rivera', team: 'Writers', color: '#86C06A', initials: 'AR', delivered: 64, onTimePct: 91, medianHeld: 2.4, open: 6, late: 2, hours: 468 },
  { id: 'ben', name: 'Ben Carter', team: 'Graphics', color: '#C026D3', initials: 'BC', delivered: 52, onTimePct: 83, medianHeld: 3.8, open: 5, late: 1, hours: 451 },
  { id: 'jordan', name: 'Jordan Lee', team: 'Web', color: '#A99BD4', initials: 'JL', delivered: 31, onTimePct: 68, medianHeld: 5.2, open: 9, late: 3, hours: 482 },
  { id: 'maria', name: 'Maria Gomez', team: 'Writers', color: '#86C06A', initials: 'MG', delivered: 77, onTimePct: 94, medianHeld: 1.9, open: 4, late: 0, hours: 236 },
  { id: 'sam', name: 'Sam Patel', team: 'SEO', color: '#F4C24A', initials: 'SP', delivered: 45, onTimePct: 57, medianHeld: 4.1, open: 7, late: 1, hours: null },
]

// Arriving minus finishing, week by week, from a few invented weights.
const ARR = [1.05, .92, 1.1, .97, 1.08, .9, 1.02, .96]
const FIN = [.94, 1.06, .9, 1.1, .96, 1.04, .98, 1.02]
const weekly = (a: number, f: number) => ARR.map((w, i) => a * w - f * FIN[i])

export const workloadSample: WorkloadRow[] = [
  { id: 'alex', name: 'Alex Rivera', initials: 'AR', color: '#86C06A', contracted: 40, observed: 37, hoursLogged: 468, estimatedAhead: 118, arriving: 4.8, finishing: 4.9, weekly: weekly(4.8, 4.9) },
  { id: 'ben', name: 'Ben Carter', initials: 'BC', color: '#C026D3', contracted: 40, observed: 36, hoursLogged: 451, estimatedAhead: 172, arriving: 4.1, finishing: 3.6, weekly: weekly(4.1, 3.6) },
  { id: 'jordan', name: 'Jordan Lee', initials: 'JL', color: '#A99BD4', contracted: 40, observed: 38, hoursLogged: 482, estimatedAhead: 196, arriving: 3.2, finishing: 2.4, weekly: weekly(3.2, 2.4) },
  { id: 'maria', name: 'Maria Gomez', initials: 'MG', color: '#86C06A', contracted: 20, observed: 19, hoursLogged: 236, estimatedAhead: 38, arriving: 5.6, finishing: 5.8, weekly: weekly(5.6, 5.8) },
  // Outside the timeclock: Load still reads, from the group's average week, marked est.
  { id: 'sam', name: 'Sam Patel', initials: 'SP', color: '#F4C24A', contracted: 20, observed: null, hoursLogged: null, estimatedAhead: 64, arriving: 3.4, finishing: 3.1, weekly: weekly(3.4, 3.1) },
]

export const workloadTeams = [
  { id: 'graphics', name: 'Graphics' }, { id: 'seo', name: 'SEO' }, { id: 'web', name: 'Web' }, { id: 'writers', name: 'Writers' },
]
export const workloadPeople = [
  { id: 'alex', name: 'Alex Rivera', teamIds: ['writers'] },
  { id: 'ben', name: 'Ben Carter', teamIds: ['graphics'] },
  { id: 'jordan', name: 'Jordan Lee', teamIds: ['web'] },
  { id: 'maria', name: 'Maria Gomez', teamIds: ['writers'] },
  { id: 'sam', name: 'Sam Patel', teamIds: ['seo'] },
]

export const stepWaitsSample: StepWait[] = [
  { name: 'Approve', median: 5.6, delivered: 41 },
  { name: 'Review', median: 3.9, delivered: 88 },
  { name: 'Write', median: 3.1, delivered: 117 },
  { name: 'Translate', median: 2.2, delivered: 76 },
  { name: 'Publish', median: 0.8, delivered: 53 },
]

export const boardWaitsSample: BoardWait[] = [
  { board: 'Sample Client Blog', delivered: 96, medianHeld: 3.4, latePct: 14 },
  { board: 'Sample Client Marketing', delivered: 58, medianHeld: 4.6, latePct: 21 },
  { board: 'Sample Project Publishing', delivered: 164, medianHeld: 2.1, latePct: 8 },
  { board: 'Team Reports', delivered: 57, medianHeld: 1.7, latePct: null },
]

export const stuckSample: StuckItem[] = [
  { id: '1', item: 'Blog post: planning a spring garden', who: 'Alex Rivera', step: 'Write', heldDays: 23 },
  { id: '2', item: 'Sample Client site map', who: 'Jordan Lee', step: 'Approve', heldDays: 17 },
  { id: '3', item: 'Holiday campaign banners', who: 'Ben Carter', step: 'Review', heldDays: 12 },
]

export const sourcesSample: Source[] = [
  { name: 'Monday assignments', state: 'live', cadence: 'every 4 hours · 42 boards', what: 'Who is on which step, its status, due date, board and workspace. The same read as My Work, so the two pages cannot disagree.' },
  { name: 'Assignment change log', state: 'live', cadence: 'written by the same sync · about 18,400 changes recorded', what: 'One row per change: step, person, status, due date, moment. Held time and on-time delivery come only from here.' },
  { name: 'Timeclock entries', state: 'live', cadence: 'approved and locked hours only', what: 'Hours per person per day, by timeclock code. Answers how much time went in, which the boards never record.' },
]
