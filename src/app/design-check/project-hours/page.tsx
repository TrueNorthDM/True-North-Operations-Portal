import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { MoneyInDialog } from '@/components/tsheets/MoneyInDialog'
import { TRACKED_PROJECTS } from '@/lib/timeclock/projects'
import { DATA as data } from './fixture'


export default function ProjectHoursDesignCheck() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
            Client Report · Project Hours &amp; Others
          </h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            September 2026, real hours and computed costs. Switch between Costs and People below.
          </p>
        </div>
        {/* The real dialog on fixture figures, so the form can be looked at
            without a login. Saving from here reaches a server action that will
            refuse: this checks the shape, not the write. */}
        <MoneyInDialog
          data={{
            month: '2026-09',
            donations: { AAAF: '2450', 'GP church': '', 'GP School': '', Africa: '', '': '6100' },
            purchases: { 'GP church': { hours: '', amount: '' }, 'GP School': { hours: '11.25', amount: '1012.50' } },
          }}
          projects={TRACKED_PROJECTS}
        />
        <ProjectHoursReport data={data} />
      </div>
    </div>
  )
}
