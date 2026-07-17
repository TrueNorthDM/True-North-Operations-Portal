/**
 * ClientsProjectsTab — a read-only catalogue: the client, its projects, and the
 * live job codes under each (grouped from the TSheets "1 · i7 Code" field by
 * prefix). No rates or people here — rates live in People & rates, and the budget
 * report uses each person's own Rate/client × their TSheets hours.
 */

import type { ProjectDirectory } from '@/lib/tsheets/report-data'

export function ClientsProjectsTab({ directory }: { directory: ProjectDirectory }) {
  const { clientName, rows } = directory
  const totalCodes = rows.reduce((s, r) => s + r.jobCodes.length, 0)

  return (
    <div className="space-y-5">
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
              <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{row.project}</div>
              <div className="text-[11.5px] text-muted mt-0.5">{row.jobCodes.length} job code{row.jobCodes.length === 1 ? '' : 's'}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {row.jobCodes.length > 0 ? row.jobCodes.map(code => (
                  <span key={code} className="inline-flex items-center rounded-[7px] border border-slate-200 bg-subtle px-2 py-1 text-[11px] font-(family-name:--font-display) font-bold text-foreground tabular-nums">
                    {code}
                  </span>
                )) : <span className="text-[11.5px] text-muted italic">No job codes logged yet</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[12px] text-muted leading-relaxed">
        Job codes are read live from QuickBooks Time (the “1 · i7 Code” field), grouped into projects by prefix. Billing rates are set
        per person in <b className="text-foreground">People &amp; rates</b>; the Budget Usage Report values each person’s TSheets hours at
        their own Rate / client.
      </p>
    </div>
  )
}
