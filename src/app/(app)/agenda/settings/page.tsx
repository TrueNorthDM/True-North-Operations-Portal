// Agenda settings (owner, 30 October 2026): the team calendar, the person's
// Google accounts, working hours, holidays and time zone. Not found while the
// new Agenda is closed (migration 134), for Super Admins too.

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { agendaViewer } from '@/lib/agenda/data'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadAgendaSettings } from '@/lib/agenda/settings-data'
import { AgendaSettings } from '@/components/agenda/settings/AgendaSettings'
import { connectAccount, connectTeamCalendar, disconnectAccount, disconnectTeamCalendar, saveBookingLink, saveWorkingHours, setAllLevels, setInviteAccount } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Agenda settings' }

export default async function AgendaSettingsRoute() {
  const access = await requireSurface('agenda')
  if (!(await agendaGoogleOpen())) notFound()
  const v = await agendaViewer(access)
  if (!v) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  const data = await loadAgendaSettings(v.id, v.superAdmin)
  return (
    <div className="max-w-[880px] flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[normal] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Agenda settings</h1>
        <p className="m-0 text-[14px] text-foreground">Your Google accounts and how the portal uses them.</p>
      </div>
      <AgendaSettings data={data} api={{ connectAccount, disconnectAccount, setInviteAccount, saveWorkingHours, connectTeamCalendar, disconnectTeamCalendar, setAllLevels, saveBookingLink }} />
    </div>
  )
}
