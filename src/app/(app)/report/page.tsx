// Report: what got delivered, how long it sat with each person, what came late.
//
// Third view of the same module as My Work and My Team, and it sits between
// them in the switch because it is about both: My Work is one person's list
// now, My Team is who they are, and this is what actually happened.
//
// Reachable by anyone who can reach My Work. What differs by level is scope,
// not entry: level 1 sees themselves, level 2 their team, level 3 everybody
// plus the Workload tab.

import Link from 'next/link'
import { requireSurface, loadAccess } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { WorkViewSwitch } from '@/components/monday/WorkViewSwitch'
import { ReportTabs, resolveTab, type ReportTabKey } from '@/components/report/ReportTabs'
import { ReportNav, DimWhilePending } from '@/components/report/ReportFrame'
import { ChangeLogNotice } from '@/components/report/ReportNotices'
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
import { activePeople, primaryTeams } from '@/lib/report/directory'
import { ReportControls } from '@/components/report/ReportControls'
import { resolvePeriod, resolveScope, type ReportState } from '@/lib/report/scope'
import { loadReportOverview, readRecording, type Recording } from '@/lib/report/data'

export const metadata = { title: 'Report' }
export const dynamic = 'force-dynamic'

/** Tabs with something behind them. The rest arrive as they are built. */
const READY: readonly ReportTabKey[] = ['overview', 'people', 'workload', 'waits', 'method']

export default async function ReportPage(
  { searchParams }: {
    searchParams: Promise<{ tab?: string; scope?: string; period?: string; team?: string }>
  },
) {
  await requireSurface('my-work')

  const sp = await searchParams
  const access = await loadAccess()
  const level = directoryLevel(access.can)

  // Clamped against the level, never taken as given: the query string is
  // typed by people, and a level 1 person editing ?scope=everyone lands on
  // their own work rather than on an error or on everyone.
  const scope = resolveScope(sp.scope, level)
  const period = resolvePeriod(sp.period)
  // Screen 6.6: a tab this level may not see resolves to Overview rather than
  // throwing, so an admin's shared link degrades quietly.
  const tab = resolveTab(sp.tab, level)
  const state: ReportState = { tab, scope, period, team: sp.team }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, auth?.user ?? null)

  // Me means this person; My team means the team filter if one is set and
  // otherwise everyone they may see. resolveScope has already refused any
  // scope this level is not entitled to.
  const filters = scope === 'me'
    ? { personId: me?.id ?? null }
    : { teamId: sp.team || null }
  // Only the recording state is needed by every tab: the notice above the
  // content and the note beside the controls. The Overview's own load reads
  // the whole worklist and a year of events, so it waits until it is the tab
  // actually being shown.
  const recording = await readRecording(supabase)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[13px]">
        <Link href="/" className="font-semibold text-muted hover:text-tn-ink transition-colors">Dashboard</Link>
        <span className="text-[var(--faint)]">/</span>
        <span className="font-semibold text-tn-ink">My Work / Report / My Team</span>
      </div>

      <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[var(--panel-border)]">
        <div>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">
            Report
          </h2>
          <p className="text-[14.5px] text-muted mt-1.5 m-0">
            What got delivered, how long it sat with each person, and what came in late.
          </p>
        </div>
        <WorkViewSwitch active="report" />
      </div>

      <ReportNav>
        <ReportTabs active={tab} level={level} ready={READY} state={state} />
        <ReportControls
          state={state}
          level={level}
          note={methodNote(recording)}
          canExport={access.can('report-export')}
        />
        <DimWhilePending>
          <div className="space-y-4">
            <ChangeLogNotice recording={recording} />
            <Tab tab={tab} supabase={supabase} filters={filters} period={period} recording={recording} level={level} />
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
  tab, supabase, filters, period, recording, level,
}: {
  tab: ReportTabKey
  level: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  filters: { personId?: string | null; teamId?: string | null }
  period: 30 | 90
  recording: Recording
}) {
  if (tab === 'people') {
    const people = await loadReportPeople(supabase, { ...filters, period })
    return <ReportPeople people={people} periodDays={period} />
  }

  if (tab === 'waits') {
    const { steps, boards, stuck } = await loadWaits(supabase, { ...filters, period })
    return <ReportWaits steps={steps} boards={boards} stuck={stuck} />
  }

  if (tab === 'workload') {
    const [{ people, effort, estimateReady }, teams, everyone] = await Promise.all([
      loadWorkload(supabase, { ...filters, period }),
      supabase.from('teams').select('id, name').order('name'),
      activePeople(supabase, {}),
    ])
    const teamOf = await primaryTeams(supabase, everyone.map(p => p.id))
    const teamIds = new Map(
      ((teams.data ?? []) as { id: string; name: string }[]).map(t => [t.name, t.id]),
    )

    return (
      <div className="space-y-4">
        <WorkloadFilters
          teams={(teams.data ?? []) as { id: string; name: string }[]}
          people={everyone.map(p => ({
            id: p.id,
            name: p.full_name,
            teamIds: [teamIds.get(teamOf.get(p.id) ?? '')].filter((x): x is string => Boolean(x)),
          }))}
          note={`${people.length} ${people.length === 1 ? 'person' : 'people'} in scope`}
        />
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
    const { sources, todo } = await loadMethod(supabase, recording)
    return <ReportMethod sources={sources} todo={todo} yourLevel={level} />
  }

  const { overview } = await loadReportOverview(supabase, { ...filters, period })
  return <ReportOverview data={overview} />
}

/**
 * Why the Load column is empty.
 *
 * Hours per step is total logged hours over steps delivered, and the log has
 * delivered nothing yet. Saying so beats a Load column of zeros, which would
 * read as a team with nothing to do.
 */
function NoEstimateYet() {
  return (
    <div className="rounded-[10px] border border-[rgba(224,148,14,.5)] bg-[var(--warn-bg)] px-4 py-3.5">
      <p className="text-[13.5px] text-[var(--warn-fg)] m-0 leading-[1.6]">
        Load cannot be estimated yet. Hours per step is the logged hours divided by the steps
        the change log has seen delivered, and it has seen none so far. Utilisation and Backlog
        do not depend on it.
      </p>
    </div>
  )
}

/** The real change-log start date, never a constant. */
function methodNote(recording: Recording): string {
  if (recording.state !== 'on') return 'change log not running yet'
  const since = new Date(recording.startedAt)
    .toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  return `change log since ${since}`
}

