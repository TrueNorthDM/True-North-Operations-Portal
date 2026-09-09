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

      {/* Half the width each. Publishing goals is four weeks of two clients,
          so it runs as tall as the two short celebration cards stacked, and the
          three of them fill the row without leaving a column of white.
          Its figures are for everyone; only those who can open the page behind
          it get a card that links. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PublishingGoalsWidget boards={publishing} linked={access.canTool('publishing')} />
        <div className="space-y-6">
          <Birthdays people={celebPeople} />
          <Anniversaries people={celebPeople} />
        </div>
      </section>

      {/* Company org chart, permanent fixture of the home page. Its title sits
          inside the card, like the two above it, with the headcount beside the
          name rather than pushed to the far end of the row. */}
      <section className="rounded-xl border border-slate-200 bg-white/60 p-4">
        <div className="flex items-baseline gap-2.5 mb-3">
          <h2 className="text-lg font-bold text-tn-ink m-0">Organization</h2>
          {org.total > 0 && <span className="text-[13px] text-muted">{org.total} people</span>}
        </div>
        <OrgChart roots={org.roots} />
      </section>
    </div>
  )
}
