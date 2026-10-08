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
import { myTeamLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadMyTeam } from '@/lib/directory/my-team'
import { loadLedMemberIds } from '@/lib/directory/person-page-data'
import { pageHrefs } from '@/lib/directory/page-rights'
import { TeamPeople } from '@/components/team/TeamPeople'
import { WorkList } from '@/components/monday/WorkList'
import { TeamPriorityEditor } from '@/components/monday/TeamPriorityEditor'
import { WorkViewSwitch, VIEW_SURFACE, type WorkView } from '@/components/monday/WorkViewSwitch'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { allowedTo } from '@/lib/access/resolve'
import { resolvePersonFilter } from '@/lib/monday/worklist/filters'
import {
  canSetOrder, editorTeamFor, hasLevels, orderTeamFor, priorityRights, settableTeams, stepKey, type Membership, type TeamOrderView,
} from '@/lib/monday/worklist/team-priority'
import {
  loadMemberships, loadOrderSummaries, loadPriorityGrant, loadSavedOrder, rankTeam, withTeamRanks, type OrderSummary,
} from '@/lib/monday/worklist/team-priority-data'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'

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
  { searchParams }: { searchParams: Promise<{ tab?: string; person?: string; team?: string; done?: string; view?: string; pteam?: string }> },
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
 * The work list, or the team priority editor.
 *
 * Defaults to the signed-in person, because "my work" is the question. Left
 * unfiltered it is everybody's, which is what a team leader wants and what
 * the person filter is there to narrow.
 *
 * A person's list follows their team's priority order (their primary team, or
 * another of theirs picked on the page), and a team's list follows that team's.
 * The unfiltered list follows none: it is everybody's, and no one team decides
 * its order. ?view=priority opens the editor, for team leaders and admins only.
 */
