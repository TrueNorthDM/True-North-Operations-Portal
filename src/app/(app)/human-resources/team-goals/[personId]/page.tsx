// The 6-month check-in (design handoff, G5 and G6): only for the person's
// manager now. Book opens the Agenda's New event drawer, filled in; during or
// after the meeting they comment on each goal and finish the check-in.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PAGE_TITLE } from '@/lib/ui/type'
import { Checkin } from '@/components/review/HrParts'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadGoalsView } from '@/lib/review/mine'
import { nameIn, reviewToday } from '@/lib/review/data'
import { bookingFor } from '@/lib/review/booking'
import { createDrawerEvent, deleteDrawerEvent, findTimeData, updateDrawerEvent } from '@/app/(app)/agenda/drawer-actions'
import { commentGoal, finishCheckin, linkCheckin } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Check-in' }

export default async function CheckinRoute({ params, searchParams }: { params: Promise<{ personId: string }>; searchParams: Promise<{ book?: string }> }) {
  const { personId } = await params
  const bookNow = (await searchParams).book === '1'
  const { access, viewer, roster } = await reviewContext(await requireSurface('human-resources'))
  if (!viewer.reports.has(personId)) notFound()
  const today = reviewToday()
  const v = await loadGoalsView(personId, roster, today, viewer.personId)
  if (!v) notFound()
  const name = nameIn(roster, personId)
  const booking = !v.checkin.at ? await bookingFor(access, {
    personId, today, minutes: 30, title: `6-month check-in: ${name}`,
    note: `Booked from ${name}'s goals for ${v.year}, so it is already filled in. Once it is saved, the check-in shows on the goals, on both Agendas and on both Google Calendars.`,
    description: `Your 6-month check-in. We go through each of your goals for ${v.year}: where it is, and what we agree for the rest of the year.`,
  }) : null
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb parents={['/human-resources', { href: '/human-resources?tab=team', label: "My team's goals" }]} now={name} />
      <div className="flex flex-col gap-1.5"><h1 className={PAGE_TITLE}>Check-in: {name}</h1><p className="m-0 text-[15px] text-muted">Goals for {v.year} · 6-month check-in</p></div>
      <Checkin v={v} name={name} booking={booking} today={today}
        drawerApi={booking ? { create: createDrawerEvent, update: updateDrawerEvent, remove: deleteDrawerEvent, findTime: findTimeData } : null}
        api={{ commentGoal, linkCheckin, finishCheckin }} bookNow={bookNow} />
    </div>
  )
}
