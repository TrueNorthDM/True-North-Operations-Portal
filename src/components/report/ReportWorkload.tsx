// Screen 1.3: Workload. Who sees it is the Workload tab's row on Admin,
// Access levels.
//
// Three columns that answer different questions on purpose, and a fourth that
// says what the combination means. Reading them as one number is the mistake
// the layout is arranged to prevent, which is why the banner says it before
// the table starts.

import { chip } from '@/components/monday/tokens'
import {
  BACKLOG_WEEKS, LOAD_HORIZON_DAYS, LOAD_SCALE, LOAD_TICK_PCT, READING_CHIP, READING_LABEL,
  UTILISATION_WEEKS, availableHours, formatNet, groupAverageWeek, loadColour, loadPercent, netChip,
  netFlow, reading, sparkBar, utilisation, utilisationColour, type WorkloadRow,
} from '@/lib/report/workload'

const GRID = '1.5fr 1.15fr 1.15fr 1.35fr 1fr'
const HEAD_CELL =
  'px-4 py-[11px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'
const BIG_NUMBER = 'font-(family-name:--font-display) font-extrabold text-[16px]'
const TRACK = 'h-[7px] rounded-[4px] bg-subtle overflow-hidden mt-[7px]'

export function ReportWorkload({ people, children }: { people: WorkloadRow[]; children?: React.ReactNode }) {
  const average = groupAverageWeek(people)
  return (
    <div>
      <div className="border border-[var(--panel-border)] bg-subtle rounded-[12px] px-4 py-3 mb-4">
        <span className="text-[12.5px] text-foreground leading-[1.5]">
          {`Three separate readings, on three different clocks: hours over the last ${UTILISATION_WEEKS} weeks, `
            + `work due in the next ${LOAD_HORIZON_DAYS} days, and the last ${BACKLOG_WEEKS} weeks of flow. `
            + 'None of them is a score, only the first two use hours, and the period switch does not move them.'}
        </span>
      </div>

      {children}

      <section className="border border-[var(--panel-border)] bg-white rounded-[14px] overflow-hidden">
        <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: GRID }}>
          <div className={HEAD_CELL}>Person</div>
          <div className={HEAD_CELL}>Utilisation</div>
          <div className={HEAD_CELL}>Load, next {LOAD_HORIZON_DAYS} days</div>
          <div className={HEAD_CELL}>Backlog, {BACKLOG_WEEKS} weeks</div>
          <div className={HEAD_CELL}>Reading</div>
        </div>

        {/* One average for the whole selection, so two contractors on the
            same screen are measured against the same week. */}
        {people.map((p, i) => (
          <Row key={p.id} p={p} first={i === 0} average={average} />
        ))}
      </section>
    </div>
  )
}

function Row({ p, first, average }: { p: WorkloadRow; first: boolean; average: number }) {
  const util = utilisation(p.hoursLogged, p.contracted)
  const avail = availableHours(p.observed, average)
  const load = loadPercent(p.estimatedAhead, avail.hours)
  const net = netFlow(p.arriving, p.finishing)
  const verdict = reading(load, net, util)

  return (
    <div
      className={`grid ${first ? '' : 'border-t border-[var(--row-rule)]'}`}
      style={{ gridTemplateColumns: GRID }}
    >
      <div className="px-4 py-[13px] flex items-center gap-[11px] min-w-0">
        <span
          className="inline-flex w-8 h-8 flex-none rounded-full items-center justify-center font-(family-name:--font-display) font-extrabold text-[11.5px] text-white"
          style={{ background: p.color }}
        >
          {p.initials}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-tn-ink truncate">{p.name}</span>
          <span className="block text-[11.5px] text-muted truncate">
            {p.contracted}h/week contracted · {p.observed === null
              ? 'not on the timeclock'
              : `${p.observed}h typical`}
          </span>
        </span>
      </div>

      <div className="px-4 py-[13px]">
        {util === null ? (
          <NoHours />
        ) : (
          <>
            <div className="flex items-baseline gap-[7px]">
              <span className={BIG_NUMBER} style={{ color: utilisationColour(util) }}>{util}%</span>
              <span className="text-[11.5px] text-muted">
                {`${Math.round((p.hoursLogged ?? 0) / UTILISATION_WEEKS)}h of ${p.contracted}h`}
              </span>
            </div>
            <div className={TRACK}>
              <span
                className="block h-full rounded-[4px]"
                style={{ background: utilisationColour(util), width: `${Math.min(100, util)}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-[13px]">
        {load === null ? (
          p.estimatedAhead === null ? <NoEstimate /> : <NoHours />
        ) : (
          <>
            <div className="flex items-baseline gap-[7px]">
              <span className={BIG_NUMBER} style={{ color: loadColour(load) }}>{load}%</span>
              <span className="text-[11.5px] text-muted">
                {p.estimatedAhead}h of {avail.hours}h
                {/* Marked, so nobody reads a borrowed week as a measured one. */}
                {avail.estimated ? <span className={`${chip} ${netChip(0)} ml-1.5`}>est</span> : null}
              </span>
            </div>
            <div className={`${TRACK} relative`}>
              <span
                className="block h-full rounded-[4px]"
                style={{ background: loadColour(load), width: `${Math.min(100, Math.round(load / (LOAD_SCALE / 100)))}%` }}
              />
              {/* The 100% mark, short of the end because the track runs to 120. */}
              <span
                className="absolute -top-0.5 -bottom-0.5 w-px bg-[var(--faint)]"
                style={{ left: `${LOAD_TICK_PCT}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="px-4 py-[13px]">
        <div className="flex items-center gap-2">
          <span className={`${chip} ${netChip(net)}`}>{formatNet(net)}</span>
          <span className="text-[12px] text-foreground">
            {p.arriving.toFixed(1)} in, {p.finishing.toFixed(1)} out
          </span>
        </div>
        <div className="flex items-end gap-[3px] h-[22px] mt-[7px]">
          {p.weekly.map((n, k) => {
            const bar = sparkBar(n)
            return (
              <span
                key={k}
                className="flex-1 block rounded-sm"
                style={{
                  height: bar.px,
                  background: bar.piling ? 'rgba(194,65,12,.55)' : 'rgba(30,125,127,.5)',
                }}
              />
            )
          })}
        </div>
      </div>

      <div className="px-4 py-[13px] flex items-start">
        <span className={`${chip} ${READING_CHIP[verdict]}`}>{READING_LABEL[verdict]}</span>
      </div>
    </div>
  )
}

/**
 * Utilisation for somebody the timeclock does not know.
 *
 * A dash, not 0%, which would read as a person doing nothing rather than as a
 * question the timeclock cannot answer. Load does not use this: it falls back
 * to the group's average week and marks itself, because losing the only
 * reading that speaks to capacity would be the bigger loss.
 */
function NoHours() {
  return (
    <span
      className="text-[12.5px] text-[var(--faint)]"
      title="No approved hours in this window"
    >
      -
    </span>
  )
}

/** Load for somebody with a step nobody can estimate yet: unknown, not 0% and Spare. */
function NoEstimate() {
  return (
    <span className="text-[12.5px] text-[var(--faint)]" title="A step due soon has no hours-per-step estimate yet">
      -
    </span>
  )
}
