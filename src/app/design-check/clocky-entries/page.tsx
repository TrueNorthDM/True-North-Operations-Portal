// Design check: Time entries, frame by frame (Time Entries.dc.html, frames 3A1
// to 3K4 and E), the real components over the prototype's own sample data.
// ?frame=3A1 opens a frame, as the prototype's own query string does. "Now" is
// Thu, Oct 15, 2026, 1:20 PM in New York, frozen. Nothing is saved anywhere.
// Development only.

import { notFound } from 'next/navigation'
import { EntriesCheck } from './EntriesCheck'

export const dynamic = 'force-dynamic'

export default async function ClockyEntriesCheck({ searchParams }: { searchParams: Promise<{ frame?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame } = await searchParams
  return <EntriesCheck frame={frame ?? '3A1'} />
}
