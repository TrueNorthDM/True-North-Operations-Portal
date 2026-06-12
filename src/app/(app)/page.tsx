// Home — three blocks: (1) five destination widgets, (2) the user's favourites
// (up to 5, stored per user), (3) the company org chart. Admin is reachable
// from the sidebar. Uses the wide Home container (see MainContent) so the five
// widgets sit side by side.

import { createClient } from '@/lib/supabase/server'
import { HomeWidgets } from '@/components/home/HomeWidgets'
import { FavoritesBlock, type Favorite } from '@/components/home/FavoritesBlock'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { catalogFor } from '@/lib/favorites/catalog'

async function getFavorites(): Promise<Favorite[]> {
  const supabase = await createClient()
  // RLS (favorites_owner) scopes the read to the signed-in user's rows. The
  // table isn't in the generated types yet, hence the cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('favorites')
    .select('href, label, position')
    .order('position')
  return ((data ?? []) as { href: string; label: string }[]).map(f => ({ href: f.href, label: f.label }))
}

export default async function HomePage() {
  const [org, favorites, isAdmin] = await Promise.all([getOrgChart(), getFavorites(), isCurrentUserAdmin()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">True North Operations Portal</h1>
        <p className="mt-1 text-slate-500">Where would you like to go?</p>
      </div>

      {/* Block 1 — destination widgets (My Team / My Work are placeholders). */}
      <HomeWidgets />

      {/* Block 2 — the user's pinned favourites. */}
      <FavoritesBlock favorites={favorites} catalog={catalogFor(isAdmin)} />

      {/* Block 3 — company org chart, permanent fixture of the home page. */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold text-slate-900">Organization</h2>
          {org.total > 0 && (
            <span className="text-xs text-slate-400">{org.total} people</span>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
          <OrgChart roots={org.roots} />
        </div>
      </section>
    </div>
  )
}
