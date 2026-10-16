'use client'

/**
 * The two windows over the clock panel (Clock Panel.dc.html): 1J, save a
 * combination (or edit one), and 1K, manage them (drag to reorder, edit,
 * delete). Keyboard as every portal window: focus in, Tab kept inside, Escape
 * closes, focus back (useModal).
 */

import { useRef, useState, type ReactNode } from 'react'
import { useModal } from '@/components/ui/useModal'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import type { ClockChoice, ClockPanelData } from '@/lib/timeclock/clocky-types'
import type { FieldName } from '@/lib/timeclock/entry-rules'
import { SHOWN_COMBINATIONS, fieldByKey, keysFor, suggestName, valueOf, type SaveDraft } from './clock-model'
import { ClockField, FOCUS, HeadButton, ICON, INPUT_FOCUS, Icon, LINK_BTN, SectionLabel } from './ClockParts'

/** Escape inside an open dropdown closes the dropdown, not the window under it. */
const unlessMenuOpen = (close: () => void) => () => { if (!document.querySelector('[role="listbox"]')) close() }

/**
 * A window over the page. `width` is the outer width: the prototype's windows
 * are max-width plus their padding (470 + 44 = 514), as they render there.
 */
export function ClockWindow({ label, width, contained, onClose, children }: { label: string; width: number; contained?: boolean; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, unlessMenuOpen(onClose))
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      className={`${contained ? 'absolute' : 'fixed'} z-50 inset-0 bg-[rgba(1,35,88,.32)] flex items-center justify-center p-5`}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={label} style={{ maxWidth: width }}
        className="w-full max-h-full overflow-auto leading-[normal] bg-white rounded-[16px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] p-[22px] flex flex-col">
        {children}
      </div>
    </div>
  )
}

export function WindowHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink" style={{ letterSpacing: 'normal' }}>{title}</h2>
      <HeadButton label="Close" onClick={onClose}><Icon d={ICON.close} size={17} sw={2.2} join={null} /></HeadButton>
    </div>
  )
}

// ── 1J Save a combination ───────────────────────────────────────────────────

