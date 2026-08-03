// Home: welcome banner, destination widgets, the i7 budget at a glance
// (privileged tiers), and the company org chart. Admin is reachable from the
// sidebar. Uses the wide Home container (see MainContent) so widgets sit side
// by side.

import { createClient } from '@/lib/supabase/server'
import { HomeWidgets } from '@/components/home/HomeWidgets'
import { WelcomeBanner } from '@/components/home/WelcomeBanner'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { loadAccess } from '@/lib/access/resolve'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { Anniversaries } from '@/components/home/Anniversaries'
import { Birthdays } from '@/components/home/Birthdays'
import { loadCelebrationPeople } from '@/lib/hr/celebrations'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'
import { SystemHealthBanner } from '@/components/admin/SystemHealthBanner'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [org, access, me, celebPeople] = await Promise.all([getOrgChart(), loadAccess(), loadCurrentPerson(supabase, user), loadCelebrationPeople()])
  // Budget at a glance. Needs BOTH the level's report-widget surface and the
  // Clients Reports tool on one of their teams, so switching either off in
  // Admin -> Access levels or on the Teams tab removes the widget here too.
  const month = currentYearMonth()
  const showBudget = access.can('report-widget') && access.canTool('i7-budget')
  const i7Carryover = showBudget ? (await loadI7ReportData(month)).carryover : null

  return (
    <div className="space-y-8">
      <WelcomeBanner name={me?.full_name ?? null} />

      {/* Surfaces a red alert to admins if a monitored integration is down. */}
      <SystemHealthBanner />

      {/* Destination widgets (My Team is a placeholder). */}
      <HomeWidgets />

      {/* Budget at a glance, gated by level + team tool grant. */}
      {i7Carryover && <I7BudgetWidget month={month} carryover={i7Carryover} />}

      {/* This month's work anniversaries + birthdays, side by side. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Anniversaries people={celebPeople} />
        <Birthdays people={celebPeople} />
      </section>

      {/* Company org chart, permanent fixture of the home page. */}
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
