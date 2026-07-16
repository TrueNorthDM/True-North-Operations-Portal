'use client'

/**
 * Small chrome pieces of the i7 report, split out of I7Report (audit M5-2):
 *   - ExportMenu — the Export → "Save as PDF" dropdown.
 *   - NoteCard   — the editable month narrative (admins), shown + in the PDF.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveReportNote } from '@/lib/tsheets/settings-actions'

// Export dropdown → the two report versions (internal / client) + print-current.
export function ExportMenu({ month }: { month: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform hover:-translate-y-px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        <span className="text-[#ffffff]">Export</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-20 w-[340px] rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)] p-2">
            <div className="px-2.5 pt-1.5 pb-1.5 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted">Choose a version</div>
            <a href={`/tools/time-report/print?month=${month}&type=internal`} className="flex items-start gap-3 rounded-[10px] border border-slate-200 px-3 py-[11px] mb-1.5 hover:border-tn-teal hover:bg-subtle transition-all">
              <span className="shrink-0 w-[30px] h-[30px] rounded-[8px] bg-tn-teal-soft inline-flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v1H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4V5a3 3 0 0 0-3-3z" /><path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" /></svg>
              </span>
              <span className="min-w-0">
                <span className="block font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">Internal report</span>
                <span className="block text-[11.5px] text-muted leading-snug mt-0.5">Full detail — per-person hours, costs &amp; rates. Confidential.</span>
              </span>
            </a>
            <a href={`/tools/time-report/print?month=${month}&type=client`} className="flex items-start gap-3 rounded-[10px] border border-slate-200 px-3 py-[11px] hover:border-tn-teal hover:bg-subtle transition-all">
              <span className="shrink-0 w-[30px] h-[30px] rounded-[8px] bg-[#fdf6dc] inline-flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8790A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
              </span>
              <span className="min-w-0">
                <span className="block font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">Client report</span>
                <span className="block text-[11.5px] text-muted leading-snug mt-0.5">Summary &amp; charts for i7 — no internal costs or staff names.</span>
              </span>
            </a>
            <div className="h-px bg-slate-100 mx-1 my-2" />
            <button onClick={() => { setOpen(false); window.print() }} className="flex items-center gap-2.5 w-full text-left rounded-[8px] px-3 py-2.5 text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] hover:bg-subtle transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Save current view as PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Month narrative — shown on the report and included in the PDF. Admins edit.
export function NoteCard({ month, note, canEdit }: { month: string; note: string; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!note && !canEdit) return null

  async function save() {
    setSaving(true); setError(null)
    const res = await saveReportNote({ month, note: val.trim() })
    setSaving(false)
    if (res.ok) { setEditing(false); router.refresh() }
    else setError(res.error ?? 'Save failed.')
  }

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px]">Month note <span className="text-xs font-normal text-muted">· shown on the client report</span></h3>
        {canEdit && !editing && <button onClick={() => { setVal(note); setEditing(true) }} className="text-xs font-(family-name:--font-display) font-bold px-3 py-1.5 rounded-[9px] border border-slate-200 text-foreground hover:border-tn-teal hover:text-tn-teal transition-colors">Edit</button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={val} onChange={e => setVal(e.target.value)} rows={3} placeholder="A short summary for the client (optional)…" className="w-full rounded-[10px] border border-slate-200 bg-subtle px-3 py-2 text-sm text-tn-ink focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20 resize-none" />
          {error && <p className="text-xs text-[var(--bdg-red-fg)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm font-(family-name:--font-display) font-bold text-muted hover:text-tn-ink">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-[10px] bg-tn-primary text-white text-sm font-(family-name:--font-display) font-extrabold hover:-translate-y-px transition-transform disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : note ? (
        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{note}</p>
      ) : (
        <p className="text-sm text-muted italic">No note for this month{canEdit ? ' — click Edit to add one.' : '.'}</p>
      )}
    </div>
  )
}
