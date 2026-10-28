// Clocky, Time entries (design handoff of 16 October 2026, SPEC sections 8
// and 9): one page in place of QuickBooks Time's Timesheets, Manual Time Card
// and Time Slider, for every level, scoped by the access rule (lib/timeclock/
// scope.ts). The import, the rules and the reconciliation that lived here
// moved to /clocky-hours/import.
//
// The page reads the viewer's week (their own hours) and the clock panel's
// data (the jobs, fields, smart defaults and combinations the forms need);
// everything after that is the screen calling the actions in
// entries-actions.ts. ?entry=<id> (Clock safety's "Open entry") opens that
// entry's history (3G), which reads it by id whatever period is on screen.
// ?person=<id> (Who's working, "Their time entries") opens All (My team for a
// Team Leader) with that Team member picked, when the viewer's scope covers
// them; otherwise it is ignored and the page opens on the viewer's own week.

import { requireSurface } from '@/lib/access/resolve'
import { addDays } from '@/lib/timeclock/periods'
import { TimeEntriesLive } from '@/components/clocky/entries/TimeEntriesLive'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getClockPanel } from './clock-actions'
import { getEntries } from './entries-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Time entries' }

export default async function TimeEntriesPage({ searchParams }: { searchParams: Promise<{ entry?: string; person?: string; submit?: string }> }) {
  await requireSurface('clocky-hours')
  const params = await searchParams
  const asked = Number(params.entry)
  const openEntry = Number.isInteger(asked) && asked > 0 ? asked : null
  const panel = await getClockPanel()
  const today = panel.ok ? panel.data.today : null
  const from = today ? addDays(today, -new Date(`${today}T00:00:00Z`).getUTCDay()) : null
  const week = from ? { from, to: addDays(from, 6) } : null

  // A person asked for: their week, if the viewer may see it (the picker's own list says so).
  const person = typeof params.person === 'string' && params.person ? params.person : null
  const theirs = week && person ? await getEntries({ ...week, who: 'all', personId: person }) : null
  const member = theirs?.ok && theirs.data.viewer.who && theirs.data.people.some(p => p.id === person) ? person : null
  const entries = member ? theirs : week ? await getEntries({ ...week, who: 'my' }) : null

  if (!panel.ok || !entries?.ok) {
    const error = !panel.ok ? panel.error : entries && !entries.ok ? entries.error : 'The entries could not be read. Try again in a moment.'
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Breadcrumb parents={['/clocky-hours']} now="Time entries" />
          <h1 className="m-0 mt-0.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Time entries</h1>
        </div>
        <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">{error}</p>
      </div>
    )
  }
  const { me, now, jobs, fields, defaults, combinations, recents, folders, correctionGoesTo, running, switchDate } = panel.data
  // Keyed by the address: a link to another person or entry, followed from this
  // page (the Who's working drawer, the bell), starts the screen afresh.
  return (
    <TimeEntriesLive
      key={`${member ?? 'me'}-${openEntry ?? ''}-${params.submit ?? ''}`}
      initialData={entries.data}
      openEntry={openEntry}
      member={member}
      openSubmit={params.submit === '1' && !member}
      // switchDate too: without it the forms took every day for a TSheets one.
      catalog={{ me, now, today: panel.data.today, jobs, fields, defaults, combinations, recents, folders, correctionGoesTo, running, switchDate }}
    />
  )
}
