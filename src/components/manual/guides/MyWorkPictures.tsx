'use client'

// The My Work, Report and My Team guides' pictures: the real screens, fed the
// manual's made-up data (lib/manual/samples/my-work.ts and report.ts). Nothing
// saves and nothing opens; the picture around them (GuideParts) makes them
// inert anyway.

import { WorkList } from '@/components/monday/WorkList'
import { WorkViewSwitch } from '@/components/monday/WorkViewSwitch'
import { TeamPriorityEditor } from '@/components/monday/TeamPriorityEditor'
import { TeamPeople } from '@/components/team/TeamPeople'
import { ReportNav } from '@/components/report/ReportFrame'
import { ReportTabs } from '@/components/report/ReportTabs'
import { ReportControls } from '@/components/report/ReportControls'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportPeople, type DetailResult } from '@/components/report/ReportPeople'
import { ReportWorkload } from '@/components/report/ReportWorkload'
import { WorkloadFilters } from '@/components/report/WorkloadFilters'
import { ReportWaits } from '@/components/report/ReportWaits'
import { ReportMethod } from '@/components/report/ReportMethod'
import { myTeamSample, myWorkOrderedSample, myWorkSample, teamPrioritySample, WORK_TODAY } from '@/lib/manual/samples/my-work'
import {
  boardWaitsSample, overviewSample, peopleSample, REPORT_NOTE, REPORT_RIGHTS, REPORT_SCOPES, REPORT_STATE,
  sourcesSample, stepWaitsSample, stuckSample, workloadPeople, workloadSample, workloadTeams,
} from '@/lib/manual/samples/report'
import type { ReportTabKey } from '@/lib/report/tabs'

/** The three views of the module, as the switch at the top right shows them. */
export function WorkViewSwitchPicture({ active }: { active: 'work' | 'report' | 'team' }) {
  return <div className="flex justify-end"><WorkViewSwitch active={active} /></div>
}

/** Alex's own list. `ordered` follows the Writers team's priority order. */
export function MyWorkPicture({ ordered = false, completed = false }: { ordered?: boolean; completed?: boolean }) {
  const { data, teamOrder } = ordered ? myWorkOrderedSample() : { data: myWorkSample(), teamOrder: null }
  return (
    <WorkList
      data={data}
      people={[]}
      teams={[]}
      selfPersonId="alex"
      canSeeEveryone
      teamOrder={teamOrder}
      today={WORK_TODAY}
      stickyTop={0}
      preview={completed ? { openCompleted: true } : undefined}
    />
  )
}

/** The Team priority editor, as the Writers' lead sees it. */
export function TeamPriorityPicture() {
  const { steps, saved } = teamPrioritySample()
  return (
    <TeamPriorityEditor
      team={{ id: 'writers', name: 'Writers' }}
      teams={[{ value: 'writers', label: 'Writers' }]}
      steps={steps}
      saved={saved}
      savedAt="2026-11-09T15:30:00Z"
      savedBy="Chris Taylor"
      savedBySelf
      preview
      stickyTop={0}
      today={WORK_TODAY}
    />
  )
}

/** My Team as the Writers' lead sees it, on People or on Teams. */
export function MyTeamPicture({ tab = 'people' }: { tab?: 'people' | 'teams' }) {
  const { people, teams, selfId } = myTeamSample()
  return <TeamPeople people={people} teams={teams} selfId={selfId} showTeams startOn={tab} />
}

/** The Report's tabs and controls, with one tab chosen. */
export function ReportBarPicture({ tab = 'overview' }: { tab?: ReportTabKey }) {
  const state = { ...REPORT_STATE, tab }
  return (
    <ReportNav>
      <ReportTabs active={tab} rights={REPORT_RIGHTS} state={state} />
      <ReportControls state={state} scopes={REPORT_SCOPES} note={REPORT_NOTE} label={null} canExport />
    </ReportNav>
  )
}

const noDetail = () => new Promise<DetailResult>(() => {})

/** One tab of the Report, under its tabs and controls. */
export function ReportPicture({ tab }: { tab: ReportTabKey }) {
  return (
    <div>
      <ReportBarPicture tab={tab} />
      <div className="space-y-4">
        {tab === 'overview' && <ReportOverview data={overviewSample} />}
        {tab === 'people' && <ReportPeople people={peopleSample} periodDays={90} loadDetail={noDetail} />}
        {tab === 'workload' && (
          <div className="space-y-4">
            <ReportNav>
              <WorkloadFilters teams={workloadTeams} people={workloadPeople} note={`${workloadSample.length} people in scope`} />
            </ReportNav>
            <ReportWorkload people={workloadSample} />
          </div>
        )}
        {tab === 'waits' && <ReportWaits steps={stepWaitsSample} boards={boardWaitsSample} stuck={stuckSample} />}
        {tab === 'method' && <ReportMethod sources={sourcesSample} todo={[]} yours="everyone" />}
      </div>
    </div>
  )
}