export function SaveComboModal({ data, save, busy, contained, onChange, onClose, onSave }: {
  data: ClockPanelData
  save: SaveDraft
  busy: boolean
  contained?: boolean
  onChange: (s: SaveDraft) => void
  onClose: () => void
  onSave: () => void
}) {
  const [jobEdit, setJobEdit] = useState(false)
  const job = data.jobs.find(j => j.id === save.jobId)
  const setField = (key: FieldName, v: string) => {
    const f = fieldByKey(data.fields, key)
    if (f) onChange({ ...save, values: { ...save.values, [f.id]: v } })
  }
  const setJob = (id: string) => {
    const next = data.jobs.find(j => String(j.id) === id)
    if (!next) return
    const def = data.defaults[String(next.id)] ?? {}
    const values = { ...save.values }
    for (const key of ['company', 'project', 'billable'] as const) {
      const f = fieldByKey(data.fields, key)
      if (f && def[f.id]) values[f.id] = def[f.id]
    }
    const code = fieldByKey(data.fields, 'code')
    if (code) values[code.id] = next.isI7 ? def[code.id] ?? '' : ''
    setJobEdit(false)
    onChange({ ...save, jobId: next.id, values, name: suggestName(next.short, next.folderId != null, valueOf(values, data.fields, 'activity')) })
  }
  const title = save.editing ? 'Edit combination' : 'Save a combination'
  return (
    <ClockWindow label="Save a combination" width={514} contained={contained} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <WindowHead title={title} onClose={onClose} />
        <label className="flex flex-col gap-[5px]">
          <SectionLabel>Name</SectionLabel>
          <input value={save.name} onChange={e => onChange({ ...save, name: e.target.value })}
            className={`w-full box-border h-10 px-3 border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-bold text-[14px] text-tn-ink ${INPUT_FOCUS}`} />
        </label>
        {jobEdit ? (
          <ClockField label="Job" value={String(save.jobId)} options={data.jobs.map(j => ({ value: String(j.id), label: j.path }))} onChange={setJob} search />
        ) : (
          <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-[11px] flex items-center gap-3 bg-subtle">
            <div className="flex-1 min-w-0">
              <SectionLabel>Job</SectionLabel>
              <div className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink mt-[3px]">{job?.path ?? ''}</div>
            </div>
            <button type="button" onClick={() => setJobEdit(true)} className={LINK_BTN}>Change</button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {keysFor(!!job?.isI7).map(key => {
            const f = fieldByKey(data.fields, key)
            if (!f) return null
            return (
              <ClockField key={key} label={f.label + (key === 'activity' ? ' (optional)' : '')} value={save.values[f.id] ?? ''} options={f.options}
                onChange={v => setField(key, v)} search={key === 'activity' || key === 'code'} placeholder={key === 'activity' ? 'Search activities' : 'Choose'} />
            )
          })}
        </div>
        <label className="flex flex-col gap-[5px]">
          <SectionLabel>Note (optional, used every time)</SectionLabel>
          <input value={save.notes} onChange={e => onChange({ ...save, notes: e.target.value })} placeholder="e.g. i7 LinkedIn Project"
            className={`w-full box-border h-10 px-3 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink placeholder:text-muted ${INPUT_FOCUS}`} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BTN.white} ${FOCUS}`}>Cancel</button>
          <button type="button" onClick={onSave} disabled={busy || !save.name.trim()} className={`${BTN.navy} disabled:opacity-60 ${FOCUS}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={BTN_ICON.navy} aria-hidden="true"><path d={ICON.star} /></svg>Save combination
          </button>
        </div>
      </div>
    </ClockWindow>
  )
}

// ── 1K Manage combinations ──────────────────────────────────────────────────

export function ManageCombosModal({ combinations, contained, onReorder, onEdit, onDelete, onClose }: {
  combinations: ClockChoice[]
  contained?: boolean
  onReorder: (ids: number[]) => void
  onEdit: (c: ClockChoice) => void
  onDelete: (c: ClockChoice) => void
  onClose: () => void
}) {
  // The order being dragged, until the server's comes back.
  const [order, setOrder] = useState<number[] | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const drag = useRef<number | null>(null)
  const byId = new Map(combinations.map(c => [c.combinationId!, c]))
  const rows = order
    ? [...order.filter(id => byId.has(id)), ...combinations.map(c => c.combinationId!).filter(id => !order.includes(id))].map(id => byId.get(id)!)
    : combinations
  const move = (from: number | null, to: number) => {
    setOver(null)
    if (from == null || from === to || to < 0 || to >= rows.length) return
    const ids = rows.map(c => c.combinationId!)
    const [x] = ids.splice(from, 1)
    ids.splice(to, 0, x)
    setOrder(ids)
    onReorder(ids)
  }
  return (
    <ClockWindow label="Manage combinations" width={544} contained={contained} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <WindowHead title="Manage combinations" onClose={onClose} />
        <div className="text-[12.5px] text-muted leading-[1.5]">Drag to reorder. The panel shows the first 6; the rest sit under More.</div>
        <div className="flex flex-col border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
          {rows.map((c, i) => (
            <div key={c.combinationId} draggable
              onDragStart={e => { drag.current = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)) } catch { /* some browsers refuse */ } }}
              onDragOver={e => { e.preventDefault(); if (over !== i) setOver(i) }}
              onDrop={e => { e.preventDefault(); move(drag.current, i) }}
              onDragEnd={() => setOver(null)}
              className={`flex items-center gap-2.5 py-2.5 pr-2.5 pl-2 border-b border-[var(--row-rule)] ${over === i ? 'bg-tn-teal-soft' : 'bg-white'}`}>
              <button type="button" title="Drag to reorder" aria-label={`Move ${c.name}. Use the arrow keys.`}
                onKeyDown={e => {
                  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
                  e.preventDefault()
                  const to = i + (e.key === 'ArrowUp' ? -1 : 1)
                  move(i, to)
                  const btn = e.currentTarget
                  requestAnimationFrame(() => btn.closest('[role="dialog"]')?.querySelectorAll<HTMLElement>('[title="Drag to reorder"]')[Math.max(0, Math.min(rows.length - 1, to))]?.focus())
                }}
                className={`cursor-grab text-[#cbd2da] flex border-0 bg-transparent p-0 ${FOCUS}`}>
                <Icon d={ICON.grip} size={18} sw={3} join={null} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{c.name}</span>
                  {i >= SHOWN_COMBINATIONS && <span className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-full px-[7px] py-[2px]">Under More</span>}
                </div>
                <div className="text-[12px] text-muted mt-0.5 truncate">{`${c.path} · ${c.activity || 'No activity'}`}</div>
              </div>
              <button type="button" onClick={() => onEdit(c)} aria-label="Edit" title="Edit"
                className={`w-8 h-8 border-0 bg-transparent rounded-[8px] cursor-pointer text-tn-green flex items-center justify-center hover:bg-subtle ${FOCUS}`}>
                <Icon d={ICON.pencil} size={16} sw={2} />
              </button>
              <button type="button" onClick={() => onDelete(c)} aria-label="Delete" title="Delete"
                className={`w-8 h-8 border-0 bg-transparent rounded-[8px] cursor-pointer text-[#c8323d] flex items-center justify-center hover:bg-[#fdeeef] ${FOCUS}`}>
                <Icon d={ICON.trash} size={16} sw={2} />
              </button>
            </div>
          ))}
          {rows.length === 0 && <div className="p-4 text-[13px] text-muted">No combinations yet. Star a recent one to save it.</div>}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={`${BTN.navy} ${FOCUS}`}>Done</button>
        </div>
      </div>
    </ClockWindow>
  )
}
