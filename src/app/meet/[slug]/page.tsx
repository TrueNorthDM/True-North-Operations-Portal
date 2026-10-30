// The public booking page (owner, 30 October 2026): anyone, with no portal
// login, books a meeting with someone whose booking link is on. Not found
// while the new Agenda is closed (migration 134); a link that is off says so.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { freeSlots, loadPublicLink } from '@/lib/agenda/booking-data'
import { BookingPage } from '@/components/agenda/booking/BookingPage'
import { BookingFrame, HostSide, MAIN, H4, Mark } from '@/components/agenda/booking/BookingFrame'
import { holdBooking, resendBooking } from '../actions'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = (await agendaGoogleOpen()) ? await loadPublicLink(slug) : null
  const name = found ? ('host' in found ? found.host.name : found.off) : null
  return { title: name ? `Book a meeting with ${name}` : 'Book a meeting', robots: { index: false, follow: false } }
}

export default async function MeetPage({ params }: Props) {
  const { slug } = await params
  if (!(await agendaGoogleOpen())) notFound()
  const found = await loadPublicLink(slug)
  if (!found) notFound()
  if (!('host' in found)) {
    const initials = found.off.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    return (
      <BookingFrame>
        <HostSide name={found.off} initials={initials} />
        <div className={MAIN}>
          <Mark kind="warn" />
          <h4 className={H4}>Not taking bookings right now</h4>
          <p className="m-0 text-[14px] leading-[1.5] text-foreground">{found.off} is not taking bookings through this page at the moment. Reach them another way, or try again later.</p>
        </div>
      </BookingFrame>
    )
  }
  const { host } = found
  const slots = await freeSlots(host)
  return (
    <BookingPage host={{ name: host.name, initials: host.initials, slug: host.slug, lengths: host.lengths }} slots={slots}
      api={{ hold: holdBooking, resend: resendBooking }} />
  )
}
