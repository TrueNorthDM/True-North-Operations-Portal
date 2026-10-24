/**
 * A reimbursement document's receipts, each on its own A4 page after the
 * document (Requests.dc.html 9D-p): "Receipt: <file>" over what it was for and
 * its amount, the receipt itself in the box below, the page number at the
 * foot. A photo shows as it is; a PDF receipt gets a page for each of its own
 * (the preview shows it in the browser's viewer, the PDF maker draws it into
 * the box); a HEIC photo says where to open it.
 *
 * No hooks: the PDF's print page renders it on the server.
 */

import type { DocSheetData } from '@/lib/timeclock/pay-docs'
import { pageLabels, type DocReceipt } from '@/lib/timeclock/receipt-pages'

const RECEIPT = 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3'

export function ReceiptPages({ doc, docPages = 1, src, print = false }: {
  doc: DocSheetData
  docPages?: number
  /** The receipt's address; none in the design check, which has no files. */
  src?: (r: DocReceipt) => string
  /** The print page: a full A4 page (the preview's paper is the document sheet's 840px), and a PDF receipt's box left empty for the PDF maker. */
  print?: boolean
}) {
  const labels = pageLabels(docPages, doc.receipts)
  let at = 0
  return doc.receipts.flatMap(r => Array.from({ length: r.pages }, (_, p) => {
    const k = at++
    return (
      <div key={`${r.id}-${p}`} className={`w-[620px] ${print ? 'h-[876px]' : 'h-[840px]'} box-border bg-white flex flex-col gap-4 px-10 pt-9 pb-[26px] overflow-hidden [break-before:page]`}>
        <div className="flex items-start gap-2.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a3aebb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none mt-px"><path d={RECEIPT} /></svg>
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink lining-nums [overflow-wrap:anywhere]">Receipt: {r.file}{r.pages > 1 ? `, page ${p + 1} of ${r.pages}` : ''}</span>
            <span className="text-[12px] text-muted tabular-nums lining-nums">{r.line}</span>
          </div>
        </div>
        <div data-receipt-box={r.show === 'pdf' ? `${r.id}:${p}` : undefined} className="flex-1 min-h-0 flex items-center justify-center">
          <ReceiptArt r={r} page={p} src={src} print={print} />
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-[var(--row-rule)] text-[9.5px] text-muted">
          <span className="tabular-nums lining-nums">{doc.title}</span>
          <span data-page-at={k}>{labels.receipts[k]}</span>
        </div>
      </div>
    )
  }))
}

function ReceiptArt({ r, page, src, print }: { r: DocReceipt; page: number; src?: (r: DocReceipt) => string; print: boolean }) {
  if (r.show === 'none') {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#a3aebb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={RECEIPT} /></svg>
        <span className="text-[12px] text-muted leading-[1.5]">This file cannot be drawn in a PDF. It opens from the reimbursement document in the portal.</span>
      </div>
    )
  }
  if (!src) return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#a3aebb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={RECEIPT} /></svg>
  // eslint-disable-next-line @next/next/no-img-element
  if (r.show === 'image') return <img src={src(r)} alt={`Receipt ${r.file}`} className="max-w-full max-h-full object-contain" />
  if (print) return null
  return <iframe src={`${src(r)}#page=${page + 1}&toolbar=0&navpanes=0&view=Fit`} title={`Receipt ${r.file}, page ${page + 1}`} className="w-full h-full border-0" />
}
