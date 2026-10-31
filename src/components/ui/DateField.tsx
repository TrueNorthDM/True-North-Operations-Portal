'use client'

/**
 * The portal's date field (owner, 31 October 2026): one look for every date,
 * instead of each browser's own calendar. Closed, it looks like the portal's
 * menus (ui/Select) with the day written out ("Sun, Nov 8, 2026") and a
 * calendar icon; open, a month like the Agenda's small one: the chosen day in
 * navy, today ringed in teal, days outside min/max struck through, Today and
 * (when the field may be empty) Clear at the foot.
 *
 * Keyboard: Enter, Space or Down open it; the arrows move the day (Page Up and
 * Page Down the month), Enter picks, Escape closes. Values are "YYYY-MM-DD",
 * '' for none, like <input type="date">.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DATE_FIELD_CLASS } from '@/lib/ui/fields'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = MONTHS.map(m => m.slice(0, 3))

const D = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const add = (day: string, n: number) => iso(new Date(D(day).getTime() + n * 864e5))
const addMonths = (day: string, n: number) => {
  const d = D(day), y = d.getUTCFullYear(), m = d.getUTCMonth() + n
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return iso(new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last))))
}
const localToday = () => { const n = new Date(); return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))) }

/** "Sun, Nov 8, 2026". */
export function dateLabel(day: string): string {
  const d = D(day)
  return `${WD[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

/** The six-or-fewer weeks drawn for the month holding `day`, Sunday first. Pure. */
export function monthGrid(day: string): string[] {
  const first = `${day.slice(0, 7)}-01`, start = add(first, -D(first).getUTCDay())
  const next = addMonths(first, 1), out: string[] = []
  for (let d = start; d < next || D(d).getUTCDay() !== 0; d = add(d, 1)) out.push(d)
  return out
}

/**
 * Where an open popover sits: under its field, or above it when there is no
 * room below; it follows scrolling and closes on a click outside.
 */
function usePlaced(open: boolean, btn: React.RefObject<HTMLButtonElement | null>, pop: React.RefObject<HTMLDivElement | null>, close: () => void, height: number) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r) return
      const below = window.innerHeight - r.bottom, flip = below < height + 12 && r.top > below
      setPos({ ...(flip ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }), left: Math.max(8, Math.min(r.left, window.innerWidth - 288)) })
    }
    place()
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !pop.current?.contains(t)) close() }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    document.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); document.removeEventListener('mousedown', onDown) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return open ? pos : null
}

const POPOVER = 'z-[9999] w-[280px] box-border bg-white border border-[var(--panel-border)] rounded-[14px] p-3 shadow-[0_20px_44px_-18px_rgba(1,35,88,.5)]'
const ARROW = 'w-8 h-8 border-0 rounded-[8px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle'
const Chevron = ({ d }: { d: string }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const CalIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-[#5b6b82]"><path d="M4 5h16v16H4zM4 10h16M9 3v4M15 3v4" /></svg>

/** The official closed look: the portal's field (lib/ui/fields.ts), full width. */
export const DATE_FIELD = `${DATE_FIELD_CLASS} w-full`

export function DateField({ value, onChange, min, max, ariaLabel, placeholder = 'Pick a day', clearable = false, disabled = false, className = DATE_FIELD, id }: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  ariaLabel?: string
  placeholder?: string
  /** Clear at the foot, for a field that may be left empty. */
  clearable?: boolean
  disabled?: boolean
  /** The closed field's box (height, width, border, corners); DATE_FIELD when left out. */
  className?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(value || localToday())
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const today = localToday()
  const ok = (d: string) => (!min || d >= min) && (!max || d <= max)

  const show = () => { if (disabled) return; setCursor(value || (ok(today) ? today : min ?? max ?? today)); setOpen(true) }
  const pick = (d: string) => { if (!ok(d)) return; onChange(d); setOpen(false); btn.current?.focus() }

  const pos = usePlaced(open, btn, pop, () => setOpen(false), 330)

  // The focused day follows the cursor, so the arrow keys read out where they are.
  useEffect(() => {
    if (open && pos) pop.current?.querySelector<HTMLElement>(`[data-day="${cursor}"]`)?.focus({ preventScroll: true })
  }, [open, pos, cursor])

  const onKey = (e: React.KeyboardEvent) => {
    const move: Record<string, () => string> = {
      ArrowLeft: () => add(cursor, -1), ArrowRight: () => add(cursor, 1), ArrowUp: () => add(cursor, -7), ArrowDown: () => add(cursor, 7),
      PageUp: () => addMonths(cursor, -1), PageDown: () => addMonths(cursor, 1),
    }
    if (move[e.key]) { e.preventDefault(); setCursor(move[e.key]()) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(cursor) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.current?.focus() }
  }

  const month = cursor.slice(0, 7)
  const popover = open && pos ? createPortal(
    <div ref={pop} role="dialog" aria-label={ariaLabel ? `${ariaLabel}: pick a day` : 'Pick a day'} onKeyDown={onKey}
      style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left }}
      className={POPOVER}>
      <div className="flex items-center justify-between mb-1.5">
        <button type="button" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))} className="w-8 h-8 border-0 rounded-[8px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink" aria-live="polite">{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
        <button type="button" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))} className="w-8 h-8 border-0 rounded-[8px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 text-center" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="py-1 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] text-muted">{d}</span>)}
      </div>
      <div className="grid grid-cols-7" role="grid">
        {monthGrid(cursor).map(d => {
          const can = ok(d), sel = d === value, now = d === today, inMonth = d.startsWith(month)
          return (
            <button key={d} type="button" data-day={d} tabIndex={d === cursor ? 0 : -1} disabled={!can} aria-label={dateLabel(d)} aria-pressed={sel} aria-current={now ? 'date' : undefined}
              onClick={() => pick(d)} className="h-[34px] border-0 bg-transparent p-0 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed group focus:outline-none">
              <span className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[12.5px] font-bold tabular-nums lining-nums group-focus-visible:ring-2 group-focus-visible:ring-tn-teal ${
                sel ? 'bg-tn-primary text-[#ffffff]'
                : !can ? 'text-[#cbd2da] line-through'
                : now ? 'text-tn-teal shadow-[inset_0_0_0_1.5px_var(--color-tn-teal)] group-hover:bg-tn-teal-soft'
                : inMonth ? 'text-tn-ink group-hover:bg-tn-teal-soft' : 'text-[#cbd2da] group-hover:bg-subtle'}`}>{Number(d.slice(8))}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between border-t border-[#f1f3f6] mt-2 pt-2.5">
        <button type="button" disabled={!ok(today)} onClick={() => pick(today)} className="border-0 bg-transparent p-0 cursor-pointer font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline">Today</button>
        {clearable && <button type="button" onClick={() => { onChange(''); setOpen(false); btn.current?.focus() }} className="border-0 bg-transparent p-0 cursor-pointer font-(family-name:--font-display) font-extrabold text-[12.5px] text-muted hover:text-tn-ink">Clear</button>}
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button ref={btn} id={id} type="button" disabled={disabled} aria-label={ariaLabel ? `${ariaLabel}${value ? `, ${dateLabel(value)}` : ''}` : undefined}
        aria-haspopup="dialog" aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={e => { if (!open && e.key === 'ArrowDown') { e.preventDefault(); show() } }}
        className={`${className} box-border inline-flex items-center gap-2.5 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${open ? '!border-tn-teal shadow-[0_0_0_3px_rgba(30,125,127,.15)]' : 'hover:border-tn-teal'}`}>
        <span className={`flex-1 min-w-0 truncate tabular-nums lining-nums ${value ? 'text-tn-ink font-semibold' : 'text-muted'}`}>{value ? dateLabel(value) : placeholder}</span>
        <CalIcon />
      </button>
      {popover}
    </>
  )
}

