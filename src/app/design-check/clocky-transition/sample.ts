// Sample data for the TSheets transition design check: a switch date of
// Mon, Nov 2, 2026, a slice of the 2026 structure, two old TSheets jobs, and
// one entry for each problem. Read through the real transition-check.ts, so
// the frame shows what the page would. Development only.

import { buildTransition, periodOf, type CheckEntry, type CheckJob } from '@/lib/timeclock/transition-check'
import type { TransitionData, TransitionQuery } from '@/lib/timeclock/transition-data'

export const SWITCH = '2026-11-02'

const j = (id: number, name: string, parentId: number | null, level: CheckJob['level'], path: string, extra: Partial<CheckJob> = {}): CheckJob => ({
  id, name, parentId, level, path, kind: 'regular', billable: true, isFolder: level !== 'project', structure: 2, ...extra,
})
const JOBS: CheckJob[] = [
  j(1, 'COE Group', null, 'client', 'COE Group'),
  j(2, 'Africa', 1, 'division', 'COE Group › Africa'),
  j(3, 'HopeFor.Africa', 2, 'project', 'COE Group › Africa › HopeFor.Africa'),
  j(4, 'Fundraising', 1, 'division', 'COE Group › Fundraising'),
  j(5, 'Newsletter', 4, 'project', 'COE Group › Fundraising › Newsletter'),
  j(6, 'i7 Marketing', null, 'client', 'i7 Marketing'),
  j(7, 'Wagner Meters', 6, 'division', 'i7 Marketing › Wagner Meters'),
  j(8, 'WM-MKTG', 7, 'project', 'i7 Marketing › Wagner Meters › WM-MKTG'),
  j(9, 'True North Internal', null, 'client', 'True North Internal', { billable: false }),
  j(10, 'TN Operations', 9, 'project', 'True North Internal › TN Operations', { billable: false }),
  j(20, '2 - i7 Marketing', null, null, '2 - i7 Marketing', { structure: 1, isFolder: true, client2026: 'i7 Marketing', topName: '2 - i7 Marketing' }),
  j(21, 'Content', 20, null, '2 - i7 Marketing › Content', { structure: 1, client2026: 'i7 Marketing', topName: '2 - i7 Marketing' }),
  j(23, '1 - True North', null, null, '1 - True North', { structure: 1, isFolder: true, client2026: 'True North Internal', topName: '1 - True North' }),
  j(24, 'SEO', 23, null, '1 - True North › SEO', { structure: 1, client2026: 'True North Internal', topName: '1 - True North' }),
  j(22, 'Vacation', null, null, 'Vacation', { structure: 1, kind: 'pto', isFolder: false }),
]
const LABELS = new Map([['11', '1 Company'], ['12', '2 Project'], ['13', '3 Activity'], ['14', '4 Billable'], ['15', '1 - i7 Code'], ['16', 'Tasks'], ['40', 'Activity']])
const NAMES: Record<string, string> = { p1: 'Wendy Cacka', p2: 'Justus Tsofa', p3: 'Clarise Nixon', p4: 'Cheyenne Wilson', p5: 'Samuel Manzi' }

let id = 0
const e = (personId: string, date: string, hours: number, jobcodeId: number | null, fields: Record<string, string>, notes: string | null = null): CheckEntry =>
  ({ id: ++id, externalId: 812_300_000 + id, personId, date, seconds: Math.round(hours * 3600), jobcodeId, fields, notes })

const ENTRIES: CheckEntry[] = [
  e('p1', '2026-11-02', 3.5, 8, { '40': 'Web Dev & Systems' }, 'Product page fixes'),
  e('p2', '2026-11-02', 4, 3, { '40': 'Content: Writing' }, 'HFA article'),
  e('p3', '2026-11-03', 1.25, 21, { '11': 'i7', '13': 'Social Media', '15': 'WM-MKTG' }, 'Posts for Wagner'),
  e('p4', '2026-11-03', 2, null, { '11': 'COE', '12': 'Africa' }, 'Draft for Rwanda'),
  e('p2', '2026-11-04', 1, 2, { '40': 'Meeting: Project' }),
  e('p5', '2026-11-04', 2.75, 5, {}, 'Newsletter layout'),
  e('p3', '2026-11-05', 0.5, 10, { '40': 'Other' }),
  e('p1', '2026-11-05', 1, 10, { '40': 'Meeting: Other' }, 'All-hands planning'),
  e('p4', '2026-11-06', 8, 22, {}),
  e('p5', '2026-11-06', 5, 5, { '40': 'Marketing: Email' }, 'Donor email'),
  e('p4', '2026-11-04', 3, 24, { '11': 'COE', '12': 'AAAF', '13': 'SEO Research', '14': 'yes' }, 'Keyword map'),
  e('p3', '2026-11-05', 1.5, 24, { '11': 'True North', '12': 'In-House', '14': 'no' }),
  // Before the switch: never listed.
  e('p1', '2026-10-30', 6, 21, { '11': 'i7', '13': 'Web Dev' }),
]

export function sampleTransition(q: TransitionQuery, frame: 'data' | 'empty' | 'none'): TransitionData {
  if (frame === 'none') return { switchDate: null }
  const { from, to } = periodOf(SWITCH, q.from, q.to)
  const entries = frame === 'empty' ? [] : ENTRIES
  const personId = q.person && entries.some(x => x.personId === q.person) ? q.person : null
  const view = buildTransition(entries, {
    jobs: new Map(JOBS.map(x => [x.id, x])),
    fieldLabels: LABELS,
    activityFieldId: '40',
    oldKeys: { company: '11', project: '12', activity: '13', billable: '14', code: '15', tasks: '16' },
    nameOf: p => NAMES[p] ?? 'Someone',
  }, { from, to, personId, onlyProblems: !!q.problems })
  return { switchDate: SWITCH, from, to, personId, onlyProblems: !!q.problems, activityField: 'Activity', ...view }
}
