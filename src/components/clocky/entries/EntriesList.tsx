'use client'

/**
 * 3A, the list (Time Entries.dc.html, frames 3A1, 3A2, 3A3): rows grouped by
 * day, collapsible, the Columns menu, a thin "switched" connector between an
 * entry and the one it switched to, status pills, and the row actions (Edit,
 * History, Continue, Delete; History only, with a lock, on a locked row).
 */

import { useEffect, useRef } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { EntryView } from '@/lib/timeclock/clocky-types'
import { COLUMNS, gridTemplate, groupByDay, liveSeconds, minWidth, overTen, visibleColumns, type ColumnKey } from './model'
import { BTN_MODAL_NAVY, BTN_PAGE_WHITE, BTN_SMALL, Icon, ICON, LABEL, MENU, Pill } from './ui'

/** Closes a menu on a press outside it. */
export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const fn = useRef(close)
  useEffect(() => { fn.current = close })
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) fn.current() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return ref
}

const DASH = <span className="text-[var(--faint)]">–</span>
const CELL = 'px-3 py-2.5 min-w-0 text-[13px] leading-[1.35] tabular-nums lining-nums overflow-hidden text-ellipsis whitespace-nowrap'

function Cell({ k, r, all, nowMs, onEdit }: { k: ColumnKey; r: EntryView; all: boolean; nowMs: number; onEdit: () => void }) {
  if (k === 'person') return <div className={`${CELL} text-tn-ink font-bold`}>{r.personName}</div>
  if (k === 'time') {
    const ab = all ? r.zoneAbbr : ''
    const color = r.running ? 'text-[var(--ok-fg)] font-bold' : !r.start ? 'text-muted font-semibold' : 'text-tn-ink font-semibold'
    return (
      <div className={`${CELL} ${color}`} title={ab ? `${r.personName}'s own time (${ab})` : undefined}>
        {r.timeText}{ab && <span className="font-semibold text-[11px] text-muted ml-[5px]">{ab}</span>}
      </div>
    )
  }
  if (k === 'duration') {
    const over = overTen(r, nowMs)
    return <div className={`${CELL} font-bold ${over ? 'text-[var(--warn-fg)]' : 'text-tn-ink'}`} title={over ? 'Over 10 hours' : undefined}>{formatDuration(liveSeconds(r, nowMs))}{over ? ' !' : ''}</div>
  }
  if (k === 'status') {
    return <div className={CELL}><div className="flex gap-1 flex-wrap">{r.pills.map((p, i) => <Pill key={i} text={p.text} tone={p.tone} tip={p.tip} />)}</div></div>
  }
  if (r.rowType === 'time_off') {
    if (k === 'job') return <div className={`${CELL} text-tn-ink font-semibold`}>{r.path}</div>
    if (k === 'notes') return <div className={`${CELL} text-muted`}>{r.notes || DASH}</div>
    return <div className={CELL}>{DASH}</div>
  }
  if (k === 'job') return <div className={`${CELL} text-tn-ink font-semibold`} title={r.path}>{r.path}</div>
  if (k === 'company') return <div className={`${CELL} text-foreground`}>{r.company || DASH}</div>
  if (k === 'project') return <div className={`${CELL} text-foreground`}>{r.project || DASH}</div>
  if (k === 'billable') return <div className={`${CELL} text-foreground`}>{r.billable ? (r.billable === 'yes' ? 'Yes' : 'No') : DASH}</div>
  if (k === 'code') return <div className={`${CELL} text-foreground`}>{r.code || DASH}</div>
  if (k === 'notes') return <div className={`${CELL} text-muted`} title={r.notes || undefined}>{r.notes || DASH}</div>
  // Activity: "+ Add Activity" where it can be fixed, "Missing" where it cannot.
  if (r.activity) return <div className={`${CELL} text-foreground`}>{r.activity}</div>
  if (r.canEdit) {
    return (
      <div className={CELL}>
        <button type="button" onClick={e => { e.stopPropagation(); onEdit() }}
          className="text-[11.5px] font-bold whitespace-nowrap text-[var(--warn-fg)] bg-[var(--warn-bg)] border border-dashed border-[#e9d48a] rounded-full px-[9px] py-[3px]">
          + Add Activity
        </button>
      </div>
    )
  }
  return <div className={`${CELL} text-[var(--warn-fg)] font-bold`}>Missing</div>
}

