// Design check: option 4 (marks and bands), with bands that collapse and a map
// of the list at the top of the table. Asked for on 18 September 2026 after
// option 4 was chosen. Jeannette's and Arnaldo's real lists. Development only.

import { notFound } from 'next/navigation'
import { FitWidth } from '../order-clarity/FitWidth'
import { Mark } from '../order-clarity/OrderClarity'
import { BandedList } from './BandedList'
import { ARNALDO_ALL, JEANNETTE_ALL } from './lists'
import { TEAM_RUNS } from './team-runs'

export const dynamic = 'force-dynamic'

/** Each stretch with its first and last place, worked out once. */
const RUNS = TEAM_RUNS.map(([placed, n], i) => {
  const from = 1 + TEAM_RUNS.slice(0, i).reduce((t, [, m]) => t + m, 0)
  return { placed, n, from, to: from + n - 1 }
})

function EditorMap() {
  const runs = RUNS
  return (
    <div className="rounded-[14px] border border-[var(--panel-border)] bg-white px-4 pt-3 pb-3.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{`The team's order, in ${runs.length} stretches`}</span>
        <span className="inline-flex items-center gap-3 text-[12.5px] text-tn-ink">
          <span className="inline-flex items-center gap-1.5"><Mark placed size={18} />190 placed by hand</span>
          <span className="inline-flex items-center gap-1.5"><Mark placed={false} size={18} />587 follow True North</span>
        </span>
        <span className="ml-auto inline-flex items-center gap-3 text-[12.5px] font-semibold text-tn-teal"><span>Collapse all</span><span>Expand all</span></span>
      </div>
      <div className="flex h-2.5 gap-[3px] mt-2.5">
        {runs.map((r, i) => <span key={i} className={`rounded-full min-w-[6px] ${r.placed ? 'bg-tn-primary' : 'bg-tn-teal'}`} style={{ flexGrow: r.n }} />)}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {runs.map((r, i) => (
          <span key={i} className={`inline-flex items-center gap-2 rounded-full border pl-1 pr-3 py-1 text-[12px] ${r.placed ? 'border-[rgba(1,35,88,.25)]' : 'border-[rgba(30,125,127,.35)]'}`}>
            <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted w-4 text-center">{i + 1}</span>
            <Mark placed={r.placed} size={18} />
            <span className="font-semibold text-tn-ink">{`${r.n} ${r.n === 1 ? 'step' : 'steps'}`}</span>
            <span className="text-muted">{r.n === 1 ? `#${r.from}` : `#${r.from} to #${r.to}`}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default async function OrderBandsDesignCheck(
  { searchParams }: { searchParams: Promise<{ collapsed?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  // ?collapsed=1 opens every band closed: the whole page in one screen.
  const startCollapsed = (await searchParams).collapsed === '1'
  return (
    <div className="min-h-screen bg-background p-8 space-y-6">
      <div>
        <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] tracking-tight text-tn-ink m-0">Marks and bands, with a map of the list</h1>
        <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed m-0 max-w-[1000px]">
          Real lists from production. Jeannette&apos;s 236 steps come in 5 stretches (126 placed by hand, 69 following True North, 4, 32, 5): the map at the top of the table shows all five before any scrolling, a chip or a piece of the bar jumps to its band, every band header collapses it, and while a long band fills the screen the next one is announced at the bottom. Arnaldo&apos;s 33 are a single stretch.
        </p>
      </div>
      <FitWidth width={1240}>
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">My Work · Jeannette Owens&apos;s own list <span className="font-normal text-[12px] text-muted">236 steps, 5 stretches</span></div>
            <BandedList rows={JEANNETTE_ALL} who="Jeannette Owens" leader="Jeannette Owens" startCollapsed={startCollapsed} />
          </section>
          <section className="space-y-3">
            <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">My Work · Arnaldo Oliveira&apos;s own list <span className="font-normal text-[12px] text-muted">33 steps, 1 stretch</span></div>
            <BandedList rows={ARNALDO_ALL} who="Arnaldo Oliveira" leader="Jeannette Owens" startCollapsed={startCollapsed} />
          </section>
          <section className="space-y-3">
            <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Edit priority · the same map over the whole team <span className="font-normal text-[12px] text-muted">777 steps, 12 stretches; the table under it collapses the same way</span></div>
            <EditorMap />
          </section>
        </div>
      </FitWidth>
    </div>
  )
}
