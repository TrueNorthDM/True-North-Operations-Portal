'use client'

// i7 Budget Usage Report, an expandable table with 3 row levels (Project → Job
// code → Activity). People are COLUMNS, not rows: each person has an HOURS
// column, filled at every level. Hours/cost/budget roll up at each level. Data
// is computed server-side and passed in.

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { I7Charts } from './I7Charts'
import { ProjectRows } from './I7ProjectRows'
import { ExportMenu, ExportImageButton } from './I7ReportParts'
import { CarryoverPanel } from './I7CarryoverPanel'
import { money, moneySigned, fmtHours } from '@/lib/tsheets/format'
import type { I7Report, I7Carryover, PersonHours, I7TrendPoint } from '@/lib/tsheets/types'

interface Props {
  data: I7Report
  selectedMonth: string
  availableMonths: string[]
  preview?: boolean
  projectHours?: Record<string, number>   // project → budgeted hours (guide)
  carryover?: I7Carryover | null
  stdRate?: number                        // standard i7 rate for the month ($/h)
  trend?: I7TrendPoint[]                  // Jan → selected month, for the charts
  canExport?: boolean                     // privileged tiers see Export / Team Update (Part 4)
  /** Names with hours this month but no rate, so their cost lands as zero. */
  unratedPeople?: string[]
  /**
   * Restricted view, for a level without 'report-full'. Hides every budget and
   * money column and narrows the per-person columns to `visiblePeople`.
   *
   * What it deliberately does NOT touch: the totals. Hours used per row is the
   * project's own figure and the footer is data.totalHours, both computed from
   * every entry in the month. Someone seeing three columns still reads the real
   * 43.25, not the 12 they can add up, so a partial view never reads as a whole
   * one.
   */
  restricted?: boolean
  /** First names allowed in the per-person columns while restricted. */
  visiblePeople?: readonly string[]
  /**
   * Teams offered by the filter beside the pay period, straight from the
   * Directory's Teams tab, with the first names of their members.
   */
  teams?: readonly { id: string; name: string; members: readonly string[] }[]
  /** Selected team id, or '' for everyone. Lives in the URL, like the month. */
  selectedTeam?: string
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[m - 1]} ${y}`
}

export function I7Report({ data, selectedMonth, availableMonths, preview, projectHours = {}, carryover, stdRate = 0, trend = [], canExport = false, unratedPeople = [], restricted = false, visiblePeople, teams = [], selectedTeam = '' }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'numbers' | 'graphics'>('numbers')
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set())

  function toggle(set: Set<string>, key: string, setter: (s: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key); else next.add(key)
    setter(next)
  }

  function expandAll() {
    setOpenProjects(new Set(data.projects.map(p => p.project)))
    setOpenCodes(new Set(data.projects.flatMap(p => p.jobcodes.map(j => `${p.project}|${j.code}`))))
  }
  function collapseAll() {
    setOpenProjects(new Set())
    setOpenCodes(new Set())
  }

  // Two independent narrowings of the same list of columns, and both apply. The
  // permission is a floor the filter cannot lift: picking a team can only take
  // names away from what the viewer was already allowed to see, never add one.
  const teamPeople = teams.find(t => t.id === selectedTeam)?.members ?? null
  const people = data.people.filter(n =>
    (!restricted || !visiblePeople || visiblePeople.includes(n)) &&
    (!teamPeople || teamPeople.includes(n))
  )
  const showCost = data.hasRates && !restricted
  const showBudget = Object.keys(projectHours).length > 0 && !restricted
  const showBudgetAvail = showBudget && showCost && stdRate > 0   // $ available needs a rate
  const totalBudgetHours = Object.values(projectHours).reduce((s, h) => s + h, 0)
  const totalHrsAvail = totalBudgetHours - data.totalHours
  const projectOnlyCols = (showBudget ? 2 : 0) + (showBudgetAvail ? 1 : 0)
  const cols = 1 + people.length + 1 + projectOnlyCols + (showCost ? 1 : 0)

  // Per-person totals across the whole report (footer row).
  const totalByPerson: PersonHours = {}
  for (const p of data.projects) for (const [name, h] of Object.entries(p.byPerson)) totalByPerson[name] = (totalByPerson[name] ?? 0) + h

  // Both filters live in the URL together, so changing one keeps the other and
  // the address stays shareable. Empty team drops the param instead of sending
  // an empty one.
  function go(patch: { month?: string; team?: string }) {
    const month = patch.month ?? selectedMonth
    const team = patch.team ?? selectedTeam
    router.push(`/tools/time-report?month=${month}${team ? `&team=${encodeURIComponent(team)}` : ''}`)
  }

  const thNum = 'text-right text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-3 py-3 whitespace-nowrap'
  const selectCls = 'px-3 py-2 rounded-[9px] border border-slate-200 text-sm bg-white text-tn-ink font-(family-name:--font-display) font-bold focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20'

  return (
    <div className="space-y-6">
      {preview && (
        <div className="flex items-center gap-3 rounded-[12px] border border-[#f0d69a] bg-hfa-soft px-4 py-3 text-sm text-[#8a6d1a]">
          <span className="text-base">&#x26A0;&#xFE0F;</span>
          <span><strong className="font-(family-name:--font-display) font-extrabold">Sample data</strong>, structure preview only. Add your TSheets API token in{' '}
            <Link href="/settings" className="underline font-semibold hover:text-[#6d5612]">Settings</Link> to pull real hours.</span>
        </div>
      )}

      {/* Month and team selectors */}
      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="month-select" className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Pay period</label>
        <Select
          id="month-select"
          value={selectedMonth}
          onChange={v => go({ month: v })}
          options={availableMonths.map(ym => ({ value: ym, label: monthLabel(ym) }))}
          ariaLabel="Pay period"
          className={selectCls}
        />
        <span className="text-sm text-muted ml-1 tabular-nums">{data.startDate} → {data.endDate}</span>
        {teams.length > 0 && (
          <>
            <label htmlFor="team-select" className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted ml-2">Team</label>
            <Select
              id="team-select"
              value={selectedTeam}
              onChange={v => go({ team: v })}
              options={[{ value: '', label: 'All teams' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
              ariaLabel="Team"
              className={selectCls}
            />
          </>
        )}
        {canExport && (
          <div className="ml-auto flex items-center gap-2.5">
            <ExportImageButton month={selectedMonth} />
            <ExportMenu month={selectedMonth} />
          </div>
        )}
      </div>

      {/* The filter changes which columns are shown, never what the report says
          the month cost. Saying so on screen is cheaper than someone adding up
          three columns and reporting the difference as a discrepancy. */}
      {teamPeople && (
        <p className="text-sm text-muted m-0">
          Showing the hour columns for <span className="font-semibold text-tn-ink">{teams.find(t => t.id === selectedTeam)?.name}</span> only.
          Hours used, cost and budget stay the figures for everyone.
        </p>
      )}

      {/* View tabs, the same month's data as a table (In Numbers) or charts (In Graphics) */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['numbers', 'graphics'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2.5 text-[13.5px] font-(family-name:--font-display) font-bold border-b-2 -mb-px transition-colors ${view === v ? 'border-tn-teal text-tn-teal' : 'border-transparent text-muted hover:text-tn-ink'}`}
          >
            {v === 'numbers' ? 'In Numbers' : 'In Graphics'}
          </button>
        ))}
      </div>

      {view === 'graphics' ? (
        <I7Charts data={data} projectHours={projectHours} totalByPerson={totalByPerson} showCost={showCost} trend={trend} />
      ) : (
      <>
      {/* Carryover: bank-account running balance */}
      {carryover && <CarryoverPanel c={carryover} month={selectedMonth} />}

      {/*
        The month note card was here too. It is still printed on the client PDF
        as "Highlights"; what moved is only where it gets written, since the
        report page is for reading the month, not editing it.
      */}

      {/*
        Hours with no rate behind them. rateFor() returns 0 when no assignment
        covers a person for the month, so their hours are counted and their
        cost is not: the budget reads as less consumed than it really is. This
        is the only place that says so, because the totals themselves look
        perfectly ordinary (audit finding M3-1). Internal only, never printed
        on the client report.
      */}
      {unratedPeople.length > 0 && (
        <div className="rounded-[14px] border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-[#7a4e05]">
          <div className="font-semibold">
            {unratedPeople.length === 1 ? '1 person has hours but no rate' : `${unratedPeople.length} people have hours but no rate`}
          </div>
          <div className="mt-1 leading-relaxed">
            {unratedPeople.join(', ')}. Their hours are in the totals below and their cost is counted as $0,
            so the budget shows less used than it really is. Set a rate in{' '}
            <a href="/directory#rates" className="underline font-semibold">People, Teams and Permissions → Rates &amp; Costs</a>.
          </div>
        </div>
      )}

      {/*
        The summary chips (Total hours, Total cost, Projects, People) used to
        sit here. Every one of them is the table's own footer row restated a few
        centimetres above it, so they added a second place for the same number
        to be read from, and one more thing to keep in step.
      */}
      <div className="overflow-x-auto rounded-[14px] border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-subtle border-b border-slate-200">
              <th className="text-left text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 sticky left-0 bg-subtle z-10">Project · Job code · Activity</th>
              {showBudget && <th className={`${thNum} bg-[rgba(30,125,127,0.06)]`}>Budget hrs</th>}
              {showBudget && <th className={`${thNum} bg-[rgba(30,125,127,0.06)]`}>Hrs avail.</th>}
              {showBudgetAvail && <th className={`${thNum} bg-[rgba(30,125,127,0.06)]`}>Budget avail.</th>}
              {showCost && <th className={`${thNum} bg-[rgba(30,125,127,0.06)] border-r border-[rgba(1,35,88,0.1)]`}>Budget used</th>}
              {people.map(name => <th key={name} className={thNum}>{name}</th>)}
              <th className={`${thNum} bg-[rgba(224,138,30,0.07)] border-l border-[rgba(224,138,30,0.18)]`}>Hours used</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.length === 0 && (
              <tr><td colSpan={cols} className="px-4 py-6 text-center text-sm text-slate-400">No i7 hours logged in {monthLabel(selectedMonth)}.</td></tr>
            )}
            {data.projects.map(p => (
              <ProjectRows
                key={p.project}
                project={p}
                people={people}
                pOpen={openProjects.has(p.project)}
                openCodes={openCodes}
                showCost={showCost}
                showBudget={showBudget}
                showBudgetAvail={showBudgetAvail}
                stdRate={stdRate}
                budgetHours={projectHours[p.project] ?? null}
                onToggleProject={() => toggle(openProjects, p.project, setOpenProjects)}
                onToggleCode={(code) => toggle(openCodes, `${p.project}|${code}`, setOpenCodes)}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-subtle">
              <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-tn-ink sticky left-0 bg-subtle z-10">Total</td>
              {showBudget && <td className="px-3 py-3 text-right font-extrabold text-tn-ink tabular-nums bg-[rgba(30,125,127,0.06)]">{totalBudgetHours ? totalBudgetHours.toLocaleString() : '-'}</td>}
              {showBudget && <td className={`px-3 py-3 text-right font-extrabold tabular-nums bg-[rgba(30,125,127,0.06)] ${totalHrsAvail < 0 ? 'text-[#c2410c]' : 'text-tn-ink'}`}>{totalBudgetHours ? totalHrsAvail.toFixed(2) : '-'}</td>}
              {showBudgetAvail && <td className={`px-3 py-3 text-right font-extrabold tabular-nums bg-[rgba(30,125,127,0.06)] ${totalHrsAvail < 0 ? 'text-[#c2410c]' : 'text-[#1E9E6A]'}`}>{totalBudgetHours ? moneySigned(totalHrsAvail * stdRate) : '-'}</td>}
              {showCost && <td className="px-3 py-3 text-right font-extrabold text-tn-ink tabular-nums bg-[rgba(30,125,127,0.06)] border-r border-[rgba(1,35,88,0.1)]">{money(data.totalCost)}</td>}
              {people.map(name => (
                <td key={name} className="px-3 py-3 text-right font-extrabold text-tn-ink tabular-nums whitespace-nowrap">{totalByPerson[name] ? fmtHours(Math.round((totalByPerson[name]) * 100) / 100) : <span className="text-slate-300">-</span>}</td>
              ))}
              <td className="px-3 py-3 text-right font-extrabold text-tn-ink tabular-nums bg-[rgba(224,138,30,0.07)] border-l border-[rgba(224,138,30,0.18)]">{data.totalHours.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted leading-relaxed">
          Hours pulled from QuickBooks Time · grouped by the “1 - i7 Code” &amp; “3 Activity” fields · one hours column per person · Budget used = hours × each person&apos;s rate
          {showBudgetAvail && <> · Budget avail. = hours available × the i7 rate (${stdRate}/h)</>}
        </p>
        <div className="flex gap-2 text-xs font-(family-name:--font-display) font-bold">
          <button onClick={expandAll} className="text-tn-teal hover:underline underline-offset-2">Expand all</button>
          <span className="text-slate-300">·</span>
          <button onClick={collapseAll} className="text-tn-teal hover:underline underline-offset-2">Collapse all</button>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

