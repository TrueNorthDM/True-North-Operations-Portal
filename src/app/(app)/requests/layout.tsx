// Requests (time off, reimbursements, extra hours) are North Time's: while it is
// closed (migration 132) only a Super Admin opens them, under the closed line.
import { NorthTimeClosedBanner } from '@/components/clocky/NorthTimeClosedBanner'
import { requireNorthTimeOpen } from '@/lib/timeclock/north-time-gate'

export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  await requireNorthTimeOpen()
  return (
    <>
      <NorthTimeClosedBanner />
      {children}
    </>
  )
}