function ActionButton({ tip, d, color, fill, onClick }: { tip: string; d: string; color: string; fill?: string; onClick: () => void }) {
  return (
    <button type="button" title={tip} aria-label={tip} onClick={e => { e.stopPropagation(); onClick() }}
      className="w-[30px] h-[30px] border-0 bg-transparent rounded-[8px] flex items-center justify-center hover:bg-[var(--chip-neutral-bg)] transition-colors"
      style={{ color }}>
      <Icon d={d} size={16} fill={fill ?? 'none'} />
    </button>
  )
}

export function EntriesList({ rows, all, nowMs, cols, setCols, colsOpen, setColsOpen, collapsed, toggleDay, note, emptyText, canAdd, onEdit, onHistory, onContinue, onDelete, onOpen, onAdd, onRequest }: {
  rows: EntryView[]
  all: boolean
  nowMs: number
  cols: Record<ColumnKey, boolean>
  setCols: (c: Record<ColumnKey, boolean>) => void
  colsOpen: boolean
  setColsOpen: (open: boolean) => void
  collapsed: string[]
  toggleDay: (date: string) => void
  note: string
  emptyText: string
  canAdd: boolean
  onEdit: (r: EntryView) => void
  onHistory: (r: EntryView) => void
  onContinue: (r: EntryView) => void
  onDelete: (r: EntryView) => void
  /** A correction or a time off row: its card. */
  onOpen: (r: EntryView) => void
  onAdd: () => void
  onRequest: () => void
}) {
  const vis = visibleColumns(cols, all)
  const template = gridTemplate(vis)
  const groups = groupByDay(rows, all, nowMs)
  const menu = useOutside(colsOpen, () => setColsOpen(false))
  const connPad = all ? 182 : 12

  return (
    <>
      <div className="flex justify-between items-center gap-2.5">
        <span className="text-[12.5px] text-muted">{note}</span>
        <div className="relative" ref={menu}>
          <button type="button" onClick={() => setColsOpen(!colsOpen)} aria-expanded={colsOpen}
            className={`${BTN_SMALL} ${colsOpen ? 'border-tn-teal!' : ''}`}>
            <Icon d={ICON.columns} size={15} color={BTN_ICON.white} />Columns
          </button>
          {colsOpen && (
            <div className={`${MENU} top-10 right-0 w-[234px] p-1.5 gap-px`}>
              <div className={`${LABEL} text-muted px-2.5 pt-1.5 pb-1`}>Show columns</div>
              {COLUMNS.filter(c => c.key !== 'person' || all).map(c => (
                <button key={c.key} type="button" role="checkbox" aria-checked={cols[c.key]}
                  onClick={() => setCols({ ...cols, [c.key]: !cols[c.key] })}
                  className="flex items-center gap-2.5 border-0 text-left whitespace-nowrap rounded-[8px] px-2.5 py-[7px] font-(family-name:--font-display) font-semibold text-[13px] bg-transparent text-tn-ink hover:bg-subtle">
                  <span className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center ${cols[c.key] ? 'border-tn-teal bg-tn-teal' : 'border-[var(--faint)] bg-white'}`}>
                    {cols[c.key] && <Icon d={ICON.check} size={11} color="#ffffff" width={3.4} />}
                  </span>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto max-h-[600px]">
        <div style={{ minWidth: minWidth(vis) }}>
          <div className="grid sticky top-0 z-[3] bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: template }}>
            {vis.map(c => <div key={c.key} className={`px-3 py-2.5 ${LABEL} text-muted whitespace-nowrap`}>{c.label}</div>)}
            <div />
          </div>
          {groups.map(g => {
            const open = !collapsed.includes(g.date)
            return (
              <div key={g.date}>
                <button type="button" onClick={() => toggleDay(g.date)} aria-expanded={open}
                  className="w-full flex items-center gap-2 whitespace-nowrap border-0 border-b border-[var(--row-rule)] bg-[var(--row-hover)] px-3 py-[9px] text-left font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink tabular-nums lining-nums">
                  <Icon d={ICON.down} size={13} color="var(--muted)" width={2.6} style={{ transform: `rotate(${open ? 0 : -90}deg)` }} />
                  {g.label}
                  <span className="font-sans font-semibold text-[12px] text-muted">· {formatDuration(g.seconds)}{all ? ` · ${g.people} people` : ''}</span>
                </button>
                {open && g.rows.map((r, i) => {
                  const prev = g.rows[i - 1]
                  const switched = r.continuesPrevious && prev && prev.personId === r.personId && prev.end === r.start
                  const flagged = !!r.attention
                  const card = r.rowType !== 'entry'
                  return (
                    <div key={r.key}>
                      {switched && (
                        <div className="h-3.5 flex items-center gap-1.5 -my-[7px] relative z-[1]" style={{ paddingLeft: connPad }}>
                          <span className="w-0.5 h-[22px] bg-tn-teal rounded-[1px]" />
                          <span className="text-[10px] font-(family-name:--font-display) font-extrabold tracking-[.06em] uppercase text-tn-teal bg-white px-1">switched</span>
                        </div>
                      )}
                      <div onClick={card ? () => onOpen(r) : undefined}
                        className={`grid items-center border-b border-[var(--row-rule)] ${flagged ? 'bg-[var(--warn-bg)]' : 'bg-white'} hover:bg-[var(--row-hover)] ${card ? 'cursor-pointer' : ''}`}
                        style={{ gridTemplateColumns: template }}>
                        {vis.map(c => <Cell key={c.key} k={c.key} r={r} all={all} nowMs={nowMs} onEdit={() => onEdit(r)} />)}
                        <div className="flex justify-end items-center gap-px px-2">
                          {r.locked && r.rowType === 'entry' ? (
                            <>
                              <span title={`Locked: this period is ${r.lockWhy ?? 'locked'}`} className="text-muted flex px-1.5"><Icon d={ICON.lock} size={15} /></span>
                              <ActionButton tip="History" d={ICON.history} color="#435066" onClick={() => onHistory(r)} />
                            </>
                          ) : (
                            <>
                              {r.canEdit && <ActionButton tip="Edit" d={ICON.edit} color="#1E9E6A" onClick={() => onEdit(r)} />}
                              {r.rowType !== 'time_off' && <ActionButton tip="History" d={ICON.history} color="#435066" onClick={() => onHistory(r)} />}
                              {r.canContinue && <ActionButton tip="Continue: start the clock with this" d={ICON.play} color="#1E9E6A" fill="currentColor" onClick={() => onContinue(r)} />}
                              {r.canDelete && <ActionButton tip="Delete" d={ICON.trash} color="#c8323d" onClick={() => onDelete(r)} />}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {groups.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-5 py-[60px] text-center">
              <Icon d={ICON.clock} size={34} color="var(--faint)" width={1.8} />
              <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{emptyText}</div>
              {canAdd ? (
                <button type="button" onClick={onAdd} className={BTN_MODAL_NAVY}>
                  <Icon d={ICON.plus} size={14} color={BTN_ICON.navy} width={3} />Add time
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[13px] text-muted">Hours come from your clock. Missing time?</div>
                  <button type="button" onClick={onRequest} className={BTN_PAGE_WHITE}>
                    <Icon d={ICON.correction} size={15} color={BTN_ICON.white} width={2.2} />Request a time correction
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
