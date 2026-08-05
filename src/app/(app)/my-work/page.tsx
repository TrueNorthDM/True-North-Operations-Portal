// My Work, everything assigned to the signed-in person across Monday, as a
// board or list. Available to any signed-in user (the (app) layout gates auth).
// Data is the in-repo sample until the Monday pull is wired.
//
// My team rides along as a second tab: both answer "what is mine". The tab is a
// search param so the page stays a server component and each tab is linkable.

import Link from 'next/link'
import { MyWork } from '@/components/MyWork'
import { requireSurface, loadAccess } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadMyTeam } from '@/lib/directory/my-team'
import { RestrictedDirectory } from '@/components/admin/RestrictedDirectory'

export const metadata = { title: 'My Work' }
export const dynamic = 'force-dynamic'

// My Team first, and the default: My Work is still sample data, so landing on
// it every time would mean landing on a placeholder.
const TABS = [
  { key: 'team', label: 'My Team' },
  { key: 'work', label: 'My Work' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSurface('my-work')
  const { tab } = await searchParams
  const active: TabKey = TABS.some(t => t.key === tab) ? (tab as TabKey) : 'team'

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 flex items-center gap-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={t.key === 'team' ? '/my-work' : `/my-work?tab=${t.key}`}
            aria-current={t.key === active ? 'page' : undefined}
            className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${
              t.key === active
                ? 'border-tn-teal text-tn-ink'
                : 'border-transparent text-muted hover:text-tn-ink hover:border-slate-300'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {active === 'work' ? <UnderConstruction /> : <MyTeamTab />}
    </div>
  )
}

/**
 * My Work is not connected to Monday yet: everything it renders is the in-repo
 * sample. The small "SAMPLE" chip beside the title was easy to miss next to a
 * board that looks entirely real, so the state is stated before the content
 * rather than beside it.
 */
function UnderConstruction() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-6 py-10 text-center">
        <div className="text-4xl leading-none" aria-hidden="true">🚧</div>
        <h2 className="mt-3 font-(family-name:--font-display) font-extrabold text-[22px] text-[#7a4e05]">
          This page is under construction
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#7a4e05]">
          Everything below is sample data, not your real work. It is here to show the shape of the page
          while the Monday connection is built. Nothing on it is yours and nothing you do here is saved.
        </p>
      </div>
      <MyWork />
    </div>
  )
}

async function MyTeamTab() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Same rule the Directory follows: level 3 opens every teammate's card,
  // levels 1 and 2 only your own.
  const access = await loadAccess()
  const { people, profiles, selfId } = await loadMyTeam(supabase, user, directoryLevel(access.can))

  return <RestrictedDirectory people={people} teams={[]} showTeams={false} profiles={profiles} selfId={selfId} />
}
