'use client'

/**
 * 3B, the week grid (Time Entries.dc.html, frames 3B1, 3B2, 3B3): one row per
 * combination used in the week (job and Activity), Sunday to Saturday and the
 * total. Read only for a User. A leader types hours for the people they
 * manage ("2:30" or "2.5", rounded to the quarter hour on Save, with a
 * reason); cells with a clock come from clocked entries; a day over 24 hours
 * turns red and stops Save. No "Copy last week" (removed 16 October 2026).
 */

import { BTN_ICON } from '@/lib/ui/buttons'
import { dayLabel, weekdayShort } from '@/lib/timeclock/format'
import { formatClock } from '@/lib/timeclock/rounding'
import type { ClockChoice } from '@/lib/timeclock/clocky-types'
import { useOutside } from './EntriesList'
import { gridEditKey, gridRowKey, type GridModel, type GridSource } from './model'
import { BTN_GRID_SAVE, BTN_SMALL, Icon, ICON, LABEL, MENU } from './ui'

const COLS = 'minmax(250px,1fr) repeat(7,86px) 90px'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const md = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

export function WeekGrid({ who, days, today, model, editable, combos, onOpenAdd, addRowOpen, setAddRowOpen, onAddRow, onType, onSave }: {
  who: string
  days: string[]
  today: string
  model: GridModel
  editable: boolean
  /** A TSheets week's Add row: the person's saved combinations. */
  combos: readonly ClockChoice[]
  /** A week on the 2026 structure: Add row opens the picker of Add time (GridRowPick) instead. */
  onOpenAdd?: () => void
  addRowOpen: boolean
  setAddRowOpen: (open: boolean) => void
  onAddRow: (s: GridSource) => void
  onType: (key: string, text: string) => void
  onSave: () => void
}) {
  const menu = useOutside(addRowOpen, () => setAddRowOpen(false))
  const seen = new Set(model.rows.map(r => r.key))
  const options = combos.filter(c => c.name && !seen.has(gridRowKey(c.jobcodeId, c.activity)))
  const error = model.error
  const anyBad = model.bad.some(Boolean)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink mr-1.5">{who} · {dayLabel(days[0])} to {dayLabel(days[6])}</span>
        {editable ? (
          <>
            <div className="relative" ref={menu}>
              <button type="button" onClick={() => (onOpenAdd ? onOpenAdd() : setAddRowOpen(!addRowOpen))} aria-expanded={onOpenAdd ? undefined : addRowOpen} className={BTN_SMALL}>
                <Icon d={ICON.plus} size={13} color={BTN_ICON.white} width={3} />Add row
              </button>
              {addRowOpen && !onOpenAdd && (
                <div className={`${MENU} top-10 left-0 w-max min-w-[314px] max-w-[min(480px,calc(100vw-32px))] p-1.5 gap-px`}>
                  <div className={`${LABEL} text-muted px-2.5 pt-1.5 pb-1`}>Add a combination</div>
                  {options.map(c => (
                    <button key={`${c.combinationId}`} type="button"
                      onClick={() => onAddRow({ key: gridRowKey(c.jobcodeId, c.activity), jobcodeId: c.jobcodeId, path: c.path, activity: c.activity, fields: c.fields })}
                      className="flex flex-col gap-0.5 border-0 text-left rounded-[8px] px-2.5 py-2 bg-transparent hover:bg-subtle">
                      <span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink">{c.name}</span>
                      <span className="text-[11.5px] text-muted">{c.path} · {c.activity}</span>
                    </button>
                  ))}
                  {options.length === 0 && <div className="px-2.5 py-2 text-[12.5px] text-muted">Every saved combination is already a row.</div>}
                </div>
              )}
            </div>
            <span className="flex-1" />
            <button type="button" onClick={onSave} disabled={anyBad}
              className={`${BTN_GRID_SAVE} disabled:opacity-45 disabled:cursor-not-allowed`}>
              <Icon d={ICON.check} size={14} color={BTN_ICON.navy} width={3} />Save
            </button>
          </>
        ) : (
          <span className="inline-flex items-center gap-[7px] text-[12.5px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-[10px] px-3 py-2">
            <Icon d={ICON.lock} size={14} />Read only. Hours come from your clock.
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="flex gap-2.5 items-center rounded-[11px] bg-[#fdeeef] border border-[#f3c6ca] px-3 py-2.5 text-[13px] text-[#c8323d] font-bold">
          <Icon d={ICON.warn} size={17} />{error}
        </div>
      )}

      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
        <div className="min-w-[980px]">
          <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: COLS }}>
            <div className={`px-3 py-2.5 ${LABEL} text-muted`}>Combination</div>
            {days.map((d, i) => {
              const fg = model.bad[i] ? '#c8323d' : d === today ? 'var(--color-tn-teal)' : 'var(--muted)'
              const locked = model.rows.some(r => r.cells[i]?.locked)
              return (
                <div key={d} className="px-2.5 py-2 text-right flex flex-col items-end gap-px" style={{ background: model.bad[i] ? '#fdeeef' : 'transparent' }}>
                  <span className={`flex items-center gap-1 ${LABEL}`} style={{ color: fg }}>
                    {locked && <Icon d={ICON.lock} size={11} width={2.4} />}{weekdayShort(d)}
                  </span>
                  <span className="text-[11.5px] tabular-nums lining-nums" style={{ color: fg }}>{md(d)}</span>
                </div>
              )
            })}
            <div className={`px-3 py-2.5 text-right ${LABEL} text-muted`}>Total</div>
          </div>
          {model.rows.map(r => (
            <div key={r.key} className="grid items-center border-b border-[var(--row-rule)]" style={{ gridTemplateColumns: COLS }}>
              <div className="px-3 py-[9px] min-w-0">
                <div className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink truncate">{r.source.path}</div>
                <div className={`text-[11.5px] mt-0.5 ${r.source.activity ? 'text-muted' : 'text-[var(--warn-fg)]'}`}>{r.source.activity || 'Activity missing'}</div>
              </div>
              {r.cells.map((c, i) => {
                const over = model.bad[i] === 'over'
                const bg = over ? '#fdeeef' : c.locked ? 'var(--subtle)' : 'transparent'
                return (
                  <div key={c.date} className="px-1.5 py-[5px]" style={{ background: bg }}>
                    {c.ro ? (
                      <div title={c.locked ? 'Locked' : 'From clocked entries'}
                        className={`h-[34px] flex items-center justify-end gap-[5px] px-2 text-[13px] font-semibold tabular-nums lining-nums ${c.locked ? 'text-muted' : 'text-foreground'}`}>
                        {c.clock && <Icon d={ICON.clock} size={12} color="var(--muted)" width={2.4} />}{c.text}
                      </div>
                    ) : (
                      <input value={c.text} onChange={e => onType(gridEditKey(r.key, c.date), e.target.value)}
                        aria-label={`${r.source.path}, ${dayLabel(c.date)}`} placeholder="0:00"
                        className={`w-full box-border h-[34px] text-right px-2 border rounded-[8px] font-sans text-[13px] font-semibold text-tn-ink outline-none bg-white tabular-nums lining-nums focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] ${c.invalid || over ? 'border-[#c8323d]' : 'border-[var(--panel-border)]'}`} />
                    )}
                  </div>
                )
              })}
              <div className="px-3 py-[9px] text-right font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink tabular-nums lining-nums">{formatClock(r.total)}</div>
            </div>
          ))}
          <div className="grid items-center bg-[var(--row-hover)]" style={{ gridTemplateColumns: COLS }}>
            <div className="px-3 py-[11px] font-(family-name:--font-display) font-extrabold text-[12px] text-tn-ink">Day total</div>
            {model.dayTotals.map((t, i) => (
              <div key={days[i]} className="px-3 py-[11px] text-right font-bold text-[13px] tabular-nums lining-nums" style={{ color: model.bad[i] === 'over' ? '#c8323d' : 'var(--color-tn-ink)' }}>{formatClock(t)}</div>
            ))}
            <div className="px-3 py-[11px] text-right font-(family-name:--font-display) font-black text-[14px] text-tn-ink tabular-nums lining-nums">{formatClock(model.week)}</div>
          </div>
        </div>
      </div>
      <div className="text-[12px] text-muted leading-normal">
        {editable
          ? 'Type "2:30" or "2.5"; hours round to the nearest 15 minutes when you save. Cells with a clock come from clocked entries; change those in the List or the Day timeline. Saving asks for a reason.'
          : 'Hours come from your clock. To fix an entry, open it in the List; to add time, ask your Team Leader.'}
      </div>
    </>
  )
}
