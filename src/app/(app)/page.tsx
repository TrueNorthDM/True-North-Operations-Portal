// Home — welcome banner, destination widgets, the i7 budget at a glance
// (privileged tiers), and the company org chart. Admin is reachable from the
// sidebar. Uses the wide Home container (see MainContent) so widgets sit side
// by side.

import { createClient } from '@/lib/supabase/server'
import { HomeWidgets } from '@/components/home/HomeWidgets'
import { WelcomeBanner } from '@/components/home/WelcomeBanner'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { getCurrentTier } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [org, tier, me] = await Promise.all([getOrgChart(), getCurrentTier(), loadCurrentPerson(supabase, user)])
  // i7 budget at a glance — privileged only (sensitive $), for the current month.
  const month = currentYearMonth()
  const i7Carryover = tier.isPrivileged ? (await loadI7ReportData(month)).carryover : null

  return (
    <div className="space-y-8">
      <WelcomeBanner name={me?.full_name ?? null} />

      {/* Destination widgets (My Team is a placeholder). */}
      <HomeWidgets />

      {/* i7 budget at a glance — privileged tiers only. */}
      {i7Carryover && <I7BudgetWidget month={month} carryover={i7Carryover} />}

      {/* Company org chart — permanent fixture of the home page. */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-tn-ink">Organization</h2>
          {org.total > 0 && (
            <span className="text-xs text-muted">{org.total} people</span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
          <OrgChart roots={org.roots} />
        </div>
      </section>
    </div>
  )
}