/** "Nov 2026" for "2026-11". */
export function monthLabel(month: string): string {
  return `${MON[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
}

/**
 * The month field, the date field's sibling (owner, 31 October 2026): the
 * same closed look, and a year of months when open (the chosen one navy, this
 * month ringed, the ones outside min/max struck through). Values "YYYY-MM".
 */
export function MonthField({ value, onChange, min, max, ariaLabel, placeholder = 'Pick a month', disabled = false, className = DATE_FIELD }: {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const now = localToday().slice(0, 7)
  const [year, setYear] = useState(Number((value || now).slice(0, 4)))
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const pos = usePlaced(open, btn, pop, () => setOpen(false), 240)
  const ok = (m: string) => (!min || m >= min) && (!max || m <= max)
  const pick = (m: string) => { if (!ok(m)) return; onChange(m); setOpen(false); btn.current?.focus() }
  useEffect(() => {
    if (open && pos) pop.current?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-current="date"]')?.focus({ preventScroll: true })
  }, [open, pos])

  const popover = open && pos ? createPortal(
    <div ref={pop} role="dialog" aria-label={ariaLabel ? `${ariaLabel}: pick a month` : 'Pick a month'} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btn.current?.focus() } }}
      style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left }} className={POPOVER}>
      <div className="flex items-center justify-between mb-2">
        <button type="button" aria-label="Previous year" onClick={() => setYear(y => y - 1)} className={ARROW}><Chevron d="M15 18l-6-6 6-6" /></button>
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink tabular-nums lining-nums" aria-live="polite">{year}</span>
        <button type="button" aria-label="Next year" onClick={() => setYear(y => y + 1)} className={ARROW}><Chevron d="M9 6l6 6-6 6" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MON.map((name, i) => {
          const m = `${year}-${String(i + 1).padStart(2, '0')}`, can = ok(m), sel = m === value, cur = m === now
          return (
            <button key={m} type="button" disabled={!can} aria-pressed={sel} aria-current={cur ? 'date' : undefined} aria-label={`${MONTHS[i]} ${year}`} onClick={() => pick(m)}
              className={`h-9 border-0 rounded-[9px] text-[12.5px] font-bold cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal ${
                sel ? 'bg-tn-primary text-[#ffffff]'
                : !can ? 'bg-transparent text-[#cbd2da] line-through'
                : cur ? 'bg-transparent text-tn-teal shadow-[inset_0_0_0_1.5px_var(--color-tn-teal)] hover:bg-tn-teal-soft'
                : 'bg-transparent text-tn-ink hover:bg-tn-teal-soft'}`}>{name}</button>
          )
        })}
      </div>
      <div className="flex items-center border-t border-[#f1f3f6] mt-2 pt-2.5">
        <button type="button" disabled={!ok(now)} onClick={() => pick(now)} className="border-0 bg-transparent p-0 cursor-pointer font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline">This month</button>
      </div>
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button ref={btn} type="button" disabled={disabled} aria-label={ariaLabel ? `${ariaLabel}${value ? `, ${monthLabel(value)}` : ''}` : undefined}
        aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { if (open) { setOpen(false); return } if (!disabled) { setYear(Number((value || now).slice(0, 4))); setOpen(true) } }}
        className={`${className} box-border inline-flex items-center gap-2.5 text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${open ? '!border-tn-teal shadow-[0_0_0_3px_rgba(30,125,127,.15)]' : 'hover:border-tn-teal'}`}>
        <span className={`flex-1 min-w-0 truncate tabular-nums lining-nums ${value ? 'text-tn-ink font-semibold' : 'text-muted'}`}>{value ? monthLabel(value) : placeholder}</span>
        <CalIcon />
      </button>
      {popover}
    </>
  )
}
