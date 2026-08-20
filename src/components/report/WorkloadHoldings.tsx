// Screens 3.1 to 3.4: what a team or a person is holding, and where the
// Load column's hours come from.
//
// Picking a team narrows the three-reading table and adds two things: a
// five-card summary of the selection, and the holdings card that answers
// "how much does each writer have on their hands" directly.

import { chip } from '@/components/monday/tokens'
import {
  barWidth, boardColour, holdingReadout, labelOn, totalHours,
  type PersonHoldings,
} from '@/lib/report/holdings'

const CARD = 'border border-[var(--panel-border)] bg-white rounded-[12px] px-4 py-[13px]'
const CARD_LABEL =
  'font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-muted'
const CARD_VALUE = 'font-(family-name:--font-display) font-extrabold text-[21px] leading-none'

export type SummaryCard = { label: string; value: string; unit?: string; teal?: boolean }

/**
 * Screen 3.1's summary strip, and 3.2's variant.
 *
 * The first card carries the selection itself, labelled Team or Person, so
 * one person selected reads as a measurement of them rather than as a team
 * of one.
 */
export function WorkloadSummary({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-5 gap-[14px] mb-4">
      {cards.map(c => (
        <div key={c.label} className={CARD}>
          <div className={CARD_LABEL}>{c.label}</div>
          <div className="flex items-baseline gap-[5px] mt-1.5">
            <span className={`${CARD_VALUE} ${c.teal ? 'text-tn-teal' : 'text-tn-ink'}`}>{c.value}</span>
            {c.unit ? <span className="text-[12px] text-muted">{c.unit}</span> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function WorkloadHoldings(
  { title, people }: { title: string; people: PersonHoldings[] },
) {
  const busiest = Math.max(0, ...people.map(totalHours))

  // One legend, from the boards actually on screen: a fixed list would name
  // boards nobody in this selection touches.
  const boards = [...new Set(people.flatMap(p => p.holdings.map(h => h.board)))]

  return (
    <section className="border border-[var(--panel-border)] bg-white rounded-[14px] px-5 pt-[18px] pb-[22px]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[18px]">
        <div>
          <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">{title}</h3>
          <p className="text-[12.5px] text-muted mt-1 m-0">
            Open steps due in the next 30 days, by board. Bar length is the estimated hours, so the
            rows are comparable to each other.
          </p>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap text-[11.5px] text-muted">
          {boards.map(b => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="w-[9px] h-[9px] rounded-[2px]" style={{ background: boardColour(b) }} />
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {people.map(p => (
          <div key={p.id} className="flex items-center gap-3.5">
            <span className="w-[150px] flex-none min-w-0">
              <span className="block text-[13px] font-semibold text-tn-ink truncate">{p.name}</span>
              <span className="block text-[11.5px] text-muted mt-px truncate">{p.role}</span>
            </span>

            <span className="flex-1 h-[22px] rounded-md bg-subtle overflow-hidden flex">
              <span
                className="flex h-full rounded-md overflow-hidden"
                style={{ width: `${barWidth(p, busiest)}%` }}
              >
                {p.holdings.map(h => {
                  const bg = boardColour(h.board)
                  return (
                    <span
                      key={h.board}
                      className="flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10px]"
                      style={{ flex: h.hours, background: bg, color: labelOn(bg) }}
                      title={`${h.board}: ${h.steps} steps, ${h.hours}h`}
                    >
                      {/* A count of one is the bar itself saying it twice. */}
                      {h.steps > 1 ? h.steps : ''}
                    </span>
                  )
                })}
              </span>
            </span>

            <span className="w-[132px] flex-none text-right text-[12.5px] text-foreground whitespace-nowrap">
              {holdingReadout(p)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Screen 3.3: the selection matched nobody. */
export function NobodyInSelection() {
  return (
    <section className="border border-[var(--panel-border)] bg-white rounded-[14px] overflow-hidden">
      {/* The header row stays so the table does not collapse into a sentence
          floating on the page with no sign of what it was going to list. */}
      <div className="bg-subtle border-b border-[var(--panel-border)] px-4 py-[11px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">
        Person · Utilisation · Load · Backlog
      </div>
      <div className="px-5 py-[34px] text-center text-[13.5px] text-muted">Nobody in this selection.</div>
    </section>
  )
}

export type EffortBasis = {
  board: string
  /** How the number was arrived at, in the units it was arrived at in. */
  basis: string
  perStep: string
  measured: boolean
}

/**
 * Screen 3.4, always visible on the Workload tab.
 *
 * The Load column is an estimate, so it has to be checkable. A board with its
 * own project code is measured from real hours; a board booked to a shared
 * code falls back to the global average and says so, because an estimate that
 * does not admit which it is cannot be argued with.
 */
export function EstimateAudit({ rows }: { rows: EffortBasis[] }) {
  return (
    <section className="border border-[var(--panel-border)] bg-white rounded-[14px] px-[18px] py-4">
      {rows.map((e, i) => (
        <div
          key={e.board}
          className={`flex items-center gap-3 py-[11px] ${i ? 'border-t border-[var(--row-rule)]' : ''}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-tn-ink truncate">{e.board}</span>
            <span className="block text-[11.5px] text-muted mt-0.5 truncate">{e.basis}</span>
          </span>
          <span className="flex-none font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">
            {e.perStep}
          </span>
          <span className="flex-none w-[74px] text-right">
            <span className={`${chip} ${e.measured
              ? 'bg-[rgba(30,125,127,.12)] text-tn-teal'
              : 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]'}`}
            >
              {e.measured ? 'measured' : 'fallback'}
            </span>
          </span>
        </div>
      ))}
    </section>
  )
}
