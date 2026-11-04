'use client'

// The Client Reports guides' pictures: the real i7 report and Project Hours &
// Others components, fed the manual's made-up data (lib/manual/samples/
// client-reports.ts). Nothing saves, nothing navigates; the picture around
// them (GuideParts) makes them inert anyway.

import { I7Report } from '@/components/tsheets/I7Report'
import { ManualHours } from '@/components/tsheets/ManualHours'
import { ClientFullHistory } from '@/components/tsheets/ClientFullHistory'
import { NoteCard } from '@/components/tsheets/I7ReportParts'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { ProjectPeriodFilter } from '@/components/tsheets/ProjectPeriodFilter'
import { MoneyInDialog } from '@/components/tsheets/MoneyInDialog'
import { ManualHoursDialog } from '@/components/tsheets/ManualHoursDialog'
import { ProjectExportMenu } from '@/components/tsheets/ProjectExportMenu'
import { ProjectFullHistory } from '@/components/tsheets/ProjectFullHistory'
import { TRACKED_PROJECTS } from '@/lib/timeclock/projects'
import { FIELD_LABEL } from '@/lib/ui/type'
import {
  MANUAL_BLURB, SAMPLE_MONTH, SAMPLE_MONTHS, i7BudgetHours, i7Carryover, i7Sample, i7StdRate, i7Trend,
  manualOptions, manualRows, moneyInSample, projectHistorySample, projectHoursSample, projectTeams, sampleNote, sampleTeams,
} from '@/lib/manual/samples/client-reports'

const RANGE = { from: SAMPLE_MONTH, to: SAMPLE_MONTH }

/** The i7 report as an Admin with every action sees it, on In Numbers or In Graphics. */
export function I7ReportPicture({ view = 'numbers' }: { view?: 'numbers' | 'graphics' }) {
  return (
    <I7Report
      data={i7Sample}
      range={RANGE}
      availableMonths={SAMPLE_MONTHS}
      projectHours={i7BudgetHours}
      carryover={i7Carryover}
      stdRate={i7StdRate}
      manual={{ rows: manualRows, options: manualOptions, blurb: MANUAL_BLURB }}
      canExport
      canTeamUpdate
      teams={sampleTeams}
      initialView={view}
    />
  )
}

/** What Add hours opens: the form and the month's hours already added by hand. */
export function ManualHoursPicture() {
  return <ManualHours rows={manualRows} options={manualOptions} month={SAMPLE_MONTH} blurb={MANUAL_BLURB} />
}

export function I7HistoryPicture() {
  return <ClientFullHistory trend={i7Trend} currentMonth={SAMPLE_MONTH} canExport />
}

export function MonthNotePicture() {
  return <NoteCard month={SAMPLE_MONTH} note={sampleNote} canEdit />
}

/** Project Hours & Others on Costs, or on People with the Writers team chosen. */
export function ProjectHoursPicture({ people = false }: { people?: boolean }) {
  return <ProjectHoursReport data={projectHoursSample} teams={projectTeams} selectedTeam={people ? 'writers' : ''} />
}

/** The row above the report: the period and the four buttons, as an Admin sees them. */
export function ProjectToolbarPicture() {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <span className={FIELD_LABEL}>Period</span>
      <ProjectPeriodFilter range={RANGE} availableMonths={SAMPLE_MONTHS} />
      <div className="ml-auto flex items-center gap-2.5 flex-wrap">
        <MoneyInDialog data={moneyInSample} projects={TRACKED_PROJECTS} />
        <ManualHoursDialog rows={manualRows} options={manualOptions} month={SAMPLE_MONTH} blurb={MANUAL_BLURB} tone="secondary" />
        <ProjectExportMenu range={RANGE} monthly />
      </div>
    </div>
  )
}

export function ProjectHistoryPicture() {
  return <ProjectFullHistory blocks={projectHistorySample} year="2026" />
}
