// Screen 1.4: Where it waits.
//
// Diagnosis rather than scoreboard. The same spans as the People tab, grouped
// by step name instead of by person, so a slow month can be traced to a stage
// rather than to somebody's name. That is the whole reason this tab is not
// just a sort order on the one before it.

import { chip } from '@/components/monday/tokens'
import { formatDays } from '@/lib/report/overview'
import type { StepWait, BoardWait, StuckItem } from '@/lib/report/types'
export type { StepWait, BoardWait, StuckItem }

const STUCK_GRID = '2fr 1fr .9fr .9fr'

const PANEL = 'border border-[var(--panel-border)] bg-white rounded-[14px] px-[18px] pt-4 pb-[18px]'
const PANEL_TITLE = 'font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink m-0'
const LABEL =
  'font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-muted'
const STUCK_HEAD =
  'px-3 py-2 font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-muted'

/**
 * The same spans, grouped by board.
 *
 * Column labels sit BELOW the rows rather than above, which the handoff asks
 * for and which is right here: the board names are the thing being read, and
 * a header row above them would be the first thing the eye lands on in a
 * panel whose whole point is the list of names.
 */
function ByBoard({ boards }: { boards: BoardWait[] }) {
  return (
    <section className={PANEL}>
      <h3 className={`${PANEL_TITLE} mb-3.5`}>By board</h3>
      <div className="flex flex-col gap-2.5">
        {[...boards].sort((a, b) => b.medianHeld - a.medianHeld).map(b => (
          <div key={b.board} className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-3">
            <span className="text-[13px] font-semibold text-tn-ink truncate">{b.board}</span>
            <span className="w-10 text-right text-[12.5px] text-foreground">{b.delivered}</span>
            <span className="w-12 text-right text-[12.5px] text-foreground">{formatDays(b.medianHeld)}</span>
            {/* A quarter of the work late is the line where a board stops
                being a scheduling wobble and starts being a problem. */}
            <span
              className={`${chip} w-14 justify-center ${b.latePct === null
                ? 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]'
                : b.latePct >= 25
                  ? 'bg-[rgba(194,65,12,.12)] text-[#c2410c]'
                  : 'bg-[rgba(30,125,127,.12)] text-tn-teal'}`}
            >
              {b.latePct === null ? '-' : `${b.latePct}%`}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 mt-2.5 pt-2.5 border-t border-[var(--row-rule)]">
        <span className={LABEL}>Board</span>
        <span className={`${LABEL} w-10 text-right`}>Done</span>
        <span className={`${LABEL} w-12 text-right`}>Median</span>
        <span className={`${LABEL} w-14 text-center`}>Late</span>
      </div>
    </section>
  )
}

/** Over five days red, over three amber, else teal. */
function stepColour(median: number): string {
  if (median > 5) return '#c2410c'
  if (median > 3) return '#E09422'
  return '#1E7D7F'
}

export function ReportWaits(
  { steps, boards, stuck }: { steps: StepWait[]; boards?: BoardWait[]; stuck: StuckItem[] },
) {
  // Slowest first, sorted here rather than by the caller: the order is part of
  // what the panel means, and a caller that forgets it produces a chart that
  // still looks right.
  const ordered = [...steps].sort((a, b) => b.median - a.median)
  const slowest = ordered[0]?.median ?? 0

  return (
    <div className="flex flex-col gap-3.5">
      <div className={boards?.length ? 'grid grid-cols-2 gap-3.5 items-start' : ''}>
      <section className={PANEL}>
        <h3 className={`${PANEL_TITLE} mb-1`}>By step</h3>
        <p className="text-[12px] text-muted m-0 mb-3.5">
          Median working days from hand-off to done, for steps with at least three deliveries.
        </p>
        {ordered.length === 0 ? (
          <p className="text-[13px] text-muted m-0">Not enough deliveries in this period to compare steps.</p>
        ) : null}
        <div className="flex flex-col gap-3">
          {ordered.map(s => (
            <div key={s.name}>
              <div className="flex items-baseline justify-between gap-2.5 mb-1.5">
                <span className="text-[13.5px] font-semibold text-tn-ink">{s.name}</span>
                <span className="text-[12.5px] text-muted">
                  {`${formatDays(s.median)} median · ${s.delivered} delivered`}
                </span>
              </div>
              <div className="h-2.5 rounded-[5px] bg-subtle overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-[5px]"
                  style={{ background: stepColour(s.median), width: `${slowest ? (s.median / slowest) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {boards?.length ? <ByBoard boards={boards} /> : null}
      </div>

      {/* The live snapshot, not the period: this is the list a lead acts on
          today, and mixing it with a 90-day window would put finished work
          in a queue of things to chase. */}
      <section className={PANEL}>
        <h3 className={`${PANEL_TITLE} mb-1`}>Sitting longest right now</h3>
        <p className="text-[12px] text-muted m-0">
          Open steps, by working days since they landed. Steps the change log has not seen land are
          left out.
        </p>
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
            <div className="px-3 py-2.5 text-[12.5px] text-foreground">
              {s.who}
              {s.inactive ? (
                <span className={`${chip} ml-1.5 bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>Inactive</span>
              ) : null}
            </div>
            <div className="px-3 py-2.5 text-[12.5px] text-muted">{s.step}</div>
            <div className="px-3 py-2.5 text-right text-[12.5px] font-bold text-[#c2410c]">{formatDays(s.heldDays)}</div>
          </div>
        ))}
        {stuck.length === 0 ? (
          <p className="text-[13px] text-muted m-0 pt-3">Nothing open with a known hand-off date.</p>
        ) : null}
      </section>
    </div>
  )
}
