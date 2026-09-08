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

import { requireSurface, loadAccess } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadMyTeam } from '@/lib/directory/my-team'
import { TeamPeople } from '@/components/team/TeamPeople'
import { WorkList } from '@/components/monday/WorkList'
import { WorkViewSwitch, VIEW_SURFACE, type WorkView } from '@/components/monday/WorkViewSwitch'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { isSecurityAdmin } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { resolvePersonFilter } from '@/lib/monday/worklist/filters'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export const metadata = { title: 'My Work' }
export const dynamic = 'force-dynamic'

// My Work first, and the default. It was second because it rendered sample
// data and landing on a placeholder every time would have been worse than a
// detour; it reads the real Monday account now, so it is what the page is for.
const TABS = [
  { key: 'work', label: 'My Work' },
  { key: 'team', label: 'My Team' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default async function MyWorkPage(
  { searchParams }: { searchParams: Promise<{ tab?: string; person?: string; team?: string; done?: string }> },
) {
  const sp = await searchParams
  const { tab } = sp
  const asked: TabKey = TABS.some(t => t.key === tab) ? (tab as TabKey) : 'work'

  // The tab decides the grant, because the two views are two surfaces sharing
  // one URL. A prefix in nav.ts cannot see ?tab=team, so the check is here.
  await requireSurface(asked === 'team' ? 'my-team' : 'my-work')

  const access = await loadAccess()
  const can = (v: WorkView) => access.can(VIEW_SURFACE[v])
  const active = asked

  const heading = active === 'work'
    ? { title: 'My Work', desc: 'Every step assigned to you across Monday, in one list.' }
    : { title: 'My Team', desc: 'The people you work with, and what each of them can reach.' }

  return (
    <div className="space-y-6">
      <Breadcrumb self="/my-work" />

      {/* Title on the left, the two views as a segmented control on the right.
          They are two ways of asking "what is mine", so they sit together as
          one control rather than as tabs down the page. */}
      <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[var(--panel-border)]">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">
            {heading.title}
          </h2>
          <p className="text-[14.5px] text-muted mt-1.5 m-0">{heading.desc}</p>
        </div>

        <WorkViewSwitch active={active === 'work' ? 'work' : 'team'} can={can} />
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

  // The portal already knows how to answer "who is signed in", and this had
  // written a weaker version of it: profile_id only. A person whose row was
  // never linked to their login came out as nobody, so the My tasks tab asked
  // to filter by nobody, which is the same as everybody, and clicking it did
  // nothing at all. loadCurrentPerson falls back to matching the email.
  const me = await loadCurrentPerson(supabase, auth?.user ?? null)
  const selfPersonId = me?.id ?? null

  const personId = resolvePersonFilter(sp, selfPersonId)

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
  const level = directoryLevel(access.can)
  const { people, teams, profiles, selfId } = await loadMyTeam(supabase, user, level)

  // The Teams tab is what level 2 adds; below that the tab does not exist,
  // rather than existing and being empty.
  return (
    <TeamPeople
      people={people}
      teams={teams}
      showTeams={level >= 2}
      profiles={profiles}
      selfId={selfId}
      alone={people.length <= 1}
    />
  )
}
