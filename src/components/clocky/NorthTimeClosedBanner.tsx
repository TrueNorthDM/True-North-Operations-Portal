import { northTimeOpen, NORTH_TIME_CLOSED } from '@/lib/timeclock/north-time-lock'

/** The thin line on North Time's pages while it is closed (migration 132). Nothing while open. */
export async function NorthTimeClosedBanner() {
  if (await northTimeOpen()) return null
  return (
    <div role="status" className="print:hidden mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      {NORTH_TIME_CLOSED} Nothing can be recorded or decided here until a Super Admin opens North Time in Company settings.
    </div>
  )
}
