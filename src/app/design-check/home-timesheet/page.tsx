// Design check: the Home card for a timesheet to send (owner, 25 October 2026),
// on the day it closes and once late. /design-check/home-timesheet

import { WelcomeBanner } from '@/components/home/WelcomeBanner'
import { TimesheetDueCard } from '@/components/home/TimesheetDueCard'

export default function Page() {
  return (
    <div className="min-h-screen bg-background px-8 py-8">
      <div className="max-w-[1380px] mx-auto space-y-8">
        <WelcomeBanner name="Arnaldo Oliveira" />
        <TimesheetDueCard href="#" t={{ state: 'today', days: 0, label: 'October', full: 'October 2026', start: '2026-10-01', end: '2026-10-31', hours: '151h 15m' }} />
        <WelcomeBanner name="Wendy Cacka" />
        <TimesheetDueCard href="#" t={{ state: 'late', days: 3, label: 'Oct 4 to 17', full: 'Oct 4 to 17, 2026', start: '2026-10-04', end: '2026-10-17', hours: '76h 30m' }} />
      </div>
    </div>
  )
}
