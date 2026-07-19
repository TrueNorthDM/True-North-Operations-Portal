'use client'

/**
 * ProjectRows: the "In Numbers" pivot rows for one project (Project → Job code
 * → Activity), with one HOURS cell per person column. Split out of I7Report
 * (audit M5-2). Stateless: expand state + toggles come from the parent via props.
 */

import { Fragment } from 'react'
import { money, moneySigned, fmtHours } from '@/lib/tsheets/format'
import type { I7Report, PersonHours } from '@/lib/tsheets/types'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

// One HOURS cell per person column, for a given node's name→hours map.
function PersonCells({ people, byPerson, muted }: { people: string[]; byPerson: PersonHours; muted?: boolean }) {
  return (
    <>
      {people.map(name => {
        const h = byPerson[name] ?? 0
        return (
          <td key={name} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${muted ? 'text-muted text-[13px]' : 'text-foreground'}`}>
            {h ? fmtHours(h) : <span className="text-slate-300">-</span>}
          </td>
        )
      })}
    </>
  )
}

export function ProjectRows({ project, people, pOpen, openCodes, showCost, showBudget, showBudgetAvail, stdRate, budgetHours, onToggleProject, onToggleCode }: {
  project: I7Report['projects'][number]
  people: string[]
  pOpen: boolean
  openCodes: Set<string>
  showCost: boolean
  showBudget: boolean
  showBudgetAvail: boolean
  stdRate: number
  budgetHours: number | null
  onToggleProject: () => void
  onToggleCode: (code: string) => void
}) {
  const avail = budgetHours != null ? budgetHours - project.hours : null
  const dollarAvail = avail != null && showBudgetAvail ? avail * stdRate : null
  // Empty cells to keep alignment on job-code / activity rows, one per
  // project-only column (Budget hrs, Hrs avail., and optionally Budget avail.).
  const emptyCount = (showBudget ? 2 : 0) + (showBudgetAvail ? 1 : 0)
  const emptyBudget = emptyCount > 0 ? Array.from({ length: emptyCount }, (_, i) => <td key={i} className="bg-[rgba(30,125,127,0.06)]" />) : null
  const tealCell = 'bg-[rgba(30,125,127,0.06)]'
  const goldCell = 'bg-[rgba(224,138,30,0.07)] border-l border-[rgba(224,138,30,0.18)]'
  const budgetUsedCell = 'bg-[rgba(30,125,127,0.06)] border-r border-[rgba(1,35,88,0.1)]'

  return (
    <>
      {/* Level 1, Project (budget columns live here) */}
      <tr className="border-b border-slate-100 hover:bg-subtle/60 cursor-pointer" onClick={onToggleProject}>
        <td className="px-4 py-3 sticky left-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Chevron open={pOpen} />
            <span className="font-(family-name:--font-display) font-bold text-tn-ink whitespace-nowrap">{project.project}</span>
            <span className="text-xs text-muted whitespace-nowrap">{project.jobcodes.length} job code{project.jobcodes.length !== 1 ? 's' : ''}</span>
          </div>
        </td>
        {showBudget && <td className={`px-3 py-3 text-right text-foreground tabular-nums ${tealCell}`}>{budgetHours != null ? budgetHours.toLocaleString() : <span className="text-slate-300">-</span>}</td>}
        {showBudget && <td className={`px-3 py-3 text-right font-semibold tabular-nums ${tealCell} ${avail != null && avail < 0 ? 'text-[#c2410c]' : 'text-foreground'}`}>{avail != null ? avail.toFixed(2) : <span className="text-slate-300">-</span>}</td>}
        {showBudgetAvail && <td className={`px-3 py-3 text-right font-semibold tabular-nums ${tealCell} ${dollarAvail != null && dollarAvail < 0 ? 'text-[#c2410c]' : 'text-tn-ink'}`}>{dollarAvail != null ? moneySigned(dollarAvail) : <span className="text-slate-300">-</span>}</td>}
        {showCost && <td className={`px-3 py-3 text-right font-(family-name:--font-display) font-bold text-tn-ink tabular-nums ${budgetUsedCell}`}>{project.cost > 0 ? money(project.cost) : <span className="text-slate-300">-</span>}</td>}
        <PersonCells people={people} byPerson={project.byPerson} />
        <td className={`px-3 py-3 text-right font-(family-name:--font-display) font-bold text-tn-ink tabular-nums ${goldCell}`}>{fmtHours(project.hours)}</td>
      </tr>

      {/* Level 2, Job codes */}
      {pOpen && project.jobcodes.map(jc => {
        const key = `${project.project}|${jc.code}`
        const hasActs = jc.activities.length > 0
        const cOpen = hasActs && openCodes.has(key)
        return (
          <Fragment key={jc.code}>
            <tr className={`border-b border-slate-100 bg-subtle/40 ${hasActs ? 'hover:bg-subtle/70 cursor-pointer' : ''}`} onClick={hasActs ? () => onToggleCode(jc.code) : undefined}>
              <td className="px-4 py-2.5 sticky left-0 bg-subtle z-10">
                <div className="flex items-center gap-2 pl-6">
                  {hasActs ? <Chevron open={cOpen} /> : <span className="w-3.5" />}
                  <span className="font-semibold text-tn-ink tabular-nums whitespace-nowrap">{jc.code}</span>
                </div>
              </td>
              {emptyBudget}
              {showCost && <td className={`px-3 py-2.5 text-right text-foreground tabular-nums ${budgetUsedCell}`}>{jc.cost > 0 ? money(jc.cost) : <span className="text-slate-300">-</span>}</td>}
              <PersonCells people={people} byPerson={jc.byPerson} />
              <td className={`px-3 py-2.5 text-right text-tn-ink tabular-nums ${goldCell}`}>{fmtHours(jc.hours)}</td>
            </tr>

            {/* Level 3, Activities (leaf rows) */}
            {cOpen && jc.activities.map((a, i) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="px-4 py-2 text-foreground sticky left-0 bg-white z-10">
                  <div className="flex items-center gap-2 pl-12">
                    <span className="w-3.5" />
                    <span className="whitespace-nowrap">{a.activity}</span>
                  </div>
                </td>
                {emptyBudget}
                {showCost && <td className={`px-3 py-2 text-right text-muted tabular-nums ${budgetUsedCell}`}>{a.cost > 0 ? money(a.cost) : <span className="text-slate-300">-</span>}</td>}
                <PersonCells people={people} byPerson={a.byPerson} muted />
                <td className={`px-3 py-2 text-right text-foreground tabular-nums ${goldCell}`}>{fmtHours(a.hours)}</td>
              </tr>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}
