'use client'

// 8A to 8F (Agenda.dc.html): the real Agenda and the Home card with the
// prototype's sample. Nothing saves and nothing navigates.

import { AgendaView, type AgendaData } from '@/components/agenda/AgendaView'
import { ThisWeekCard } from '@/components/home/ThisWeekCard'
import type { ThisWeek } from '@/lib/agenda/model'

export function AgendaCheck({ data, week }: { data?: AgendaData; week?: ThisWeek }) {
  if (week) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink leading-[normal]" style={{ letterSpacing: '-.01em' }}>Good morning, Arnaldo</h1>
          <p className="m-0 mt-1 text-[13.5px] text-muted">Tuesday, November 3, 2026</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[420px_minmax(0,1fr)] gap-[18px] items-start">
          <ThisWeekCard week={week} linked />
          <div className="border-[1.5px] border-dashed border-[#d9d6cc] rounded-[16px] px-5 py-[18px] text-[13px] text-muted leading-[1.55]">The rest of Home stays as it is.</div>
        </div>
      </div>
    )
  }
  return <AgendaView data={data!} linked={false} api={async i => ({ ok: true, toast: `Created. Everyone who can see it finds it in Agenda${i.google ? ' and on the team Google Calendar' : ''}.` })} />
}
