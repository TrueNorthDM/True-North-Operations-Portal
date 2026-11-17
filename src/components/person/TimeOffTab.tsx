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

const HEAD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] leading-[normal] uppercase text-muted'
const ARROW = 'w-[32px] h-[32px] rounded-[10px] border border-[var(--panel-border)] bg-white text-tn-ink flex items-center justify-center hover:bg-subtle no-underline'
const GRID = 'minmax(130px,1.5fr) minmax(90px,.9fr) minmax(70px,.6fr) minmax(90px,.9fr) minmax(110px,1.1fr)'

export function TimeOffTab({ personId, record }: { personId: string; record: TimeOffRecord }) {
  const at = (year: number) => `${personHref(personId, 'timeoff')}&year=${year}`
  return (
    <div className="flex flex-col gap-4 leading-[normal]">
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
        <div className="min-w-[560px]">
          <div className="grid gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200" style={{ gridTemplateColumns: GRID }}>
            <span className={HEAD}>Dates</span><span className={HEAD}>Type</span><span className={`${HEAD} text-right`}>Days</span><span className={HEAD}>Recorded in</span><span className={HEAD}>Approved by</span>
          </div>
          {record.lines.map((l, i) => (
            <div key={l.key} className={`grid gap-3.5 items-center px-[22px] py-[12px] text-[13px] ${i ? 'border-t border-slate-200' : ''}`} style={{ gridTemplateColumns: GRID }}>
              <span className="font-(family-name:--font-display) font-bold text-sm text-tn-ink">{l.dates}</span>
              <span className="text-foreground"><span className="inline-block w-2 h-2 rounded-full mr-[7px] align-[1px]" style={{ background: l.color }} />{l.label}</span>
              <span className="text-right text-tn-ink font-semibold tabular-nums lining-nums">{l.days.replace(/ days?$/, '')}</span>
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
