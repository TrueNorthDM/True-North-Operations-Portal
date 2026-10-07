// What one Report request may show: its tab, its scope, and whose work.
//
// The page, the printable page, the PDF and the CSV all answer the same URL,
// and each used to resolve it on its own. A rule written four times is a rule
// that is wrong in one of them, so it is resolved here once, and the pure
// parts (scope.ts, ReportTabs) stay testable on their own.

import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { DirectoryLevel } from '@/lib/access/surfaces'
import { resolveTab, tabRights, type ReportTabKey, type TabRights } from '@/components/report/ReportTabs'
import { reportFilter, resolvePeriod, resolveScope, scopesFor, type Period, type Scope } from './scope'
import type { PeopleFilter } from '@/lib/monday/worklist/data'
import { loadMemberships } from '@/lib/monday/worklist/team-priority-data'
import { leads } from '@/lib/monday/worklist/team-priority'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

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
   * The teams the Workload filters may offer: null for every team (level 3),
   * the ones they lead at level 2, and none when the scope is only themselves.
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
  // org chart use. Only level 2 needs it.
  const led = level === 2 && meId
    ? (await loadMemberships(supabase, meId)).filter(leads).map(m => m.teamId)
    : []
  let ledMembers = new Set<string>()
  if (led.length) {
    const { data } = await supabase.from('team_members').select('person_id').in('team_id', led)
    ledMembers = new Set(((data ?? []) as { person_id: string }[]).map(m => m.person_id))
  }

  // Every tab is an item of its own. The page, the print page and the files all
  // come through here, so a tab that is off is off for all four; with none open
  // there is nothing to show.
  const tab = resolveTab(asked.tab ?? undefined, rights)
  if (!tab) redirect('/')

  const leadsATeam = led.length > 0
  const scope = resolveScope(asked.scope ?? undefined, level, leadsATeam)
  const { filter, team, person } = reportFilter({
    scope, level, meId, team: asked.team, person: asked.person, led, ledMembers,
  })

  return {
    level,
    rights,
    tab,
    scope,
    scopes: scopesFor(level, leadsATeam),
    period: resolvePeriod(asked.period ?? undefined),
    filter,
    team,
    person,
    teamChoices: scope === 'me' ? [] : level >= 3 ? null : led,
  }
}
