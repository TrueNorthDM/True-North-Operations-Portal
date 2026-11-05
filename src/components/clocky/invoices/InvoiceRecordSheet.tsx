/**
 * The invoice PDF's record page (owner, 4 November 2026; the approved mockup
 * "PDF page 2: who made it and history"): what True North adds to its copy
 * after the contractor's invoice, so the file copied to Google Drive carries
 * who made the invoice, how it checks against the timesheet and its history.
 *
 * Drawn 620px wide like the invoice sheet (InvoiceDoc, variant page), in its
 * colours and type; the parent sets the page's height (A4 after the builder's
 * sheet, the paper of their own file after theirs). The footer sits at the
 * foot of the page.
 *
 * No hooks: the print pages render it on the server.
 */

import type { Check } from '@/lib/timeclock/contractor-invoice'
import type { InvoiceRecordView, RecordCheckRow } from '@/lib/timeclock/invoice-record'

const SECTION = 'font-(family-name:--font-display) font-extrabold text-[9px] tracking-[.14em] uppercase text-[#012358]'
const COLS = 'grid grid-cols-[minmax(0,1fr)_84px_84px_88px] gap-2 px-2.5'
const TONE: Record<Check, string> = { match: 'text-[#0d7a4f]', differs: 'text-[#c8323d]', 'only-timesheet': 'text-[#c8323d]', 'only-invoice': 'text-[#c8323d]', 'on-file': 'text-[#5b6b82]' }

function CheckLine({ r, total }: { r: RecordCheckRow; total?: boolean }) {
  return (
    <div className={`${COLS} ${total ? 'py-[7px] border-t border-[#e4e7ec] font-bold text-[#012358]' : 'py-1.5 border-t border-[#eceff3]'}`}>
      <span className="min-w-0">{r.label}</span>
      <span className="text-right">{r.timesheet}</span>
      <span className="text-right">{r.invoice}</span>
      <span className={`font-bold ${TONE[r.check]}`}>{r.word}</span>
    </div>
  )
}

export function InvoiceRecordSheet({ r, page, className = '' }: {
  r: InvoiceRecordView
  /** "Page 2 of 2" */
  page: string
  /** The page's height and break, from the print page. */
  className?: string
}) {
  return (
    <div className={`w-[620px] box-border bg-white px-[54px] pt-12 pb-9 flex flex-col gap-[18px] text-[10.5px] leading-[1.5] text-[#2b3445] tabular-nums lining-nums ${className}`}>
      <div className="flex flex-col gap-1 border-b-2 border-[#012358] pb-2.5">
        <span className="font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-[.16em] uppercase text-[#1E7D7F]">True North Operations Portal</span>
        <span className="font-(family-name:--font-display) font-black text-[19px] leading-[1.2] text-[#012358]">Invoice record · {r.number}</span>
        <span className="text-[#5b6b82]">Added by True North to its copy. It is not part of {r.name}&apos;s invoice on page 1.</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className={SECTION}>Who made it</span>
        <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-x-3 gap-y-[5px]">
          {r.facts.map(f => (
            <div key={f.label} className="contents">
              <span className="text-[#5b6b82]">{f.label}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{f.strong && <b className="text-[#012358]">{f.strong}</b>}{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={SECTION}>Checked against the timesheet</span>
        {r.check ? (
          <>
            <div className="flex flex-col border border-[#e4e7ec] rounded-[6px] overflow-hidden">
              <div className={`${COLS} py-1.5 bg-[#f4f2ec] font-bold text-[#012358]`}>
                <span>Client</span><span className="text-right">Timesheet</span><span className="text-right">Invoice</span><span>Check</span>
              </div>
              {r.check.rows.map((row, i) => <CheckLine key={i} r={row} />)}
              <CheckLine r={r.check.total} total />
            </div>
            {r.check.summary && <span className={r.check.matches ? 'text-[#5b6b82]' : 'text-[#c8323d]'}>{r.check.summary}</span>}
          </>
        ) : (
          <span className="text-[#5b6b82]">The check could not be read when this copy was made.</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={SECTION}>History</span>
        <div className="grid grid-cols-[116px_minmax(0,1fr)] gap-x-3 gap-y-[5px]">
          {r.history.map((h, i) => (
            <div key={i} className="contents">
              <span className="text-[#5b6b82] whitespace-nowrap">{h.when}</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{h.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex justify-between gap-4 border-t border-[#e4e7ec] pt-2 text-[9px] text-[#5b6b82]">
        <span>Record as of {r.asOf}. A new copy replaces this one in Google Drive when anything changes.</span>
        <span className="whitespace-nowrap">{page}</span>
      </div>
    </div>
  )
}
