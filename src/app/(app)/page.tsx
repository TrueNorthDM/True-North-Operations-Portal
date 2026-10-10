// Home: welcome banner, the person's favourite pages (Settings, Home and
// start, since 7 October 2026), the i7 budget at a glance (privileged tiers),
// publishing goals, this month's celebrations, and the company org chart.
//
// The three shortcut cards (My Work, My Team, Work Tools) were removed:
// every one of them is a rail item two pixels away, so they spent the top of the
// screen repeating the navigation instead of telling anybody anything.

import { Suspense } from 'react'
import { WelcomeBanner } from '@/components/home/WelcomeBanner'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { loadAccess } from '@/lib/access/resolve'
import { getCurrentPerson } from '@/lib/auth/session'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import { loadPublishingWeeks } from '@/lib/boards/publishing-weeks'
import { Anniversaries } from '@/components/home/Anniversaries'
import { Birthdays } from '@/components/home/Birthdays'
import { loadCelebrationPeople } from '@/lib/hr/celebrations'
import { loadI7Carryover } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'
import { SystemHealthBanner } from '@/components/admin/SystemHealthBanner'
import { perfRun } from '@/lib/perf'
import { Favourites } from '@/components/home/Favourites'
import { buildRail } from '@/lib/access/nav'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadSettings } from '@/lib/settings/person'
import { resolveFavourites } from '@/lib/settings/pages'

export default async function HomePage() {
  const perf = perfRun('home')
  const month = currentYearMonth()

  // Budget at a glance. The widget is not a card on Work Tools, so it
  // is not a team-grantable tool: it follows the access level alone. (Team
  // grants govern the Clients Reports PAGE, which is such a card.)
  //
  // Started the moment access is known, alongside everything else. It used to
  // start after all of it, so the i7 figures waited on the Publishing card,
  // which until September 2026 was reading 26.7 MB of snapshot.
  const accessP = loadAccess()
  // loadI7Carryover, not loadI7ReportData: the widget shows the balance and
  // nothing else, and building the whole report to keep one figure of it was
  // 1.2 of the page's 1.24 seconds.
  const carryoverP = accessP.then(a =>
    // Whoever opens the i7 report sees its budget here too: the tool itself,
    // level and team list (owner's decision, 7 October 2026).
    a.canTool('i7-budget')
      // A read that fails shows as unavailable, never as a figure: it used to
      // come back as $0 used and the whole budget left (audit, 9 October 2026).
      ? loadI7Carryover(month).catch(e => { console.error('[home] i7 budget:', (e as Error).message); return 'unavailable' as const })
      : null)

  // Publishing goals is for everyone, so it is loaded for everyone. It reads the
  // published facts the ingest stores beside the snapshot, about 20 KB, not the
  // snapshot itself; see lib/boards/published-items.ts.
  const meP = getCurrentPerson()
  const favouritesP = Promise.all([accessP, meP.then(m => (m ? loadSettings(createAdminClient(), m.id) : null))])
    .then(([a, s]) => (s ? resolveFavourites(buildRail({ can: a.can, canTool: a.canTool }), s.favourites) : []))
  const [org, access, me, celebPeople, publishing, i7Carryover, favourites] = await Promise.all([
    perf.time('org', getOrgChart()),
    perf.time('access', accessP),
    perf.time('person', meP),
    perf.time('celebrations', loadCelebrationPeople()),
    // A read that fails shows on the card as "could not be read", never as
    // "no target" or no card at all (audit, 10 October 2026).
    perf.time('publishing', loadPublishingWeeks().catch(e => {
      console.error('[home] publishing goals:', e instanceof Error ? e.message : e)
      return null
    })),
    perf.time('i7', carryoverP),
    perf.time('favourites', favouritesP),
  ])
  perf.done({ budget: i7Carryover !== null })

  return (
    <div className="space-y-8">
      <WelcomeBanner name={me?.full_name ?? null} />

      <Favourites items={favourites} />

      {/* Surfaces a red alert to admins if a monitored integration is down.
          In its own boundary: it checks the security role with a full round
          trip to the Auth server, for everyone, before deciding to render
          nothing for almost everyone. Outside a boundary the whole page waited
          for that answer. */}
      <Suspense fallback={null}>
        <SystemHealthBanner />
      </Suspense>

      {/* Budget at a glance, gated by level + team tool grant. */}
      {i7Carryover === 'unavailable'
        ? <p role="status" className="m-0 rounded-[14px] border border-[var(--panel-border)] bg-white px-5 py-4 text-[13.5px] text-muted">The i7 budget could not be read just now. Open the i7 report to try again.</p>
        : i7Carryover && <I7BudgetWidget month={month} carryover={i7Carryover} />}

      {/* Half the width each. Publishing goals is four weeks of two clients,
          so it runs as tall as the two short celebration cards stacked, and the
          three of them fill the row without leaving a column of white.
          Its figures are for everyone; only those who can open the page behind
          it get a card that links. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PublishingGoalsWidget data={publishing} linked={access.canTool('publishing')} />
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
