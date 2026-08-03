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

const TABS = [
  { key: 'work', label: 'My Work' },
  { key: 'team', label: 'My Team' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSurface('my-work')
  const { tab } = await searchParams
  const active: TabKey = TABS.some(t => t.key === tab) ? (tab as TabKey) : 'work'

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 flex items-center gap-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={t.key === 'work' ? '/my-work' : `/my-work?tab=${t.key}`}
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

      {active === 'work' ? <MyWork /> : <MyTeamTab />}
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
