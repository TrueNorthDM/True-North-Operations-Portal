// Screen 1.4: Where it waits.
//
// Diagnosis rather than scoreboard. The same spans as the People tab, grouped
// by step name instead of by person, so a slow month can be traced to a stage
// rather than to somebody's name. That is the whole reason this tab is not
// just a sort order on the one before it.

const STUCK_GRID = '2fr 1fr .9fr .9fr'

const PANEL = 'border border-[var(--panel-border)] bg-white rounded-[14px] px-[18px] pt-4 pb-[18px]'
const PANEL_TITLE = 'font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink m-0'
const STUCK_HEAD =
  'px-3 py-2 font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-muted'

export type StepWait = {
  name: string
  /** Days from hand-off to done, the middle one. */
  median: number
  delivered: number
}

export type StuckItem = {
  id: string
  item: string
  who: string
  step: string
  /** Days it has been sitting, right now. */
  heldDays: number
}

/** Over five days red, over three amber, else teal. */
function stepColour(median: number): string {
  if (median > 5) return '#c2410c'
  if (median > 3) return '#E09422'
  return '#1E7D7F'
}

export function ReportWaits({ steps, stuck }: { steps: StepWait[]; stuck: StuckItem[] }) {
  // Slowest first, sorted here rather than by the caller: the order is part of
  // what the panel means, and a caller that forgets it produces a chart that
  // still looks right.
  const ordered = [...steps].sort((a, b) => b.median - a.median)
  const slowest = ordered[0]?.median ?? 0

  return (
    <div className="flex flex-col gap-3.5">
      <section className={PANEL}>
        <h3 className={`${PANEL_TITLE} mb-3.5`}>By step</h3>
        <div className="flex flex-col gap-3">
          {ordered.map(s => (
            <div key={s.name}>
              <div className="flex items-baseline justify-between gap-2.5 mb-1.5">
                <span className="text-[13.5px] font-semibold text-tn-ink">{s.name}</span>
                <span className="text-[12.5px] text-muted">
                  {`${s.median < 10 ? s.median.toFixed(1) : Math.round(s.median)}d median`}
                  {` · ${s.delivered} delivered`}
                </span>
              </div>
              <div className="h-2.5 rounded-[5px] bg-subtle overflow-hidden">
                <div
                  className="h-full rounded-[5px]"
                  style={{ background: stepColour(s.median), width: `${slowest ? (s.median / slowest) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The live snapshot, not the period: this is the list a lead acts on
          today, and mixing it with a 90-day window would put finished work
          in a queue of things to chase. */}
      <section className={PANEL}>
        <h3 className={`${PANEL_TITLE} mb-1.5`}>Sitting longest right now</h3>
        <div className="grid bg-subtle rounded-lg mt-2.5" style={{ gridTemplateColumns: STUCK_GRID }}>
          <div className={STUCK_HEAD}>Item</div>
          <div className={STUCK_HEAD}>With</div>
          <div className={STUCK_HEAD}>Step</div>
          <div className={`${STUCK_HEAD} text-right`}>Held</div>
        </div>
        {stuck.map(s => (
          <div
            key={s.id}
            className="grid border-b border-[var(--row-rule)]"
            style={{ gridTemplateColumns: STUCK_GRID }}
          >
            <div className="px-3 py-2.5 text-[12.5px] font-semibold text-tn-ink leading-[1.4]">{s.item}</div>
            <div className="px-3 py-2.5 text-[12.5px] text-foreground">{s.who}</div>
            <div className="px-3 py-2.5 text-[12.5px] text-muted">{s.step}</div>
            <div className="px-3 py-2.5 text-right text-[12.5px] font-bold text-[#c2410c]">{s.heldDays}d</div>
          </div>
        ))}
      </section>
    </div>
  )
}
