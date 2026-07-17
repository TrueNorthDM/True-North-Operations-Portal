'use client'

/**
 * Small chrome pieces of the i7 report, split out of I7Report (audit M5-2):
 *   - ExportMenu — the Export → "Save as PDF" dropdown.
 *   - NoteCard   — the editable month narrative (admins), shown + in the PDF.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveReportNote } from '@/lib/tsheets/settings-actions'

// Small spinner for the "generating…" state.
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin shrink-0 self-center" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#cbd5e1" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#1E7D7F" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// "Export image" — a shareable PNG of the budget-at-a-glance (used $ + %, amount
// left, month total) generated server-side (/tools/time-report/image). The card
// the team passes around, straight from the app.
export function ExportImageButton({ month }: { month: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/tools/time-report/image?month=${month}`)
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const name = /filename="(.+?)"/.exec(cd)?.[1] ?? 'i7-budget-summary.png'
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u; a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button onClick={download} disabled={busy} title="Download a shareable budget image for the team" className="inline-flex items-center gap-2.5 bg-white text-tn-ink border border-slate-200 rounded-[10px] px-[16px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_1px_2px_rgba(1,35,88,.06)] transition-all hover:border-tn-teal hover:text-tn-teal disabled:opacity-60 disabled:cursor-wait">
        {busy ? <Spinner /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.5-4.5L7 20" /></svg>}
        <span>{busy ? 'Generating…' : 'Team Update'}</span>
      </button>
      {error && <div className="absolute right-0 mt-2 z-20 w-64 rounded-[10px] border border-red-200 bg-white p-2.5 text-[11px] text-[var(--bdg-red-fg)] shadow-[0_10px_30px_-10px_rgba(1,35,88,.35)]">{error}</div>}
    </div>
  )
}

// Export dropdown → the two report versions as server-generated PDFs (client =
// portrait, internal = landscape), plus a browser-print fallback. The PDFs come
// from /tools/time-report/pdf (headless Chromium) so orientation is guaranteed.
export function ExportMenu({ month }: { month: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'internal' | 'client' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(type: 'internal' | 'client') {
    setBusy(type); setError(null)
    try {
      const res = await fetch(`/tools/time-report/pdf?month=${month}&type=${type}`)
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const name = /filename="(.+?)"/.exec(cd)?.[1] ?? `i7-${type}-report.pdf`
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u; a.download = name
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(u)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the PDF.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform hover:-translate-y-px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        <span className="text-[#ffffff]">Export</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { if (!busy) setOpen(false) }} />
          <div className="absolute right-0 mt-2 z-20 w-[320px] rounded-[14px] border border-slate-200 bg-white shadow-[0_24px_50px_-20px_rgba(1,35,88,.4)] p-3">
            {/* Matrix: report (rows) × format (columns). */}
            <div className="grid grid-cols-[1fr_44px_44px] items-center gap-x-2 gap-y-2.5">
              <div className="pl-1 text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted">Report</div>
              <div className="text-center text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.08em] text-muted">PDF</div>
              <div className="text-center text-[9.5px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.08em] text-muted">CSV</div>

              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 w-[30px] h-[30px] rounded-[8px] bg-tn-teal-soft inline-flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v1H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4V5a3 3 0 0 0-3-3z" /><path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink leading-tight">Internal</span>
                  <span className="block text-[10px] text-muted leading-snug">{busy === 'internal' ? 'Generating…' : 'Per-person · costs & rates'}</span>
                </span>
              </div>
              <button disabled={!!busy} onClick={() => download('internal')} aria-label="Download internal report as PDF" className="h-[42px] inline-flex items-center justify-center rounded-[9px] border border-slate-200 hover:border-tn-teal hover:bg-tn-teal-soft transition-all disabled:opacity-50 disabled:cursor-wait">
                {busy === 'internal' ? <Spinner /> : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /><path d="M12 18v-6M9.5 15.5 12 18l2.5-2.5" /></svg>}
              </button>
              <a href={`/tools/time-report/csv?month=${month}&type=internal`} onClick={() => setOpen(false)} aria-label="Download internal report as CSV" className="h-[42px] inline-flex items-center justify-center rounded-[9px] border border-slate-200 hover:border-tn-teal hover:bg-tn-teal-soft transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
              </a>

              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 w-[30px] h-[30px] rounded-[8px] bg-[#fdf6dc] inline-flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8790A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                </span>
                <span className="min-w-0">
                  <span className="block font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink leading-tight">Client</span>
                  <span className="block text-[10px] text-muted leading-snug">{busy === 'client' ? 'Generating…' : 'Summary · no names'}</span>
                </span>
              </div>
              <button disabled={!!busy} onClick={() => download('client')} aria-label="Download client report as PDF" className="h-[42px] inline-flex items-center justify-center rounded-[9px] border border-slate-200 hover:border-[#B8790A] hover:bg-[#fdf6dc] transition-all disabled:opacity-50 disabled:cursor-wait">
                {busy === 'client' ? <Spinner /> : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B8790A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="14 3 14 9 20 9" /><path d="M12 18v-6M9.5 15.5 12 18l2.5-2.5" /></svg>}
              </button>
              <a href={`/tools/time-report/csv?month=${month}&type=client`} onClick={() => setOpen(false)} aria-label="Download client report as CSV" className="h-[42px] inline-flex items-center justify-center rounded-[9px] border border-slate-200 hover:border-[#B8790A] hover:bg-[#fdf6dc] transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8790A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>
              </a>
            </div>
            {error && <p className="px-1 pt-2.5 text-[11px] text-[var(--bdg-red-fg)] break-words">{error} — or use &ldquo;Save current view&rdquo; below.</p>}
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
