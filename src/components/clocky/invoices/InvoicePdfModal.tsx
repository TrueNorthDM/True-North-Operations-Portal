'use client'

/**
 * A pay document's PDF, previewed before anything downloads (Approvals.dc.html
 * 6C-p, Invoices.dc.html 6F-p, Company Settings.dc.html 10P-3; the portal's
 * rule: every PDF opens in a preview first). The page shown is the same sheet
 * the PDF prints; Download asks the server for the file and saves it.
 *
 *   InvoicePdfModal   an invoice (/clocky-hours/invoices/<id>/pdf)
 *   DocPdfModal       a payroll summary or reimbursement document
 *                     (/clocky-hours/documents/<kind>/<id>/pdf)
 */

import { useRef, useState } from 'react'
import { useModal } from '@/components/ui/useModal'
import { withViewAs } from '@/components/ViewAsKeeper'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { ReactNode } from 'react'
import type { DocKind, DocSheetData } from '@/lib/timeclock/pay-docs'
import { DocSheet } from './DocSheet'
import { InvoiceDoc, type InvoiceDocData } from './InvoiceDoc'

export function InvoicePdfModal({ invoice, onClose, onDownloaded }: {
  invoice: InvoiceDocData & { id: number }
  onClose: () => void
  onDownloaded?: (name: string) => void
}) {
  return (
    <PdfWindow name={`${invoice.number}.pdf`} href={`/clocky-hours/invoices/${invoice.id}/pdf`} onClose={onClose} onDownloaded={onDownloaded}>
      <InvoiceDoc inv={invoice} variant="page" />
    </PdfWindow>
  )
}

export function DocPdfModal({ kind, id, doc, onClose, onDownloaded }: {
  kind: DocKind
  id: number
  doc: DocSheetData
  onClose: () => void
  onDownloaded?: (name: string) => void
}) {
  return (
    <PdfWindow name={doc.file} href={`/clocky-hours/documents/${kind}/${id}/pdf`} onClose={onClose} onDownloaded={onDownloaded}>
      <DocSheet doc={doc} />
    </PdfWindow>
  )
}

function PdfWindow({ name, href, onClose, onDownloaded, children }: {
  name: string
  href: string
  onClose: () => void
  onDownloaded?: (name: string) => void
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(withViewAs(href))
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      onDownloaded?.(name)
      onClose()
    } catch {
      setError('The PDF could not be made. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} className="fixed inset-0 z-[80] bg-[rgba(1,35,88,.32)] flex items-center justify-center p-6">
      <div ref={box} role="dialog" aria-modal="true" aria-label="PDF preview" className="w-full max-w-[900px] h-full max-h-[860px] bg-white rounded-[16px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] flex flex-col overflow-hidden leading-[normal]">
        <div className="flex items-center gap-3 px-[18px] py-3.5 border-b border-[var(--row-rule)]">
          <span className="w-[34px] h-[34px] rounded-[10px] bg-tn-teal-soft text-tn-teal flex items-center justify-center flex-none">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" /></svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{name}</div>
            <div className={`text-[12px] ${error ? 'text-[#c8323d] font-semibold' : 'text-muted'}`}>{error ?? 'Preview, 1 page. Nothing downloads until you press Download.'}</div>
          </div>
          <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-[15px] py-[9px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Close</button>
          <button type="button" disabled={busy} onClick={() => void download()} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-4 py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{busy ? 'Making the PDF…' : 'Download'}
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-[#e9e6dd] p-[26px] flex justify-center items-start">
          <div className="flex-none shadow-[0_12px_30px_-14px_rgba(1,35,88,.4)]">{children}</div>
        </div>
      </div>
    </div>
  )
}
