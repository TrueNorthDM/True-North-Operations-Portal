'use client'

/**
 * ClientsProjectsTab — a read-only directory of the client, its projects, and
 * the live job codes under each project (grouped from the TSheets "1 · i7 Code"
 * field by prefix). Each project also shows the people assigned to it (the
 * people.i7_projects roster) and the auto-calculated AVERAGE billing rate — the
 * same rate the Budget Usage Report uses to turn budgeted hours into dollars.
 *
 * Editing (adding clients / projects / codes) comes later; this first pass is
 * the canonical listing, seeded from what's already synced.
 */

import type { ProjectDirectory } from '@/lib/tsheets/report-data'

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function ClientsProjectsTab({ directory }: { directory: ProjectDirectory }) {
  const { clientName, rows, month, standardRate } = directory
  const totalCodes = rows.reduce((s, r) => s + r.jobCodes.length, 0)

  return (
    <div className="space-y-5">
      {/* client header card */}
      <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-subtle">
          <span className="shrink-0 inline-flex w-9 h-9 items-center justify-center rounded-[10px] bg-tn-teal text-white">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </span>
          <div className="min-w-0">
            <h3 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink truncate">{clientName}</h3>
            <p className="text-[12px] text-muted mt-0.5">{rows.length} projects · {totalCodes} job codes</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rows.map(row => (
            <div key={row.project} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{row.project}</div>
                  <div className="text-[11.5px] text-muted mt-0.5">{row.jobCodes.length} job code{row.jobCodes.length === 1 ? '' : 's'}</div>
                </div>
                {/* average rate badge */}
                <div className="shrink-0 text-right">
                  <div className="inline-flex items-baseline gap-1 rounded-[10px] bg-tn-teal-soft px-3 py-1.5">
                    <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-teal tabular-nums">{money(row.avgRate)}</span>
                    <span className="text-[10.5px] font-semibold text-tn-teal/80">/h</span>
                  </div>
                  <div className="text-[10px] text-muted mt-1 font-(family-name:--font-display) font-bold uppercase tracking-wide">
                    {row.usingFallback ? 'Standard rate' : 'Average rate'}
                  </div>
                </div>
              </div>

              {/* job codes */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.jobCodes.length > 0 ? row.jobCodes.map(code => (
                  <span key={code} className="inline-flex items-center rounded-[7px] border border-slate-200 bg-subtle px-2 py-1 text-[11px] font-(family-name:--font-display) font-bold text-foreground tabular-nums">
                    {code}
                  </span>
                )) : <span className="text-[11.5px] text-muted italic">No job codes logged yet</span>}
              </div>

              {/* assigned people */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Assigned</span>
                {row.assignedPeople.length > 0 ? row.assignedPeople.map(p => (
                  <span key={p.name} className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 pl-2 pr-2.5 py-0.5 text-[11.5px]">
                    <span className="font-semibold text-tn-ink">{p.name}</span>
                    <span className="tabular-nums text-muted">{p.rate > 0 ? money(p.rate) : '—'}</span>
                  </span>
                )) : (
                  <span className="text-[11.5px] text-muted italic">
                    No one assigned — using the standard rate. Assign people in <span className="font-semibold not-italic text-tn-teal">People &amp; rates</span>.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-muted leading-relaxed">
        Job codes are read live from QuickBooks Time (the “1 · i7 Code” field), grouped into projects by prefix. The
        <b className="text-foreground"> average rate</b> is the mean billing rate of the people assigned to each project — resolved for{' '}
        <b className="text-foreground">{month}</b> — and is what the Budget Usage Report multiplies by each project’s budgeted hours.
        Projects with no one assigned fall back to the standard rate ({money(standardRate)}/h).
      </p>
    </div>
  )
}
