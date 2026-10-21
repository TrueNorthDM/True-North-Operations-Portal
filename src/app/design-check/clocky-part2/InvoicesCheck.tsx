'use client'

// The Invoices frames (Invoices.dc.html 6A, 6B, 6E, 6F, 6G): the real screens
// with the prototype's data, built on the server (invoice-sample.ts). Actions
// answer as the prototype's toasts; nothing saves.

import { InvoiceDetailView } from '@/components/clocky/invoices/InvoiceDetailView'
import { InvoicesList, type InvoicesApi } from '@/components/clocky/invoices/InvoicesList'
import { SubmitDialog } from '@/components/clocky/entries/Dialogs'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import type { InvoiceDetail, InvoiceList } from '@/lib/timeclock/invoices-view'
import type { SubmitSummary } from '@/lib/timeclock/clocky-types'

export function InvoicesCheck({ frame, list, detail, pdf, submit }: { frame: string; list?: InvoiceList; detail?: InvoiceDetail; pdf?: InvoiceDetail; submit?: SubmitSummary }) {
  const api: InvoicesApi = {
    getInvoiceDoc: async ({ id }) => (pdf && pdf.doc.id === id ? { ok: true, doc: pdf.doc } : { ok: false, error: 'This frame previews INV-2026-0142 only.' }),
    markInvoicePaid: async ({ id }) => ({ ok: true, toast: `INV-2026-${String(id).padStart(4, '0')} marked paid. ${list?.rows.find(r => r.id === id)?.who ?? detail?.who ?? 'The contractor'} sees it in the bell.` }),
  }
  if (submit) {
    return (
      <div className="grid gap-4">
        <div>
          <Breadcrumb parents={['/clocky-hours']} now="Time entries" />
          <h1 className="m-0 mt-1.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Time entries</h1>
        </div>
        <SubmitDialog summary={submit} error={null} busy={false} clockHref="#" onClose={() => {}} onSubmit={() => {}} onFix={() => {}} />
      </div>
    )
  }
  if (detail) return <InvoiceDetailView key={frame} d={detail} api={api} initial={{ pdf: frame === '6Fp' }} />
  return <InvoicesList key={frame} data={list!} api={api} initial={{ pay: frame === '6G' ? 138 : undefined }} />
}
