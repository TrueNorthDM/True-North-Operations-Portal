// My Work, everything assigned to the signed-in person across Monday.
// Available to any signed-in user (the (app) layout gates auth).
//
// A row is a STEP, not an item. That is the whole reason this exists rather
// than a Monday dashboard: a board where one person owns three steps of the
// same item gives them three things to do, and Monday's own views make you
// pick one people column and pretend the others are not there.
//
// My team rides along as a second tab: both answer "what is mine". The tab is a
// search param so the page stays a server component and each tab is linkable.

import Link from 'next/link'
import { requireSurface, loadAccess } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadMyTeam } from '@/lib/directory/my-team'
import { RestrictedDirectory } from '@/components/admin/RestrictedDirectory'
import { WorkList } from '@/components/monday/WorkList'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { isSecurityAdmin } from '@/lib/auth/role'

export const metadata = { title: 'My Work' }
export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'team', label: 'My Team' },
  { key: 'work', label: 'My Work' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function MyWorkPage(
  { searchParams }: { searchParams: Promise<{ tab?: string; person?: string; team?: string; done?: string }> },
) {
  await requireSurface('my-work')
  const sp = await searchParams
  const { tab } = sp
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

      {active === 'work' ? <WorkTab sp={sp} /> : <MyTeamTab />}
    </div>
  )
}

/**
 * The work list.
 *
 * Defaults to the signed-in person, because "my work" is the question. Left
 * unfiltered it is everybody's, which is what a team leader wants and what
 * the person filter is there to narrow.
 */
async function WorkTab({ sp }: { sp: { person?: string; team?: string; done?: string } }) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()

  const { data: me } = auth?.user
    ? await supabase.from('people').select('id').eq('profile_id', auth.user.id).maybeSingle()
    : { data: null }
  const selfPersonId = (me as { id: string } | null)?.id ?? null

  // "person" absent means the signed-in person; "person=" means anybody. The
  // two are different questions and the empty string keeps them apart.
  const personId = sp.person === undefined ? selfPersonId : (sp.person || null)

  const [data, { data: peopleRows }, { data: teamRows }, admin] = await Promise.all([
    loadWorklist(supabase, { personId, teamId: sp.team || null, includeDone: sp.done === '1' }),
    supabase.from('people').select('id, full_name').eq('status', 'active').order('full_name'),
    supabase.from('teams').select('id, name').order('name'),
    isSecurityAdmin(),
  ])

  return (
    <WorkList
      data={data}
      selfPersonId={selfPersonId}
      isAdmin={admin}
      people={((peopleRows ?? []) as { id: string; full_name: string }[]).map(p => ({ value: p.id, label: p.full_name }))}
      teams={((teamRows ?? []) as { id: string; name: string }[]).map(t => ({ value: t.id, label: t.name }))}
    />
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
