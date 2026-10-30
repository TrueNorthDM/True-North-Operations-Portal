// Agenda on Home (design_handoff_home, section 4), the right column for
// everyone: who is out today, then the next 5 events. The figures are the
// Agenda's (lib/agenda/home.ts over loadAgendaItems), so the two always agree.
// It replaces ThisWeekCard.

import Link from 'next/link'
import { Avatar } from '@/components/Avatar'
import { Icon } from '@/components/clocky/entries/ui'
import { TenureBadge } from '@/components/TenureBadge'
import { yearColor } from '@/lib/tenure'
import type { Look } from '@/lib/agenda/model'
import type { HomeAgenda } from '@/lib/agenda/home'

const HEAD = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted'

export function HomeAgendaCard({ agenda, linked = true }: { agenda: HomeAgenda | 'unavailable'; linked?: boolean }) {
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[18px] p-5 flex flex-col gap-3.5 leading-[normal]">
      <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">Agenda</span>
      {agenda === 'unavailable'
        ? <p role="status" className="m-0 text-[13.5px] text-muted">The Agenda could not be read just now. Open the Agenda to try again.</p>
        : <Body agenda={agenda} />}
      {linked && (
        <Link href="/agenda" className="inline-flex items-center gap-1.5 text-[13px] font-bold self-start text-tn-teal hover:text-tn-ink">
          Open Agenda<Icon d="M9 6l6 6-6 6" size={14} width={2.2} />
        </Link>
      )}
    </div>
  )
}

function Body({ agenda }: { agenda: HomeAgenda }) {
  const { out, events } = agenda
  return (
    <>
      <div className="flex flex-col gap-2.5 bg-[#f8f7f3] border border-[#eceff3] rounded-[12px] p-3">
        <div className="flex items-baseline justify-between">
          <span className={HEAD}>Out today</span>
          {out.length > 0 && <span className="text-[12px] text-muted">{out.length} {out.length === 1 ? 'person' : 'people'}</span>}
        </div>
        {out.map(o => (
          <div key={o.id} className="flex items-center gap-2.5">
            <Avatar name={o.name} avatarUrl={o.avatarUrl} size={30} tone="neutral" />
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[13px] font-bold text-tn-ink">{o.name}</span>
              <span className="text-[12px] text-muted">{o.reason}</span>
            </span>
            <span className="text-[12px] text-[#5b6b82] whitespace-nowrap">{o.until}</span>
          </div>
        ))}
        {!out.length && <span className="text-[13px] text-muted">Everyone is in today.</span>}
      </div>
      <div className="flex flex-col gap-1">
        {events.map((e, i) => (
          <div key={e.id} className="contents">
            {(i === 0 || events[i - 1].section !== e.section) && (
              <span className={`${HEAD} px-0.5 pt-2 pb-1`}>{e.section === 'today' ? 'Today' : 'Coming up'}</span>
            )}
            <div className={`flex gap-3 items-center rounded-[12px] px-3 py-2.5 ${e.section === 'today' ? 'bg-subtle' : ''}`}>
              <span className="w-11 flex-none flex flex-col items-center leading-[1.1]">
                <span className={`font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.06em] uppercase ${e.time ? 'text-[#c8323d]' : 'text-muted'}`}>{e.top}</span>
                <span className={`font-(family-name:--font-display) font-black text-tn-ink tabular-nums ${e.time ? 'text-[17px]' : 'text-[22px]'}`}>{e.big}</span>
              </span>
              <KindIcon look={e.look} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{e.title}</span>
                <span className="text-[12px] text-foreground">{e.sub}</span>
              </span>
            </div>
          </div>
        ))}
        {!events.length && <span className="text-[13px] text-muted">Nothing on the Agenda in the next month.</span>}
      </div>
    </>
  )
}

/** The Agenda's tile for the item's kind, as its List view draws it: the tenure badge for an anniversary, else the icon or flag. */
function KindIcon({ look }: { look: Look }) {
  if (look.yrs) return <TenureBadge milestone={{ kind: 'year', value: look.yrs, color: yearColor(look.yrs) }} size={30} compact />
  return (
    <span aria-hidden="true" className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-none" style={{ background: look.bg, color: look.fg }}>
      {look.flag ? <span className="text-[16px] leading-none">{look.flag}</span> : look.d && <Icon d={look.d} size={15} width={2.2} />}
    </span>
  )
}
