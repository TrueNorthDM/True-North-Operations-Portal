/**
 * A person's time off in a year, drawn (owner, 17 November 2026): tiles and a
 * strip of the twelve months for the Approvals window and the person's page,
 * a small table for Home's drawer, and who else on the team is out. The
 * numbers are lib/timeclock/time-off-year.ts.
 */

import { pillClass } from '@/components/ui/Pill'
import { daysLabel, hoursLabel, offKind, PARTIAL_NOTE, type YearCount, type YearLine } from '@/lib/timeclock/time-off-year'
import type { RequestCard } from '@/lib/timeclock/request-cards'

const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const NOTE = 'Company holidays are not counted.'

const Dot = ({ color }: { color: string | null }) => (color ? <span className="inline-block w-2 h-2 rounded-full mr-[7px] align-[1px]" style={{ background: color }} /> : null)
const firstName = (who: string) => who.split(' ')[0]

function Tile({ l }: { l: YearLine }) {
  const plus = l.withSeconds - l.seconds
  return (
    <div className={`bg-subtle rounded-[11px] px-3 py-2.5 flex flex-col gap-0.5 min-w-0 ${l.adds ? 'outline outline-1 outline-tn-teal' : ''}`}>
      <span className="text-[12px] text-muted"><Dot color={l.color} />{l.label}</span>
      <span className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink tabular-nums lining-nums leading-[1.2]">
        {daysLabel(l.seconds)}{plus > 0 && <span className="text-[13px] text-tn-teal"> +{daysLabel(plus).replace(/ days?$/, '')}</span>}
      </span>
      <span className="text-[11.5px] text-muted tabular-nums lining-nums">{hoursLabel(l.seconds)}{plus > 0 ? `, ${hoursLabel(l.withSeconds)} with this request` : ''}</span>
    </div>
  )
}

/** The twelve months, each coloured by the type taken most in it; the request's month is outlined. */
function MonthStrip({ count }: { count: YearCount }) {
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`Months with time off in ${count.year}: ${count.months.map((m, i) => (m ? `${MONTH_NAMES[i]} ${offKind(m).label}` : null)).filter(Boolean).join(', ') || 'none'}`}>
      {count.months.map((m, i) => (
        <span key={i} className="flex-1 flex flex-col items-center gap-[3px]">
          <span className="w-full h-[20px] rounded-[5px] box-border" title={m ? `${MONTH_NAMES[i]}: ${offKind(m).label}` : MONTH_NAMES[i]}
            style={{ background: m ? offKind(m).color : 'var(--color-subtle)', border: count.month === i ? '2px solid #012358' : '0' }} />
          <span className="text-[10px] text-muted">{MONTHS[i]}</span>
        </span>
      ))}
    </div>
  )
}

/** The Approvals window and the person's page: a tile a type, the total, and the months. */
export function YearTiles({ count, who, heading = true }: { count: YearCount; who?: string; heading?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      {heading && (
        <div className="flex items-center gap-2">
          <span className={`${LABEL} flex-1`}>{who ? `${firstName(who)}'s time off in ${count.year}` : `Time off in ${count.year}`}, January to December</span>
          {count.partial && <span className={pillClass('amber')}>Partial</span>}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[...count.lines, count.total].map(l => <Tile key={l.key} l={l} />)}
      </div>
      <MonthStrip count={count} />
      <p className="m-0 text-[11.5px] text-muted leading-[1.5]">{NOTE}{count.partial ? ` ${PARTIAL_NOTE}` : ''}</p>
    </div>
  )
}

/** Home's drawer: the same count as a small table, taken and with this request. */
export function YearTable({ count, who }: { count: YearCount; who: string }) {
  const adding = count.total.adds
  const cell = 'py-[7px] border-t border-[#f1f3f6] text-[13px] tabular-nums lining-nums'
  return (
    <div className="border border-[var(--panel-border)] rounded-[14px] px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center gap-2 pb-1">
        <span className={`${LABEL} flex-1`}>{firstName(who)}&apos;s time off in {count.year}</span>
        {count.partial && <span className={pillClass('amber')}>Partial</span>}
      </div>
      <div className={`grid items-center ${adding ? 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]'}`}>
        <span className="text-[11.5px] text-muted pb-1">Type</span>
        <span className="text-[11.5px] text-muted pb-1 text-right">Taken</span>
        {adding && <span className="text-[11.5px] text-muted pb-1 text-right">With this one</span>}
        {[...count.lines, count.total].map(l => {
          const strong = l.key === 'all' || l.adds
          return (
            <div key={l.key} className="contents">
              <span className={`${cell} ${strong ? 'font-bold text-tn-ink' : 'text-foreground'}`}><Dot color={l.color} />{l.label}</span>
              <span className={`${cell} text-right ${l.key === 'all' ? 'font-bold text-tn-ink' : 'text-foreground'}`}>{daysLabel(l.seconds)}</span>
              {adding && <span className={`${cell} text-right ${l.adds && l.key !== 'all' ? 'font-bold text-tn-teal' : l.key === 'all' ? 'font-bold text-tn-ink' : 'text-foreground'}`}>{daysLabel(l.withSeconds)}</span>}
            </div>
          )
        })}
      </div>
      <p className="m-0 pt-1.5 text-[11.5px] text-muted leading-[1.5]">January to December. {NOTE}{count.partial ? ` ${PARTIAL_NOTE}` : ''}</p>
    </div>
  )
}

/** Home's drawer: who on the person's team is also out on the request's days, or that nobody is. */
export function AlsoOut({ also }: { also: NonNullable<RequestCard['also']> }) {
  return (
    <div className="border border-[var(--panel-border)] rounded-[14px] px-4 py-3 flex flex-col gap-2">
      <span className={LABEL}>Also out on {also.team}</span>
      {also.people.length === 0 ? (
        <span className="text-[13px] font-semibold text-[#0d7a4f]">Nobody else on the team is out on those days.</span>
      ) : also.people.map(p => (
        <div key={p.name} className="flex items-center gap-2.5 text-[13px]">
          <span className="flex-none w-[26px] h-[26px] rounded-full text-[#ffffff] text-[10px] font-bold flex items-center justify-center" style={{ background: p.color }}>{p.initials}</span>
          <span className="flex-1 min-w-0 font-bold text-tn-ink truncate">{p.name}</span>
          {p.asked && <span className={pillClass('amber')} title="Asked, not approved yet">Asked</span>}
          <span className="text-muted whitespace-nowrap">{p.when}</span>
        </div>
      ))}
      {also.warn && <span className="text-[12.5px] font-semibold text-[var(--bdg-orange-fg)]">{also.warn}</span>}
    </div>
  )
}
