// Home: welcome banner, the i7 budget at a glance (privileged tiers),
// publishing goals, this month's celebrations, and the company org chart.
//
// The three shortcut cards (My Work, My Team, Tools & Dashboards) were removed:
// every one of them is a rail item two pixels away, so they spent the top of the
// screen repeating the navigation instead of telling anybody anything.

import { createClient } from '@/lib/supabase/server'
import { WelcomeBanner } from '@/components/home/WelcomeBanner'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { loadAccess } from '@/lib/access/resolve'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import { loadPublishingWeeks } from '@/lib/boards/publishing-weeks'
import { Anniversaries } from '@/components/home/Anniversaries'
import { Birthdays } from '@/components/home/Birthdays'
import { loadCelebrationPeople } from '@/lib/hr/celebrations'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'
import { SystemHealthBanner } from '@/components/admin/SystemHealthBanner'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Publishing goals is for everyone, so it is loaded for everyone. It reads
  // the warm snapshot store the nightly cron fills, not Monday, so it costs a
  // couple of indexed reads rather than a third-party round trip.
  const [org, access, me, celebPeople, publishing] = await Promise.all([
    getOrgChart(), loadAccess(), loadCurrentPerson(supabase, user), loadCelebrationPeople(),
    loadPublishingWeeks(),
  ])
  // Budget at a glance. The widget is not a card on Tools & Dashboards, so it
  // is not a team-grantable tool: it follows the access level alone. (Team
  // grants govern the Clients Reports PAGE, which is such a card.)
  const month = currentYearMonth()
  const showBudget = access.can('report-widget')
  const i7Carryover = showBudget ? (await loadI7ReportData(month)).carryover : null

  return (
    <div className="space-y-8">
      <WelcomeBanner name={me?.full_name ?? null} />

      {/* Surfaces a red alert to admins if a monitored integration is down. */}
      <SystemHealthBanner />

      {/* Budget at a glance, gated by level + team tool grant. */}
      {i7Carryover && <I7BudgetWidget month={month} carryover={i7Carryover} />}

      {/* Three columns. Publishing goals' figures are for everyone; only the
          people who can open the page behind it get a card that links. */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        <PublishingGoalsWidget boards={publishing} linked={access.canTool('publishing')} />
        <Birthdays people={celebPeople} />
        <Anniversaries people={celebPeople} />
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
