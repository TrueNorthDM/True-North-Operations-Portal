// The Agenda (Clocky part 2, Agenda.dc.html 8A to 8E): one calendar for the
// whole company, for everyone. ?view=month|week|list and ?d=<a day> pick what
// is on screen; the data is lib/agenda/data.ts.

import { requireSurface } from '@/lib/access/resolve'
import { agendaViewer, holidaysIn, loadAgendaItems } from '@/lib/agenda/data'
import { viewDays, type AgendaView as View } from '@/lib/agenda/model'
import { loadConnections } from '@/lib/integrations/connections'
import { teamColour } from '@/lib/directory/team-colour'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { localDate } from '@/lib/timeclock/format'
import { addDays } from '@/lib/timeclock/periods'
import { loadClients } from '@/lib/timeclock/requests-data'
import { AgendaView } from '@/components/agenda/AgendaView'
import { createAgendaEvent } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Agenda' }

const ISO = /^\d{4}-\d{2}-\d{2}$/

export default async function AgendaRoute({ searchParams }: { searchParams: Promise<{ view?: string; d?: string }> }) {
  const access = await requireSurface('agenda')
  const v = await agendaViewer(access)
  if (!v) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  const sp = await searchParams
  const view: View = sp.view === 'week' || sp.view === 'list' ? sp.view : 'month'
  const today = localDate(new Date(), v.zone)
  const anchor = sp.d && ISO.test(sp.d) ? sp.d : today
  // The days on screen and the next two weeks ("Coming up").
  const { from, to } = viewDays(view, anchor)
  const lo = from < today ? from : today, hi = to > addDays(today, 13) ? to : addDays(today, 13)

  const company = access.can('ag-company')
  const [items, dir, conn] = await Promise.all([loadAgendaItems(v, lo, hi), loadDirectory(), loadConnections()])
  const led = dir.led.get(v.id) ?? new Set<string>()
  const teams = [...dir.teams.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(t => ({ id: t.id, name: t.name, color: teamColour(t.color, t.name) }))
  const mode = company ? 'company' as const : access.can('ag-team') && led.size ? 'team' as const : null

  return (
    <AgendaView
      api={createAgendaEvent}
      data={{
        view, anchor, today, items, teams,
        me: { id: v.id, superAdmin: v.superAdmin, zone: v.zone },
        holidays: [...holidaysIn(lo, addDays(hi, 31)).keys()],
        create: mode && {
          mode,
          teams: mode === 'company' ? teams : teams.filter(t => led.has(t.id)),
          clients: mode === 'company' ? await loadClients() : [],
          zone: v.zone, today,
          calendar: conn.google.connected
            ? 'The team calendar (set in Company settings › Integrations)'
            : 'Google Calendar is not connected yet: it goes there once it is (Company settings › Integrations)',
        },
      }}
    />
  )
}
