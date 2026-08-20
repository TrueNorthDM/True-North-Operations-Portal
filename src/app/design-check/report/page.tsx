// Screen 1.1 with the handoff's own numbers, to look at without signing in.
//
// Development only. The figures here are the design file's sample set, not
// this account's: the real Overview cannot be honest about delivery or held
// time until the change log has been recording for a while, and a preview
// that showed four true zeros would say nothing about the layout.

import { notFound } from 'next/navigation'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportPeople, type PersonRow } from '@/components/report/ReportPeople'
import { ReportWorkload } from '@/components/report/ReportWorkload'
import { ReportWaits, type StepWait, type StuckItem } from '@/components/report/ReportWaits'
import { ReportMethod, type Source } from '@/components/report/ReportMethod'
import { ReportControls } from '@/components/report/ReportControls'
import {
  EstimateAudit, NobodyInSelection, WorkloadHoldings, WorkloadSummary,
  type EffortBasis, type SummaryCard,
} from '@/components/report/WorkloadHoldings'
import type { PersonHoldings } from '@/lib/report/holdings'
import { resolvePeriod, resolveScope } from '@/lib/report/scope'
import type { WorkloadRow } from '@/lib/report/workload'
import { ReportTabs } from '@/components/report/ReportTabs'
import { WorkViewSwitch } from '@/components/monday/WorkViewSwitch'
import { AGE_BUCKETS, type Overview } from '@/lib/report/overview'

export const dynamic = 'force-dynamic'

const WEEKS = [
  ['Jun 1', 12, 3], ['Jun 8', 14, 3], ['Jun 15', 11, 4], ['Jun 22', 15, 3],
  ['Jun 29', 12, 3], ['Jul 6', 14, 2], ['Jul 13', 10, 3], ['Jul 20', 15, 2],
  ['Jul 27', 13, 3], ['Aug 3', 12, 2], ['Aug 10', 14, 3], ['Aug 17', 12, 2],
] as const

const AGE_COUNTS = [10, 8, 4, 2]

const SAMPLE: Overview = {
  kpis: [
    { label: 'Delivered', value: '153', unit: 'steps', note: 'Marked done in the period' },
    { label: 'On time', value: '78%', unit: '', note: '120 of 153 met their due date' },
    { label: 'Median held', value: '4.2d', unit: '', note: 'From hand-off to done' },
    { label: 'Open now', value: '24', unit: 'steps', note: 'Current snapshot, not the period' },
    { label: 'Late now', value: '8', unit: 'steps', note: 'Open with the due date behind them' },
  ],
  weeks: WEEKS.map(([label, total, late]) => ({ label, total, late })),
  aging: AGE_BUCKETS.map((b, i) => ({ label: b.label, color: b.color, count: AGE_COUNTS[i] })),
  held: [
    { name: 'Amy Marsh', median: 4.2, p90: 12 },
    { name: 'Kevin Brown', median: 6.8, p90: 21 },
    { name: 'Lana Prado', median: 2.1, p90: 6 },
    { name: 'Wendy Clark', median: 8.5, p90: 26 },
  ],
}

// The handoff's four people, with the team colours it draws them in.
const PEOPLE: PersonRow[] = [
  { id: '1', name: 'Amy Marsh', team: 'SEO', color: '#1E7D7F', initials: 'AM', delivered: 42, onTimePct: 79, medianHeld: 4.2, open: 9, late: 3, hours: 494 },
  { id: '2', name: 'Kevin Brown', team: 'SEO', color: '#1E7D7F', initials: 'KB', delivered: 27, onTimePct: 56, medianHeld: 6.8, open: 6, late: 2, hours: 286 },
  { id: '3', name: 'Lana Prado', team: 'Writing', color: '#579BFC', initials: 'LP', delivered: 66, onTimePct: 91, medianHeld: 2.1, open: 5, late: 1, hours: 247 },
  { id: '4', name: 'Wendy Clark', team: 'Web', color: '#94C4C5', initials: 'WC', delivered: 18, onTimePct: 67, medianHeld: 8.5, open: 4, late: 0, hours: null },
]

