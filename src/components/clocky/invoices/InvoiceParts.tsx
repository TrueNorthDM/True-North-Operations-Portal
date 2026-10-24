'use client'

/**
 * What the Invoices list (6E) and an invoice (6F) share: the state pills, the
 * Mark paid dialog (6G) and the History card.
 */

import { useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { InvoiceStateKey } from '@/lib/timeclock/invoices-view'
import type { Result } from '@/lib/timeclock/clocky-types'
import { MON, parsePaidOn } from '@/lib/timeclock/paid-on'
import { FieldLabel, Modal, MODAL_TITLE, TEXTAREA_PLAIN } from '../entries/ui'

/** Invoices.dc.html ST and T: each state's words and colours. */
export const STATE_PILL: Record<InvoiceStateKey, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: '#f1f3f6', fg: '#5b6b82' },
  hrs: { label: 'Waiting for hours', bg: '#f1f3f6', fg: '#5b6b82' },
  wait: { label: 'Waiting for approval', bg: '#fdf8e7', fg: '#8a6d1a' },
  appr: { label: 'Approved', bg: '#eaf4f4', fg: '#1E7D7F' },
  paid: { label: 'Paid', bg: '#e6f6ee', fg: '#0d7a4f' },
}

export interface PayTarget { id: number; number: string; who: string; line: string; total: string }

/** "Nov 3, 2026" for a day. */
const shown = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'

/** 6G: Mark <number> paid? The day, a reference, a note; paid once. */
export function MarkPaidDialog({ target, onClose, save, onSaved, refPlaceholder = 'e.g. WISE-88412', notePlaceholder = 'Anything the contractor should know', note }: {
  target: PayTarget
  /** The reimbursement document's (Requests.dc.html 9D) differs from the invoice's. */
  refPlaceholder?: string
  notePlaceholder?: string
  /** The line under the fields; null leaves it out (9D has none). */
  note?: string | null
  onClose: () => void
  save: (i: { id: number; paidOn: string; ref?: string; note?: string }) => Promise<Result<{ toast: string }>>
  onSaved: (toast: string) => void
}) {
  const [on, setOn] = useState(() => shown(new Date()))
  const [ref, setRef] = useState('')
  const [noteText, setNoteText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const day = parsePaidOn(on)
    if (!day) { setError('Write the day it was paid, like Nov 3, 2026.'); return }
    setBusy(true)
    setError(null)
    try {
      const r = await save({ id: target.id, paidOn: day, ref, note: noteText })
      if (r.ok) onSaved(r.toast)
      else setError(r.error)
    } catch {
      setError('That did not go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal label="Mark paid" width={440} onClose={onClose}>
      <h2 className={MODAL_TITLE}>Mark {target.number} paid?</h2>
      <div className="flex justify-between gap-2.5 items-center bg-subtle rounded-[12px] px-3.5 py-3 tabular-nums lining-nums">
        <span className="flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{target.who}</span>
          <span className="text-[12px] text-muted">{target.line}</span>
        </span>
        <span className="font-(family-name:--font-display) font-black text-[20px] text-tn-ink">{target.total}</span>
      </div>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Paid on</FieldLabel>
        <input value={on} onChange={e => setOn(e.target.value)} className={INPUT} />
      </label>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Reference (optional)</FieldLabel>
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder={refPlaceholder} maxLength={120} className={INPUT} />
      </label>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Note (optional)</FieldLabel>
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder={notePlaceholder} maxLength={1000} className={TEXTAREA_PLAIN} />
      </label>
      {note !== null && <div className="text-[12px] text-muted leading-[1.5]">{note ?? `${target.who} sees "Paid" with this date and reference. Paid once: the action goes away after this.`}</div>}
      {error && <div role="alert" className="text-[12.5px] font-semibold text-[#c8323d]">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={busy} onClick={() => void submit()}
          className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-60">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>{busy ? 'Saving…' : 'Mark paid'}
        </button>
      </div>
    </Modal>
  )
}

/** The History card: newest first, a dot per step and the line between them. */
export function InvoiceHistory({ items }: { items: { text: string; when: string; dot: string }[] }) {
  return (
    <div className="bg-white border border-[var(--panel-border)] rounded-[16px] p-[18px] flex flex-col gap-1">
      <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mb-2">History</div>
      {items.map((h, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="w-[11px] h-[11px] rounded-full mt-1 flex-none" style={{ background: h.dot }} />
            <span className="flex-1 w-0.5 bg-[var(--row-rule)] my-1" />
          </div>
          <div className="pb-3.5 flex flex-col gap-[3px] min-w-0">
            <span className="text-[13px] text-tn-ink font-semibold leading-[1.45] [text-wrap:pretty]">{h.text}</span>
            <span className="text-[11.5px] text-muted tabular-nums lining-nums">{h.when}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
