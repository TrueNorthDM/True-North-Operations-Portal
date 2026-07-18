// Home — three blocks: (1) five destination widgets, (2) the user's favourites
// (up to 5, stored per user), (3) the company org chart. Admin is reachable
// from the sidebar. Uses the wide Home container (see MainContent) so the five
// widgets sit side by side.

import { createClient } from '@/lib/supabase/server'
import { HomeWidgets } from '@/components/home/HomeWidgets'
import { FavoritesBlock, type Favorite } from '@/components/home/FavoritesBlock'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { isCurrentUserAdmin, getCurrentTier } from '@/lib/auth/role'
import { catalogFor } from '@/lib/favorites/catalog'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'

async function getFavorites(): Promise<Favorite[]> {
  const supabase = await createClient()
  // RLS (favorites_owner) scopes the read to the signed-in user's rows.
  const { data } = await supabase
    .from('favorites')
    .select('href, label, position')
    .order('position')
  return (data ?? []).map(f => ({ href: f.href, label: f.label }))
}

export default async function HomePage() {
  const [org, favorites, isAdmin, tier] = await Promise.all([getOrgChart(), getFavorites(), isCurrentUserAdmin(), getCurrentTier()])
  // i7 budget at a glance — privileged only (sensitive $), for the current month.
  const month = currentYearMonth()
  const i7Carryover = tier.isPrivileged ? (await loadI7ReportData(month)).carryover : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-tn-ink">True North Operations Portal</h1>
        <p className="mt-1 text-muted">Where would you like to go?</p>
      </div>

      {/* Block 1 — destination widgets (My Team / My Work are placeholders). */}
      <HomeWidgets />

      {/* i7 budget at a glance — privileged tiers only. */}
      {i7Carryover && <I7BudgetWidget month={month} carryover={i7Carryover} />}

      {/* Block 2 — the user's pinned favourites. */}
      <FavoritesBlock favorites={favorites} catalog={catalogFor(isAdmin)} />

      {/* Block 3 — company org chart, permanent fixture of the home page. */}
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
