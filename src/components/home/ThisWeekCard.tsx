// This week (Clocky part 2, Agenda.dc.html 8F): who is out, birthdays and
// anniversaries, and the next event, a small card on Home for everyone. The
// figures are the Agenda's (lib/agenda), so the two always agree.

import Link from 'next/link'
import { Icon } from '@/components/clocky/entries/ui'
import type { ThisWeek } from '@/lib/agenda/model'

const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted leading-[normal]'

export function ThisWeekCard({ week, linked = true }: { week: ThisWeek; linked?: boolean }) {
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[16px] px-5 py-[18px] flex flex-col gap-4 leading-[normal]">
      <div className="flex items-center justify-between">
        <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">This week</span>
        <span className="text-[12px] text-muted">{week.range}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className={LABEL}>Who is out</span>
        {week.out.map(o => (
          <div key={o.id} className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full text-tn-ink text-[10.5px] font-extrabold flex items-center justify-center flex-none" style={{ background: o.color }}>{o.ini}</span>
            <span className="flex-1 text-[13px] text-tn-ink font-semibold">{o.name}</span>
            <span className="text-[12px] text-muted whitespace-nowrap">{o.when}</span>
          </div>
        ))}
        {!week.out.length && <span className="text-[13px] text-muted">Everyone is in this week.</span>}
      </div>
      {week.celebrations.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Birthdays and anniversaries</span>
          {week.celebrations.map(o => (
            <div key={o.id} className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-none" style={{ background: o.bg, color: o.fg }}><Icon d={o.d} size={14} width={2} /></span>
              <span className="flex-1 text-[13px] text-tn-ink font-semibold">{o.name}</span>
              <span className={`text-[12px] whitespace-nowrap ${o.today ? 'text-[#c8323d] font-extrabold' : 'text-muted font-normal'}`}>{o.when}</span>
            </div>
          ))}
        </div>
      )}
      {week.next && (
        <div className="flex flex-col gap-2">
          <span className={LABEL}>Next event</span>
          <div className="flex gap-3 items-center bg-subtle rounded-[12px] px-[13px] py-[11px]">
            <span className="w-11 flex-none flex flex-col items-center leading-[1.1]">
              <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.06em] uppercase text-[#c8323d]">{week.next.dow}</span>
              <span className="font-(family-name:--font-display) font-black text-[22px] text-tn-ink">{week.next.n}</span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{week.next.title}</span>
              {week.next.sub && <span className="text-[12px] text-foreground">{week.next.sub}</span>}
            </span>
          </div>
        </div>
      )}
      {linked && (
        <Link href="/agenda" className="inline-flex items-center gap-1.5 text-[13px] font-bold self-start text-tn-teal hover:text-tn-ink">
          Open Agenda<Icon d="M9 6l6 6-6 6" size={14} width={2.2} />
        </Link>
      )}
    </div>
  )
}