async function WorkTab({ sp }: { sp: { person?: string; team?: string; done?: string; view?: string; pteam?: string } }) {
  const supabase = await createClient()

  // The portal already knows how to answer "who is signed in", and this had
  // written a weaker version of it: profile_id only. A person whose row was
  // never linked to their login came out as nobody, so the My tasks tab asked
  // to filter by nobody, which is the same as everybody, and clicking it did
  // nothing at all. getCurrentPerson falls back to matching the email.
  const me = await getCurrentPerson()
  const selfPersonId = me?.id ?? null

  const [admin, access, myTeams, myGrant, { data: teamRows }] = await Promise.all([
    allowedTo('monday-accounts'),
    loadAccess(),
    selfPersonId ? loadMemberships(supabase, selfPersonId) : Promise.resolve([] as Membership[]),
    selfPersonId ? loadPriorityGrant(supabase, selfPersonId) : Promise.resolve(null),
    supabase.from('teams').select('id, name').order('name'),
  ])
  const teams = (teamRows ?? []) as { id: string; name: string }[]
  const teamName = (id: string) => teams.find(t => t.id === id)?.name ?? 'team'

  // "See everyone's list" (mw-everyone). Without it the list is their own,
  // whatever ?person or ?team the address carries, and someone whose login is
  // not linked to a person sees nothing rather than everybody's.
  const everyone = access.can('mw-everyone')
  const personId = everyone ? resolvePersonFilter(sp, selfPersonId) : selfPersonId
  const teamFilter = everyone ? (sp.team || null) : null
  // Who may set which team's order: the same rule the save action and Admin →
  // Access levels use. Rendered from the level and person on screen, which are
  // the previewed ones under View Stage; saving checks the person really signed
  // in (my-work/actions.ts).
  const rights = priorityRights({ isAdmin: access.isSuperAdmin, can: access.can, grant: myGrant })
  const settable = settableTeams(teams, myTeams, rights)

  if (sp.view === 'priority' && settable.length) {
    const teamId = editorTeamFor(settable, myTeams, sp.pteam)
    if (teamId) {
      const [teamWork, order] = await Promise.all([
        loadWorklist(supabase, { teamId, openOnly: true }),
        loadSavedOrder(supabase, teamId),
      ])
      // Until migration 084 is run there is nowhere to save to, so the editor
      // does not open and the list below is shown instead.
      if (order.available) {
        const { open } = rankTeam(teamWork.rows, null)
        return (
          <TeamPriorityEditor
            key={teamId}
            team={{ id: teamId, name: teamName(teamId) }}
            teams={settable.map(t => ({ value: t.id, label: t.name }))}
            steps={open.map(r => ({
              key: stepKey(r),
              itemName: r.itemName,
              language: r.language,
              parentItemName: r.parentItemName,
              boardName: r.boardName,
              boardId: r.boardId,
              workspaceName: r.workspaceName,
              stepName: r.stepName,
              who: r.who,
              priority: r.priority,
              dueDate: r.dueDate,
              dueSuspect: r.dueSuspect,
              url: r.url,
            }))}
            saved={order.saved}
            savedAt={order.updatedAt}
            savedBy={order.updatedByName}
            savedBySelf={!!selfPersonId && order.updatedById === selfPersonId}
            levelsAvailable={order.levelsAvailable}
          />
        )
      }
    }
  }

  // Whose order the list follows: one of a person's teams, or the team chosen.
  let orderChoices: Membership[] = []
  if (personId) orderChoices = personId === selfPersonId ? myTeams : await loadMemberships(supabase, personId)
  const candidates = personId ? orderChoices.map(m => m.teamId) : teamFilter ? [teamFilter] : []

  // The list itself starts reading now; everything below only decides its order.
  // Handled here so a failure while the order is still being worked out is not
  // an unhandled rejection; awaited below, it still throws.
  const dataRead = loadWorklist(supabase, personId || everyone
    ? { personId, teamId: teamFilter, includeDone: sp.done === '1' }
    : { personIds: [], includeDone: sp.done === '1' })
  dataRead.catch(() => {})

  // Which of those teams have an order, in one small query. A person follows
  // their main team's order, or another of theirs when the main one has none
  // (orderTeamFor), so this has to be known before the team is chosen. With no
  // team to follow, only whether the table exists is asked, and only of someone
  // who could open the editor.
  const summaries = candidates.length
    ? await loadOrderSummaries(supabase, candidates)
    : settable.length
      ? await loadOrderSummaries(supabase, [])
      : { available: false, byTeam: new Map<string, OrderSummary>() }
  // Placed steps, or a workspace or board order: anything that makes the list
  // differ from True North's.
  const hasOrder = (id: string) => summaries.byTeam.get(id)?.ordered ?? false
  const orderTeamId = personId ? orderTeamFor(orderChoices, sp.pteam, hasOrder) : teamFilter
  const canEdit = !!orderTeamId && canSetOrder(orderTeamId, myTeams, rights)

  // Nothing to say and nothing to rank for someone on one team that has no
  // order, which they cannot set: their list is in the default order, exactly
  // as it was, at no extra cost. Anyone on several teams always gets the line
  // above the list, so they can see every team they are on and switch.
  const needed = !!orderTeamId && summaries.available && (canEdit || hasOrder(orderTeamId) || orderChoices.length > 1)
  // A person's place in their team's order is counted against the whole team,
  // so ranking their list means reading the team's open steps too. A team's own
  // list already holds them.
  const [data, { data: peopleRows }, order, teamWork] = await Promise.all([
    dataRead,
    everyone ? supabase.from('people').select('id, full_name').eq('status', 'active').order('full_name') : Promise.resolve({ data: [] }),
    needed && orderTeamId ? loadSavedOrder(supabase, orderTeamId) : Promise.resolve(null),
    needed && orderTeamId && personId ? loadWorklist(supabase, { teamId: orderTeamId, openOnly: true }) : Promise.resolve(null),
  ])

  let rows = data.rows
  let teamOrder: TeamOrderView | null = null
  if (orderTeamId && order?.available) {
    const { ranking, trueNorth } = rankTeam(teamWork ? teamWork.rows : data.rows, order.saved)
    rows = withTeamRanks(data.rows, ranking, trueNorth)
    teamOrder = {
      teamId: orderTeamId,
      teamName: teamName(orderTeamId),
      placed: ranking.pinned.size,
      levels: hasLevels(order.saved?.levels),
      updatedAt: order.updatedAt,
      updatedBy: order.updatedByName,
      updatedBySelf: !!selfPersonId && order.updatedById === selfPersonId,
      canEdit,
      choices: orderChoices
        .map(m => ({ id: m.teamId, name: m.teamName }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }
  const available = summaries.available

  return (
    <WorkList
      data={rows === data.rows ? data : { ...data, rows }}
      selfPersonId={selfPersonId}
      isAdmin={admin}
      people={((peopleRows ?? []) as { id: string; full_name: string }[]).map(p => ({ value: p.id, label: p.full_name }))}
      teams={everyone ? teams.map(t => ({ value: t.id, label: t.name })) : []}
      canSeeEveryone={everyone}
      teamOrder={teamOrder}
      canSetPriority={available && settable.length > 0}
    />
  )
}

async function MyTeamTab() {
  const supabase = await createClient()
  const user = await getSessionUser()
  // A name opens that person's page when the viewer may open it, by the same
  // rule as the page itself (lib/directory/page-rights.ts).
  const access = await loadAccess()
  const level = myTeamLevel(access.can)
  const led = await loadLedMemberIds(createAdminClient(), access.personId)
  const { people, teams, selfId } = await loadMyTeam(supabase, user, { level, hrefFor: pageHrefs(access.can, access.personId, led) })

  // The Teams tab is what level 2 adds; below that the tab does not exist,
  // rather than existing and being empty.
  return (
    <TeamPeople
      people={people}
      teams={teams}
      showTeams={level >= 2}
      selfId={selfId}
      alone={people.length <= 1}
    />
  )
}
