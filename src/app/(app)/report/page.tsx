// Report: what got delivered, how long it sat with each person, what came late.
//
// Third view of the same module as My Work and My Team, and it sits between
// them in the switch because it is about both: My Work is one person's list
// now, My Team is who they are, and this is what actually happened.
//
// Who reaches it, and which of its tabs, is set on Admin, Access levels. What
// differs by directory level is whose work: level 1 sees themselves, level 2
// the teams they lead, level 3 everybody (lib/report/view.ts).

import { requireSurface, loadAccess } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { WorkViewSwitch, VIEW_SURFACE, type WorkView } from '@/components/monday/WorkViewSwitch'
import { ReportTabs, type ReportTabKey } from '@/components/report/ReportTabs'
import { ReportNav, DimWhilePending } from '@/components/report/ReportFrame'
import { ChangeLogNotice, NoEstimateYet } from '@/components/report/ReportNotices'
import { reportDate } from '@/lib/report/clock'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportPeople } from '@/components/report/ReportPeople'
import { ReportWaits } from '@/components/report/ReportWaits'
import { ReportMethod } from '@/components/report/ReportMethod'
import { loadReportPeople } from '@/lib/report/people'
import { loadWaits } from '@/lib/report/waits'
import { loadMethod } from '@/lib/report/method'
import { ReportWorkload } from '@/components/report/ReportWorkload'
import { EstimateAudit, NobodyInSelection } from '@/components/report/WorkloadHoldings'
import { WorkloadFilters } from '@/components/report/WorkloadFilters'
import { loadWorkload } from '@/lib/report/workload-data'
import { activePeople, teamsOf } from '@/lib/report/directory'
import { failed, reportDb } from '@/lib/report/data'
import { ReportControls } from '@/components/report/ReportControls'
import type { ReportState, Scope } from '@/lib/report/scope'
import { personDetail } from './actions'
import { resolveReportView } from '@/lib/report/view'
import type { PeopleFilter } from '@/lib/monday/worklist/data'
import { loadReportOverview, readRecording, type Recording } from '@/lib/report/data'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getCurrentPerson } from '@/lib/auth/session'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

/** Tabs with something behind them. The rest arrive as they are built. */
const READY: readonly ReportTabKey[] = ['overview', 'people', 'workload', 'waits', 'method']

export default async function ReportPage(
  { searchParams }: {
    searchParams: Promise<{ tab?: string; scope?: string; period?: string; team?: string; person?: string }>
  },
) {
  await requireSurface('report')

  const sp = await searchParams
  const access = await loadAccess()
  const supabase = await createClient()
  const me = await getCurrentPerson()

  // Clamped, never taken as given: the query string is typed by people. A
  // level 1 person editing ?scope=everyone lands on their own work, a team
  // leader naming a team they do not lead lands on their own teams, and a tab
  // they may not see resolves to Overview (screen 6.6) rather than throwing.
  const view = await resolveReportView(supabase, access.can, me?.id ?? null, sp)
  const { tab, scope, period, filter: filters } = view
  const state: ReportState = { tab, scope, period, team: view.team ?? undefined, person: view.person ?? undefined }
  // Only the recording state is needed by every tab: the notice above the
  // content and the note beside the controls. The Overview's own load reads
  // the whole worklist and a year of events, so it waits until it is the tab
  // actually being shown.
  const recording = await readRecording()

  return (
    <div className="space-y-6">
      <Breadcrumb now="Report" />

      <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[var(--panel-border)]">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">
            Report
          </h2>
          <p className="text-[14.5px] text-muted mt-1.5 m-0">
            What got delivered, how long it sat with each person, and what came in late.
          </p>
        </div>
        <WorkViewSwitch active="report" can={(v: WorkView) => access.can(VIEW_SURFACE[v])} />
      </div>

      <ReportNav>
        <ReportTabs active={tab} rights={view.rights} ready={READY} state={state} />
        <ReportControls
          state={state}
          scopes={view.scopes}
          note={methodNote(recording)}
          label={view.label}
          canExport={access.can('report-export')}
        />
        <DimWhilePending>
          <div className="space-y-4">
            <ChangeLogNotice recording={recording} />
            <Tab tab={tab} filters={filters} period={period} recording={recording} widest={view.scopes[view.scopes.length - 1]} teamChoices={view.teamChoices} />
          </div>
        </DimWhilePending>
      </ReportNav>
    </div>
  )
}

/**
 * One tab's body.
 *
 * Each loader is called only for the tab being shown. The Workload tab is not
 * here yet, and resolveTab has already sent anyone asking for it to Overview,
 * so there is no case to fall through.
 */
async function Tab({
  tab, filters, period, recording, widest, teamChoices,
}: {
  tab: ReportTabKey
  /** The widest scope the reader has, marked on the Method tab. */
  widest: Scope
  filters: PeopleFilter
  /** Teams the Workload filters may offer; null is every team. */
  teamChoices: readonly string[] | null
  period: 30 | 90
  recording: Recording
}) {
  if (tab === 'people') {
    const people = await loadReportPeople({ ...filters, period })
    return <ReportPeople people={people} periodDays={period} loadDetail={personDetail} />
  }

  if (tab === 'waits') {
    const { steps, boards, stuck } = await loadWaits({ ...filters, period })
    return <ReportWaits steps={steps} boards={boards} stuck={stuck} />
  }

  if (tab === 'workload') {
    // The filters offer only what this person may read: every team at level
    // 3, the teams they lead at level 2. A name in a dropdown is still a name.
    const [{ people, effort, estimateReady }, teams, everyone] = await Promise.all([
      loadWorkload({ ...filters, period }),
      reportDb().from('teams').select('id, name').order('name'),
      teamChoices === null ? activePeople({}) : activePeople({ teamIds: teamChoices }),
    ])
    failed('the teams', teams.error)
    const offered = ((teams.data ?? []) as { id: string; name: string }[])
      .filter(t => teamChoices === null || teamChoices.includes(t.id))
    // Every team a person is on, not only their main one: someone on a team
    // as their second team is still on it when that team is picked.
    const memberOf = await teamsOf(everyone.map(p => p.id))

    return (
      <div className="space-y-4">
        {teamChoices?.length === 0 ? null : <WorkloadFilters
          teams={offered}
          people={everyone.map(p => ({ id: p.id, name: p.full_name, teamIds: memberOf.get(p.id) ?? [] }))}
          note={`${people.length} ${people.length === 1 ? 'person' : 'people'} in scope`}
        />}
        {people.length === 0 ? <NobodyInSelection /> : <ReportWorkload people={people} />}
        {/* The audit is permanent on this tab, and its absence is itself the
            state worth showing: with nothing delivered yet there is no hours
            per step to estimate from, and Load has nothing to divide by. */}
        {estimateReady
          ? <EstimateAudit rows={effort} />
          : <NoEstimateYet />}
      </div>
    )
  }

  if (tab === 'method') {
    const { sources, todo } = await loadMethod(recording)
    return <ReportMethod sources={sources} todo={todo} yours={widest} />
  }

  const { overview } = await loadReportOverview({ ...filters, period })
  return <ReportOverview data={overview} />
}

/** The real change-log start date, never a constant. */
function methodNote(recording: Recording): string {
  if (recording.state !== 'on') return 'change log not running yet'
  return `change log since ${reportDate(recording.startedAt)}`
}