// The handoff's own arrival and finishing weights, so the sparklines carry
// its shapes rather than shapes I invented.
const ARR_W = [.92, 1.08, .95, 1.18, .88, 1.12, .96, 1.06]
const FIN_W = [1.06, .94, 1.12, .82, 1.1, .9, 1.04, .96]

const weekly = (arr: number, fin: number) => ARR_W.map((w, k) => arr * w - fin * FIN_W[k])

const LOAD: WorkloadRow[] = [
  { id: '1', name: 'Amy Marsh', initials: 'AM', color: '#1E7D7F', contracted: 40, observed: 38, hoursLogged: 494, estimatedAhead: 214, arriving: 4.6, finishing: 3.5, weekly: weekly(4.6, 3.5) },
  { id: '2', name: 'Kevin Brown', initials: 'KB', color: '#1E7D7F', contracted: 40, observed: 22, hoursLogged: 286, estimatedAhead: 96, arriving: 2.9, finishing: 2.1, weekly: weekly(2.9, 2.1) },
  { id: '3', name: 'Lana Prado', initials: 'LP', color: '#579BFC', contracted: 20, observed: 19, hoursLogged: 247, estimatedAhead: 58, arriving: 5.2, finishing: 5.4, weekly: weekly(5.2, 5.4) },
  { id: '4', name: 'Wendy Clark', initials: 'WC', color: '#94C4C5', contracted: 20, observed: 12, hoursLogged: 156, estimatedAhead: 74, arriving: 2.2, finishing: 1.4, weekly: weekly(2.2, 1.4) },
]

/**
 * Dev-only: swap directory level, to see 2.5 without three accounts.
 *
 * The point of the screen is that permission is a shorter control rather than
 * a disabled one, and that is only visible by switching between them.
 */
function LevelPicker({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted mb-4">
      <span>Preview as directory level:</span>
      {[1, 2, 3].map(l => (
        <a
          key={l}
          href={`/design-check/report?level=${l}`}
          className={`px-2 py-0.5 rounded border ${
            l === level ? 'border-tn-teal text-tn-teal font-bold' : 'border-[var(--panel-border)]'
          }`}
        >
          {l}
        </a>
      ))}
    </div>
  )
}

const WRITING: PersonHoldings[] = [
  {
    id: '3', name: 'Lana Prado', role: 'Writing · 19h typical week', availableHours: 82,
    holdings: [
      { board: 'AAAF Publishing', steps: 4, hours: 44 },
      { board: 'HFA Publishing', steps: 1, hours: 14 },
    ],
  },
  {
    id: '5', name: 'Jeannette Alves', role: 'Writing · 24h typical week', availableHours: 103,
    holdings: [
      { board: 'AAAF Publishing', steps: 2, hours: 28 },
      { board: 'HFA Publishing', steps: 1, hours: 18 },
    ],
  },
]

const TEAM_SUMMARY: SummaryCard[] = [
  { label: 'Team', value: 'Writing' },
  { label: 'Open, next 30 days', value: '8', unit: 'steps' },
  { label: 'Estimated hours', value: '104', unit: 'h' },
  { label: 'Available hours', value: '185', unit: 'h' },
  { label: 'Load', value: '56%', teal: true },
]

const EFFORT: EffortBasis[] = [
  { board: 'i7 Marketing', basis: '1,046h over 118 steps', perStep: '8.9h', measured: true },
  { board: 'Team Reports Scheduled', basis: '452h over 74 steps', perStep: '6.1h', measured: true },
  { board: '38 other boards', basis: 'hours booked to a shared code', perStep: '4.6h', measured: false },
]

const STEPS: StepWait[] = [
  { name: 'Approve', median: 7.5, delivered: 38 },
  { name: 'Review', median: 4.8, delivered: 74 },
  { name: 'Write', median: 3.6, delivered: 96 },
  { name: 'Translate', median: 2.2, delivered: 132 },
  { name: 'Publish', median: 1.1, delivered: 88 },
]

