/**
 * A person's page, Time off (owner, 17 November 2026): the year's time off by
 * type, the months it fell in, and each time off as a line. It names sick
 * leave, so who opens it is decided by the page (lib/directory/page-rights.ts,
 * directory/[id]/page.tsx): the person, HR and their approver.
 */

import Link from 'next/link'
import { YearTiles } from '@/components/clocky/approvals/TimeOffYear'
import { pillClass } from '@/components/ui/Pill'
import { CARD } from '@/lib/ui/type'
import { personHref } from '@/lib/directory/page-rights'
import type { TimeOffRecord } from '@/lib/timeclock/time-off-year-data'
import { balanceNote, hoursText, type PaidKind } from '@/lib/timeclock/time-off-rules'
import { dayLabel } from '@/lib/timeclock/format'

const HEAD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] leading-[normal] uppercase text-muted'
const ARROW = 'w-[32px] h-[32px] rounded-[10px] border border-[var(--panel-border)] bg-white text-tn-ink flex items-center justify-center hover:bg-subtle no-underline'
const GRID = 'minmax(140px,1.5fr) minmax(90px,.9fr) minmax(80px,.7fr) minmax(60px,.5fr) minmax(90px,.9fr) minmax(110px,1.1fr)'

export function TimeOffTab({ personId, record }: { personId: string; record: TimeOffRecord }) {
  const at = (year: number) => `${personHref(personId, 'timeoff')}&year=${year}`
  // What is left (owner, 23 November 2026): Rippling's report, less the time off approved since.
  const st = record.standing
  const left = ([['vacation', 'Vacation', st.vacationFrom], ['sick', 'Sick leave', st.sickFrom]] as [PaidKind, string, string | null][]).map(([kind, label, opens]) => ({
    kind, label, bal: st.balances[kind], opens: opens && opens > record.today ? opens : null,
  }))
  const sickYear = st.sickUsed[String(record.today.slice(0, 4))] ?? 0
  return (
    <div className="flex flex-col gap-4 leading-[normal]">
      {st.employee && (
        <section className={`${CARD} px-[22px] py-5 flex flex-col gap-3.5`} aria-label="Time off left">
          <span className={HEAD}>Time off left</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {left.map(l => (
              <div key={l.kind} className="bg-subtle rounded-[12px] px-4 py-3.5 flex flex-col gap-1">
                <span className={HEAD}>{l.label}</span>
                <span className={`font-(family-name:--font-display) font-black text-[24px] leading-none tabular-nums lining-nums ${l.bal && l.bal.left < 0 ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{l.bal ? hoursText(l.bal.left) : '-'}</span>
                <span className="text-[12px] text-muted leading-[1.45]">{l.bal ? balanceNote(l.bal) : 'No balance loaded yet'}</span>
                {l.bal && l.bal.waiting > 0 && <span className="text-[12px] text-muted leading-[1.45]">{hoursText(l.bal.waiting)} waiting for approval</span>}
                {l.opens && <span className="text-[12px] font-semibold text-[var(--bdg-orange-fg)] leading-[1.45]">Can be used from {dayLabel(l.opens)}, {l.opens.slice(0, 4)}</span>}
                {l.kind === 'sick' && <span className="text-[12px] text-muted leading-[1.45]">{hoursText(sickYear)} taken or asked in {record.today.slice(0, 4)}</span>}
              </div>
            ))}
          </div>
          <p className="m-0 text-[12.5px] text-muted">Finance loads the balances from Rippling. What is earned after the report shows with the next one.</p>
        </section>
      )}
      <section className={`${CARD} px-[22px] py-5 flex flex-col gap-3.5`} aria-label={`Time off in ${record.year}`}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`${HEAD} flex-1`}>Time off taken, January to December</span>
          {record.prev != null ? <Link href={at(record.prev)} scroll={false} aria-label={`${record.prev}`} className={ARROW}>&lsaquo;</Link> : <span className={`${ARROW} opacity-30`} aria-hidden="true">&lsaquo;</span>}
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink tabular-nums lining-nums">{record.year}</span>
          {record.next != null ? <Link href={at(record.next)} scroll={false} aria-label={`${record.next}`} className={ARROW}>&rsaquo;</Link> : <span className={`${ARROW} opacity-30`} aria-hidden="true">&rsaquo;</span>}
          {record.count.partial && <span className={pillClass('amber')}>Partial</span>}
        </div>
        <YearTiles count={record.count} heading={false} />
      </section>

      <section className={`${CARD} overflow-x-auto`} aria-label="Each time off">
        <div className="min-w-[640px]">
          <div className="grid gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200" style={{ gridTemplateColumns: GRID }}>
            <span className={HEAD}>Dates</span><span className={HEAD}>Type</span><span className={`${HEAD} text-right`}>Hours</span><span className={`${HEAD} text-right`}>Days</span><span className={HEAD}>Recorded in</span><span className={HEAD}>Approved by</span>
          </div>
          {record.lines.map((l, i) => (
            <div key={l.key} className={`grid gap-3.5 items-center px-[22px] py-[12px] text-[13px] ${i ? 'border-t border-slate-200' : ''}`} style={{ gridTemplateColumns: GRID }}>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="font-(family-name:--font-display) font-bold text-sm text-tn-ink">{l.dates}</span>
                {l.perDay && <span className="text-[11.5px] text-muted tabular-nums lining-nums">{l.perDay}</span>}
              </span>
              <span className="text-foreground"><span className="inline-block w-2 h-2 rounded-full mr-[7px] align-[1px]" style={{ background: l.color }} />{l.label}</span>
              <span className="text-right text-tn-ink font-bold tabular-nums lining-nums">{l.hours}</span>
              <span className="text-right text-muted tabular-nums lining-nums">{l.days.replace(/ days?$/, '')}</span>
              <span className={l.source === 'TSheets' ? 'text-muted' : 'text-foreground'}>{l.source}</span>
              {l.waiting ? <span><span className={pillClass('amber')}>Waiting</span></span> : <span className={l.by ? 'text-foreground' : 'text-muted'}>{l.by ?? '-'}</span>}
            </div>
          ))}
          {record.lines.length === 0 && <div className="px-[22px] py-[44px] text-center"><p className="m-0 text-sm text-muted">No time off recorded in {record.year}.</p></div>}
        </div>
      </section>
      <p className="m-0 mx-0.5 text-[12.5px] text-muted">Requests still waiting are listed but not added to the totals. Time off that came from TSheets has no approver on record.</p>
    </div>
  )
}
