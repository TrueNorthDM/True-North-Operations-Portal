// Screen 1.1 with the handoff's own numbers, to look at without signing in.
//
// Development only. The figures here are the design file's sample set, not
// this account's: the real Overview cannot be honest about delivery or held
// time until the change log has been recording for a while, and a preview
// that showed four true zeros would say nothing about the layout.

import { notFound } from 'next/navigation'
import { ReportOverview } from '@/components/report/ReportOverview'
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

export default function ReportPreview() {
  if (process.env.NODE_ENV === 'production') notFound()

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

        <ReportTabs active="overview" level={3} />
        <ReportOverview data={SAMPLE} />
      </div>
    </div>
  )
}