const STUCK: StuckItem[] = [
  { id: '1', item: 'SEO Bi-Weekly Company Report, Nov 25 2025', who: 'Amy Marsh', step: 'Write', heldDays: 104 },
  { id: '2', item: 'i7 Monthly Report, MME billing', who: 'Kevin Brown', step: 'Approve', heldDays: 61 },
  { id: '3', item: 'Hope For Africa launch page', who: 'Wendy Clark', step: 'Approve', heldDays: 44 },
]

const SOURCES: Source[] = [
  {
    name: 'Monday assignments', state: 'live', cadence: 'every 4 hours',
    what: 'Who is on which step, its status, due date, board and workspace. The same read as My Work, so the two pages cannot disagree.',
  },
  {
    name: 'Assignment change log', state: 'to-build', cadence: 'written by the same sync',
    what: 'One row per change: step, person, status, due date, moment. Held time and on-time delivery come only from here.',
  },
  {
    name: 'Timeclock entries', state: 'live', cadence: 'every 4 hours',
    what: 'Approved hours per person per day with the i7 code. Answers how much time went in, which the boards never record.',
  },
]

const TODO = [
  { text: 'Write the change log from the existing ingest, diffing before the rows are replaced.' },
  { text: 'Backfill what Monday still remembers for open items, one item at a time.' },
  { text: 'Decide what a reopened step means for "delivered".' },
  { text: 'Decide whether weekends and time off count as held time.' },
]

export default async function ReportPreview(
  { searchParams }: {
    searchParams: Promise<{ tab?: string; scope?: string; period?: string; level?: string }>
  },
) {
  if (process.env.NODE_ENV === 'production') notFound()

  const sp = await searchParams
  const level = Number(sp.level) === 1 || Number(sp.level) === 2 ? Number(sp.level) : 3
  const scope = resolveScope(sp.scope, level)
  const period = resolvePeriod(sp.period)
  const asked = sp.tab
  const KNOWN = ['people', 'workload', 'waits', 'method'] as const
  const tab = (KNOWN as readonly string[]).includes(asked ?? '')
    ? (asked as (typeof KNOWN)[number])
    : 'overview'
  const state = { tab, scope, period }

  return (
    <div className="p-8 bg-app min-h-screen">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-muted">Dashboard</span>
          <span className="text-[var(--faint)]">/</span>
          <span className="font-semibold text-tn-ink">My Work / Report / My Team</span>
        </div>

        <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[var(--panel-border)]">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">
              Report
            </h2>
            <p className="text-[14.5px] text-muted mt-1.5 m-0">
              What got delivered, how long it sat with each person, and what came in late.
            </p>
          </div>
          <WorkViewSwitch active="report" />
        </div>

        <ReportTabs active={tab} level={level} state={state} base="/design-check/report" />
        <ReportControls
          state={state}
          level={level}
          canExport
          base="/design-check/report"
          note="7 people · change log since Feb 12, 2026"
        />
        <LevelPicker level={level} />
        {tab === 'people' ? <ReportPeople people={PEOPLE} />
          : tab === 'workload' ? (
            <div className="space-y-4">
              <ReportWorkload people={LOAD} />
              <WorkloadSummary cards={TEAM_SUMMARY} />
              <WorkloadHoldings title="What each person on Writing is holding" people={WRITING} />
              <div className="grid grid-cols-2 gap-4 items-start">
                <NobodyInSelection />
                <EstimateAudit rows={EFFORT} />
              </div>
            </div>
          )
          : tab === 'waits' ? <ReportWaits steps={STEPS} stuck={STUCK} />
          : tab === 'method' ? <ReportMethod sources={SOURCES} todo={TODO} />
          : <ReportOverview data={SAMPLE} />}
      </div>
    </div>
  )
}
