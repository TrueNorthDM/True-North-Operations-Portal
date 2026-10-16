// Design check: Approvals (Time Entries.dc.html, frames 3L Super Admin and 3L2
// Team Leader), the real component over the prototype's own sample data.
// ?frame=3L or ?frame=3L2. Nothing is saved anywhere. Development only.

import { notFound } from 'next/navigation'
import { ApprovalsCheck } from './ApprovalsCheck'

export const dynamic = 'force-dynamic'

export default async function ClockyApprovalsCheck({ searchParams }: { searchParams: Promise<{ frame?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame } = await searchParams
  return <ApprovalsCheck frame={frame === '3L2' ? '3L2' : '3L'} />
}
