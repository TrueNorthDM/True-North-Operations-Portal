// Screen 1.1: the Overview tab.
//
// Answers "how did the last 30 or 90 days go" without naming anybody, until
// the last panel, which is the one place the Overview does name people.
//
// Two of the five headline numbers are deliberately not about the period.
// Open now and Late now are the current Monday snapshot, and their card copy
// says so: put them beside three period numbers with no wording and everyone
// reads all five as the same window.

import {
  AGE_BUCKETS, HELD_SCALE_DAYS, formatDays, heldWidths, weekBars,
  type Overview,
} from '@/lib/report/overview'

const CARD = 'border border-[var(--panel-border)] bg-white rounded-[14px]'
const PANEL_TITLE = 'font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0'
const PANEL_SUB = 'text-[12.5px] text-muted m-0'

export function ReportOverview({ data }: { data: Overview }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-[14px]">
        {data.kpis.map(k => (
          <div key={k.label} className={`${CARD} px-[18px] py-4`}>
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">
              {k.label}
            </div>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="font-(family-name:--font-display) font-extrabold text-[30px] leading-none text-tn-ink">
                {k.value}
              </span>
              {k.unit ? <span className="text-[13px] text-muted">{k.unit}</span> : null}
            </div>
            <div className="text-[12px] text-muted mt-2 leading-[1.45]">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.45fr_1fr] gap-4">
        <DeliveredPerWeek weeks={data.weeks} />
        <OpenByAge aging={data.aging} />
      </div>

      <HeldPerPerson held={data.held} />
    </div>
  )
}

/**
 * Steps marked done, week by week, split by whether the due date had passed.
 *
 * Twelve columns on the 90-day period, five on the 30-day one, which is what
 * the period switch decides; this draws however many it is handed.
 */
function DeliveredPerWeek({ weeks }: { weeks: Overview['weeks'] }) {
  const busiest = Math.max(0, ...weeks.map(w => w.total))

  return (
    <section className={`${CARD} px-5 pt-[18px] pb-5`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className={PANEL_TITLE}>Delivered per week</h3>
          <p className={`${PANEL_SUB} mt-1`}>Steps marked done, split by whether the due date had passed.</p>
        </div>
        <div className="flex items-center gap-3.5 text-[11.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[9px] h-[9px] rounded-[2px] bg-tn-teal" />On time
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-[9px] h-[9px] rounded-[2px] bg-[#c2410c]" />Late
          </span>
        </div>
      </div>

      <div className="flex items-end gap-2.5 h-[150px] border-b border-[var(--panel-border)]">
        {weeks.map(w => {
          const px = weekBars(w, busiest)
          return (
            <div key={w.label} className="flex-1 flex flex-col justify-end items-center gap-[3px] h-full">
              <span className="text-[11px] font-bold text-foreground">{w.total}</span>
              <span className="block w-full rounded-t-[4px] bg-[#c2410c]" style={{ height: px.late }} />
              <span className="block w-full rounded-b-[3px] bg-tn-teal" style={{ height: px.onTime }} />
            </div>
          )
        })}
      </div>
      <div className="flex gap-2.5 mt-2">
        {weeks.map(w => (
          <div key={w.label} className="flex-1 text-center text-[10.5px] text-muted">{w.label}</div>
        ))}
      </div>
    </section>
  )
}

/**
 * How long each open step has been sitting with its assignee.
 *
 * Measured from the hand-off, not from the due date, so a step can be young
 * and already late. Those are two different problems and this panel is only
 * about the first one.
 */
function OpenByAge({ aging }: { aging: Overview['aging'] }) {
  const total = aging.reduce((s, a) => s + a.count, 0)

  return (
    <section className={`${CARD} px-5 pt-[18px] pb-5`}>
      <h3 className={PANEL_TITLE}>Open work, by age</h3>
      <p className={`${PANEL_SUB} mt-1 mb-4`}>How long each open step has been sitting with its assignee.</p>
      <div className="flex flex-col gap-3.5">
        {aging.map(a => (
          <div key={a.label}>
            <div className="flex items-baseline justify-between gap-2.5 mb-1.5">
              <span className="text-[13px] text-foreground">{a.label}</span>
              <span className="text-[13px] font-bold text-tn-ink">{a.count}</span>
            </div>
            <div className="h-[9px] rounded-[5px] bg-subtle overflow-hidden">
              <div
                className="h-full rounded-[5px]"
                style={{ background: a.color, width: `${total ? (a.count / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** The one panel on this tab that names people: median held, with a p90 whisker. */
function HeldPerPerson({ held }: { held: Overview['held'] }) {
  return (
    <section className={`${CARD} px-5 pt-[18px] pb-[22px]`}>
      <div className="flex items-start justify-between gap-3 mb-[18px]">
        <div>
          <h3 className={PANEL_TITLE}>How long work stays with each person</h3>
          <p className={`${PANEL_SUB} mt-1`}>Bar is the median, the line runs to the slowest one in ten.</p>
        </div>
        <span className="text-[11.5px] text-muted whitespace-nowrap">0 to {HELD_SCALE_DAYS} days</span>
      </div>

      <div className="flex flex-col gap-[11px]">
        {held.map(p => {
          const w = heldWidths(p)
          return (
            <div key={p.name} className="flex items-center gap-3.5">
              <span className="w-[150px] flex-none text-[13px] font-semibold text-tn-ink">{p.name}</span>
              <span className="flex-1 relative h-5 bg-subtle rounded-md">
                <span
                  className="absolute top-2 h-1 rounded-sm bg-[rgba(194,65,12,.45)]"
                  style={{ left: `${w.whiskerLeft}%`, width: `${w.whiskerWidth}%` }}
                />
                <span
                  className="absolute left-0 top-0 bottom-0 rounded-md bg-tn-teal"
                  style={{ width: `${w.bar}%` }}
                />
              </span>
              {/* nowrap, not just a width: at 104px the handoff's own readout
                  wraps onto a second line and pushes the row out of line. */}
              <span className="min-w-[104px] flex-none text-right text-[12.5px] text-foreground whitespace-nowrap">
                med {formatDays(p.median)} · p90 {p.p90}d
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export { AGE_BUCKETS }
