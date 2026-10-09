// What one Report request may show: its tab, its scope, and whose work.
//
// The page, the printable page, the PDF and the CSV all answer the same URL,
// and each used to resolve it on its own. A rule written four times is a rule
// that is wrong in one of them, so it is resolved here once, and the pure
// parts (scope.ts, ReportTabs) stay testable on their own.

import type { Db } from '@/lib/supabase/types'
import { previewHref } from '@/lib/auth/view-as-server'
import { redirect } from 'next/navigation'
import type { DirectoryLevel } from '@/lib/access/surfaces'
import { resolveTab, tabRights, type ReportTabKey, type TabRights } from './tabs'
import { reportFilter, resolvePeriod, resolveScope, scopesFor, viewLabel, type Period, type Scope } from './scope'
import { reportDb } from './data'
import type { PeopleFilter } from '@/lib/monday/worklist/data'
import { loadMemberships } from '@/lib/monday/worklist/team-priority-data'
import { leads } from '@/lib/monday/worklist/team-priority'

type Client = Db

export interface ReportView {
  level: DirectoryLevel
  rights: TabRights
  tab: ReportTabKey
  scope: Scope
  scopes: Scope[]
  period: Period
  /** Whose work every loader reads. */
  filter: PeopleFilter
  /** The team and person filters as applied, which may be less than was asked. */
  team: string | null
  person: string | null
  /**
   * What the page is showing, in words: the person or team picked, or the
   * scope. The screen, the printout, the PDF and the file name all say it, so
   * a filter carried over from the Workload tab is never shown as My team.
   */
  label: string
  /**
   * The teams the Workload filters may offer: null for every team (Everyone),
   * the ones they lead (My team), and none when the scope is only themselves.
   */
  teamChoices: readonly string[] | null
}

export async function resolveReportView(
  supabase: Client,
  can: (surfaceKey: string) => boolean,
  meId: string | null,
  asked: { tab?: string | null; scope?: string | null; period?: string | null; team?: string | null; person?: string | null },
): Promise<ReportView> {
  // Everyone, with the Report action "See everyone"; otherwise themselves and,
  // for a Lead, the teams they lead (access catalogue, 7 October 2026).
  const level: DirectoryLevel = can('rp-everyone') ? 3 : 2
  const rights = tabRights(can)

  // Leading a team is the Lead position, the same rule team priority and the
  // org chart use. My team is the teams they lead at every level.
  const led = level >= 2 && meId
    ? (await loadMemberships(supabase, meId)).filter(leads).map(m => m.teamId)
    : []
  let ledMembers = new Set<string>()
  if (led.length) {
    const { data, error } = await supabase.from('team_members').select('person_id').in('team_id', led)
    if (error) throw new Error(`The Report could not read your teams: ${error.message}`)
    ledMembers = new Set(((data ?? []) as { person_id: string }[]).map(m => m.person_id))
  }

  // Every tab is an item of its own. The page, the print page and the files all
  // come through here, so a tab that is off is off for all four; with none open
  // there is nothing to show.
  const tab = resolveTab(asked.tab ?? undefined, rights)
  if (!tab) redirect(await previewHref('/'))

  const leadsATeam = led.length > 0
  const scope = resolveScope(asked.scope ?? undefined, level, leadsATeam)
  const { filter, team, person } = reportFilter({
    scope, level, meId, team: asked.team, person: asked.person, led, ledMembers,
  })

  // Names for the filters already decided above: reading them cannot widen
  // anything, and a name the session cannot read would turn into an id.
  const names = async (table: 'teams' | 'people', id: string | null, col: 'name' | 'full_name') => {
    if (!id) return null
    const { data } = await reportDb().from(table).select(col).eq('id', id).maybeSingle()
    return ((data ?? null) as Record<string, string> | null)?.[col] ?? null
  }
  const [teamName, personName] = await Promise.all([names('teams', team, 'name'), names('people', person, 'full_name')])

  return {
    level,
    label: viewLabel(scope, teamName, personName),
    rights,
    tab,
    scope,
    scopes: scopesFor(level, leadsATeam),
    period: resolvePeriod(asked.period ?? undefined),
    filter,
    team,
    person,
    teamChoices: scope === 'everyone' ? null : scope === 'team' ? led : [],
  }
}
