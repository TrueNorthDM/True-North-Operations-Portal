// Screen 1.3: Workload, level 3 only.
//
// Three columns that answer different questions on purpose, and a fourth that
// says what the combination means. Reading them as one number is the mistake
// the layout is arranged to prevent, which is why the banner says it before
// the table starts.

import { chip } from '@/components/monday/tokens'
import {
  BACKLOG_WEEKS, LOAD_HORIZON_DAYS, LOAD_SCALE, LOAD_TICK_PCT, READING_CHIP, READING_LABEL,
  availableHours, formatNet, loadColour, loadPercent, netChip, netFlow, reading, sparkBar,
  utilisation, utilisationColour, type WorkloadRow,
} from '@/lib/report/workload'

const GRID = '1.5fr 1.15fr 1.15fr 1.35fr 1fr'
const HEAD_CELL =
  'px-4 py-[11px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'
const BIG_NUMBER = 'font-(family-name:--font-display) font-extrabold text-[16px]'
const TRACK = 'h-[7px] rounded-[4px] bg-subtle overflow-hidden mt-[7px]'

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function ReportWorkload({ people, children }: { people: WorkloadRow[]; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap border border-[var(--panel-border)] bg-subtle rounded-[12px] px-4 py-3 mb-4">
        <span className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.06em] uppercase bg-[rgba(1,35,88,.08)] text-tn-ink rounded-full px-2.5 py-1">
          <LockIcon />
          Level 3 only
        </span>
        <span className="text-[12.5px] text-foreground leading-[1.5]">
          Three separate readings, on three different clocks. None of them is a score, and only
          the first two use hours at all.
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

        {people.map((p, i) => (
          <Row key={p.id} p={p} first={i === 0} />
        ))}
      </section>
    </div>
  )
}

function Row({ p, first }: { p: WorkloadRow; first: boolean }) {
  const util = utilisation(p.hoursLogged, p.contracted)
  const avail = availableHours(p.observed)
  const load = loadPercent(p.estimatedAhead, avail)
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
            {p.contracted}h/week contracted · {p.observed}h typical
          </span>
        </span>
      </div>

      <div className="px-4 py-[13px]">
        {util === null ? (
          <NotOnTheClock />
        ) : (
          <>
            <div className="flex items-baseline gap-[7px]">
              <span className={BIG_NUMBER} style={{ color: utilisationColour(util) }}>{util}%</span>
              <span className="text-[11.5px] text-muted">
                {Math.round(p.hoursLogged / 13)}h of {p.contracted}h
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
          <NotOnTheClock />
        ) : (
          <>
            <div className="flex items-baseline gap-[7px]">
              <span className={BIG_NUMBER} style={{ color: loadColour(load) }}>{load}%</span>
              <span className="text-[11.5px] text-muted">{p.estimatedAhead}h of {avail}h</span>
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
 * Utilisation and Load both divide by hours. For somebody who never logs any,
 * both are unanswerable, and a 0% would read as a person doing nothing rather
 * than as a question the timeclock cannot answer. Backlog still works, which
 * is the reason that column uses no hours.
 */
function NotOnTheClock() {
  return <span className="text-[12.5px] text-[var(--faint)]">Not on the timeclock</span>
}
