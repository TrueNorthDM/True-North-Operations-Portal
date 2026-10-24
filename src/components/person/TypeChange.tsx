'use client'

/**
 * Contractor to employee on a person's page (Clocky part 2, Company
 * Settings.dc.html 10A-3, 10A-4):
 *
 *   TypeChangeBanner   "Becomes an employee on Tue, Dec 1, 2026." with Cancel
 *                      the change, above the tabs while it waits
 *   TypeChangeButton   "Change to employee…" in Pay and hours (Super Admins),
 *                      and its dialog: from which day, what happens, what
 *                      stays the same, a note
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { TypeChangeOption } from '@/lib/timeclock/type-change'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN, Toast, type ToastState } from '@/components/clocky/entries/ui'

export interface TypeChangeView {
  name: string
  canMigrate: boolean
  canCancel: boolean
  scheduled: { date: string; text: string } | null
  options: TypeChangeOption[]
  stays: string
  /**
   * Rippling as Integrations has it: "connected" once a token is saved and the
   * portal's calls are written (RIPPLING_CALLS_WRITTEN), "token" for a saved
   * token waiting on those calls, "none" with no token; null when it could not
   * be read.
   */
  rippling: 'connected' | 'token' | 'none' | null
  /** Design check only: the dialog already open (10A-3). */
  startOpen?: boolean
}

type Done = { ok: true; toast: string } | { ok: false; error: string }
export interface TypeChangeApi {
  schedule: (i: { date: string; note?: string }) => Promise<Done>
  cancel: () => Promise<Done>
}

export function TypeChangeBanner({ view, api }: { view: TypeChangeView; api: TypeChangeApi }) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  if (!view.scheduled) return null
  const cancel = async () => {
    setBusy(true)
    try {
      const r = await api.cancel()
      setToast(r.ok ? { text: r.toast } : { text: r.error, error: true })
      if (r.ok) router.refresh()
    } catch {
      setToast({ text: 'That did not go through. Check your connection and try again.', error: true })
    } finally {
      setBusy(false)
    }
    setTimeout(() => setToast(null), 4200)
  }
  return (
    <div role="status" className="flex gap-3 items-center rounded-[12px] bg-tn-teal-soft border border-[#cfe5e5] px-4 py-3 text-[13.5px] text-tn-ink leading-[1.5] flex-wrap">
      <Icon d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" size={18} color="#1E7D7F" width={2.2} className="flex-none" />
      <span className="flex-1 min-w-[240px]"><b>Becomes an employee on {view.scheduled.date}.</b> {view.scheduled.text}</span>
      {view.canCancel && (
        <button type="button" disabled={busy} onClick={() => void cancel()} className="border border-slate-200 rounded-[10px] px-[13px] py-2 bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-[#c8323d] disabled:opacity-60">Cancel the change</button>
      )}
      <Toast toast={toast} />
    </div>
  )
}

export function TypeChangeButton({ view, api }: { view: TypeChangeView; api: TypeChangeApi }) {
  const router = useRouter()
  const [open, setOpen] = useState(!!view.startOpen)
  const [toast, setToast] = useState<ToastState | null>(null)
  if (!view.canMigrate) return null
  return (
    <div className="flex flex-col gap-2 mt-1">
      <button type="button" onClick={() => setOpen(true)} className="self-start inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-[15px] py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">
        <Icon d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" size={15} color={BTN_ICON.white} width={2.2} />Change to employee…
      </button>
      <span className="text-[12px] text-muted leading-[1.5]">For when a contractor joins Rippling payroll. Only Super Admins.</span>
      {open && <TypeChangeDialog view={view} onClose={() => setOpen(false)} schedule={api.schedule}
        onDone={t => { setOpen(false); setToast({ text: t }); setTimeout(() => setToast(null), 4200); router.refresh() }} />}
      <Toast toast={toast} />
    </div>
  )
}

function TypeChangeDialog({ view, onClose, schedule, onDone }: { view: TypeChangeView; onClose: () => void; schedule: TypeChangeApi['schedule']; onDone: (toast: string) => void }) {
  const [date, setDate] = useState(view.options[0]?.date ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const option = view.options.find(o => o.date === date)
  const dots = ['#a3aebb', '#1E7D7F', '#012358']
  // The picker stays off until the portal's Rippling calls exist; the line says which part is missing.
  const rippling = view.rippling === 'token'
    ? 'A Rippling token is saved, but the portal does not call Rippling yet: it links the employee there, and reads their PTO balances, once it does.'
    : view.rippling === 'none'
      ? 'Rippling is not connected yet (no token is saved in Integrations): the portal links the employee there, and reads their PTO balances, once it is.'
      : view.rippling === null ? 'Rippling is not connected yet: the portal links the employee there, and reads their PTO balances, once it is.' : null
  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await schedule({ date, note: note.trim() || undefined })
      if (r.ok) onDone(r.toast)
      else setError(r.error)
    } catch {
      setError('That did not go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal label="Change to employee" width={636} onClose={onClose}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>Make {view.name} an employee?</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <LabeledSelect label="From" value={date} onChange={setDate} options={view.options.map(o => ({ value: o.date, label: o.label }))} />
        <LabeledSelect label="Rippling employee" value="" onChange={() => {}} disabled placeholder={view.rippling === 'connected' ? 'Linked by the portal' : 'Linked when Rippling is connected'} options={[]} />
      </div>
      {rippling && (
        <div className="flex gap-2 items-center text-[12.5px] text-[#5b6b82] font-semibold">
          <Icon d="M12 8v4M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={14} width={2.4} />{rippling}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">What happens</span>
        {option?.steps.map((m, i) => (
          <div key={m.title} className="flex gap-3">
            <div className="flex flex-col items-center"><span className="w-3 h-3 rounded-full mt-1 flex-none" style={{ background: dots[i] ?? '#012358' }} /><span className="flex-1 w-0.5 bg-[var(--row-rule)] my-1" /></div>
            <div className="pb-3 flex flex-col gap-[3px]"><span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{m.title}</span><span className="text-[12.5px] text-foreground leading-[1.5] [text-wrap:pretty]">{m.text}</span></div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 bg-subtle rounded-[12px] px-3.5 py-3">
        <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Stays the same</span>
        <span className="text-[12.5px] text-foreground leading-[1.55]">{view.stays}</span>
      </div>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Note (optional)</FieldLabel>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="e.g. Joins payroll as Social Media Team Leader" className={TEXTAREA_PLAIN} />
      </label>
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={!date || busy} onClick={() => void submit()} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-50">
          <Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />Schedule the change
        </button>
      </div>
    </Modal>
  )
}
