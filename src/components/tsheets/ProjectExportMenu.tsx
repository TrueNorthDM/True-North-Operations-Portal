'use client'

/**
 * Export for Project Hours & Others, in the i7 report's shape: a report by
 * format matrix, two reports and two formats.
 *
 *   client   → the Costs tab. What each project consumed and what came in.
 *   internal → the People tab. Who did the hours, so it carries names.
 *
 * The rules are the i7 ones, and for the same reasons. The CSVs follow whatever
 * period is on screen. The PDFs are a month's document, headed with one and laid
 * out for a page, so they grey out until a single month is chosen rather than
 * quietly exporting the first month of a year. Every PDF is built, previewed and
 * only then offered, which is the rule for every PDF in the portal.
 *
 * A third row, "Month by month", is the table under the report. Tina looked for
 * its CSV here in September 2026, so here is where it went, and on the 16th she
 * asked for it to look like the screen: the CSV is laid out as the table is, and
 * there is a PDF of it, landscape, January to the period's last month. That PDF
 * is not one month, so it does not wait for one.
 */

import { useState, type ReactNode } from 'react'
import { PdfPreview, type PdfRequest } from '@/components/ui/PdfPreview'
import type { Range } from '@/lib/tsheets/range'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { ROUTES } from '@/lib/nav/routes'

const CSV_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
)
const PDF_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /><path d="M12 18v-6M9.5 15.5 12 18l2.5-2.5" /></svg>
)
const BARS = (ink: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
)
const CALENDAR = (ink: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
)

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function ProjectExportMenu({ range, monthly }: { range: Range; monthly: boolean }) {
  const [open, setOpen] = useState(false)
  const [pdf, setPdf] = useState<PdfRequest | null>(null)

  function preview(type: 'internal' | 'client' | 'history') {
    setOpen(false)
    setPdf({
      // The month by month table runs to the period's last month; the others are the month chosen.
      url: `${ROUTES.i7}/pdf?report=projects&month=${type === 'history' ? range.to : range.from}&type=${type}`,
      title: type === 'internal' ? 'Project hours by person' : type === 'history' ? 'Project hours month by month' : 'Project hours and others',
      fallbackName: `project-hours-${type}.pdf`,
    })
  }

  const csv = (type: 'internal' | 'client') =>
    `${ROUTES.projectHours}/csv?from=${range.from}&to=${range.to}&type=${type}`

  // The table always runs from January to the period's last month, whatever the
  // period is, so the row says which months rather than letting a range suggest
  // otherwise.
  const year = range.to.slice(0, 4)
  const lastMonth = MON[Number(range.to.slice(5, 7)) - 1]
  const tableMonths = lastMonth === 'Jan' ? `Jan ${year}` : `Jan to ${lastMonth} ${year}`

  return (
    <div className="relative">
      {/* Rightmost of three, and the one that wears the gold, exactly as the
          i7 Export does. Only the middle button in the row is white. */}
      <button onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }} className={BTN.navy}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        <span className="text-[#ffffff]">Export</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-20 w-[330px] rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)] p-3">
            <div className="grid grid-cols-[1fr_44px_44px] items-center gap-x-2 gap-y-2.5">
              <div className="pl-1 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted">Report</div>
              <div className="text-center text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.08em] text-muted">PDF</div>
              <div className="text-center text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.08em] text-muted">CSV</div>

              {([
                { key: 'client', name: 'Client', sub: 'Projects · costs & donations', tint: 'bg-[#fdf6dc]', ink: '#B8790A', hover: 'hover:border-[#B8790A] hover:bg-[#fdf6dc]' },
                { key: 'internal', name: 'Internal', sub: 'Per person · names', tint: 'bg-tn-teal-soft', ink: '#1E7D7F', hover: 'hover:border-tn-teal hover:bg-tn-teal-soft' },
              ] as const).map(r => (
                <Row key={r.key} r={r} icon={BARS(r.ink)} monthly={monthly} onPdf={() => preview(r.key)} csv={csv(r.key)} onCsv={() => setOpen(false)} />
              ))}

              {/* A line between the report and the table under it: the rows
                  above export what the tabs show, this one the year below. */}
              <div className="col-span-3 border-t border-slate-100" aria-hidden="true" />
              <Row
                r={{ key: 'history', name: 'Month by month', sub: `Projects · ${tableMonths}`, tint: 'bg-[rgba(1,35,88,0.07)]', ink: '#012358', hover: 'hover:border-tn-primary hover:bg-[rgba(1,35,88,0.05)]' }}
                icon={CALENDAR('#012358')}
                monthly
                onPdf={() => preview('history')}
                csv={`${ROUTES.projectHours}/history/csv?from=${range.from}&to=${range.to}`}
                onCsv={() => setOpen(false)}
              />
            </div>

            {/* Said once, under the things it applies to, rather than in three
                tooltips somebody has to go looking for. */}
            {!monthly && (
              <p className="px-3 pt-3 pb-0.5 text-[11px] text-muted leading-[1.5] m-0">
                The Client and Internal PDFs are a single month, so they wait for one. The CSVs and the month by month PDF cover whatever is on screen.
              </p>
            )}
          </div>
        </>
      )}
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
    </div>
  )
}

function Row(
  { r, icon, monthly, onPdf, csv, onCsv }: {
    r: { key: string; name: string; sub: string; tint: string; ink: string; hover: string }
    icon: ReactNode
    monthly: boolean
    /** Absent for a report that has no PDF, which leaves its PDF cell empty. */
    onPdf?: () => void
    csv: string
    onCsv: () => void
  },
) {
  return (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`shrink-0 w-[30px] h-[30px] rounded-[8px] ${r.tint} inline-flex items-center justify-center`}>
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink leading-tight">{r.name}</span>
          <span className="block text-[10px] text-muted leading-snug">{r.sub}</span>
        </span>
      </div>
      {onPdf ? (
        <button
          onClick={onPdf}
          disabled={!monthly}
          aria-label={`Download ${r.name.toLowerCase()} report as PDF`}
          title={monthly ? undefined : 'A PDF is one month. Choose a single month to make one.'}
          className={`h-[42px] inline-flex items-center justify-center rounded-[9px] border border-slate-200 transition-all ${r.hover} disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
          style={{ color: r.ink }}
        >
          {PDF_ICON}
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
      <a
        href={csv}
        onClick={onCsv}
        aria-label={`Download ${r.name.toLowerCase()} report as CSV`}
        className={`h-[42px] inline-flex items-center justify-center rounded-[9px] border border-slate-200 transition-all ${r.hover}`}
        style={{ color: r.ink }}
      >
        {CSV_ICON}
      </a>
    </>
  )
}
