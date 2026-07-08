'use client'

/**
 * Small chrome pieces of the i7 report, split out of I7Report (audit M5-2):
 *   - ExportMenu — the Export → "Save as PDF" dropdown.
 *   - NoteCard   — the editable month narrative (admins), shown + in the PDF.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveReportNote } from '@/lib/tsheets/settings-actions'

// Export dropdown → opens the print/PDF view for the current month.
export function ExportMenu({ month }: { month: string }) {
  const [open, setOpen] = useState(false)
  const item = 'block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50'
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-2-2m2 2l2-2M4 6a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>
        Export
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
            <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Save as PDF</div>
            <a href={`/tools/time-report/print?month=${month}&type=client`} target="_blank" rel="noopener" className={item}>Client report</a>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Month note <span className="text-xs font-normal text-slate-400">· shown on the client report</span></h3>
        {canEdit && !editing && <button onClick={() => { setVal(note); setEditing(true) }} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Edit</button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={val} onChange={e => setVal(e.target.value)} rows={3} placeholder="A short summary for the client (optional)…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      ) : note ? (
        <p className="text-sm text-slate-700 whitespace-pre-line">{note}</p>
      ) : (
        <p className="text-sm text-slate-400 italic">No note for this month{canEdit ? ' — click Edit to add one.' : '.'}</p>
      )}
    </div>
  )
}
