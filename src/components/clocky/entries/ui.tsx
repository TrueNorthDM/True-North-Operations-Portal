'use client'

/**
 * The small parts Time entries and Approvals share (Time Entries.dc.html):
 * line icons, the status pill, the field label, a labelled dropdown on the
 * portal's own Select, the text areas, the modal window, the close cross and
 * the toast. Sizes, colours and weights are the prototype's; the dropdown,
 * the buttons and the modal keyboard are the portal's own (Select, BTN,
 * useModal).
 */

import { useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Select, type SelectOption } from '@/components/ui/Select'
import { useModal } from '@/components/ui/useModal'
import { NAV_ICON } from '@/lib/nav/nav-icons'
import type { PillTone } from '@/lib/timeclock/clocky-types'

/** True in the browser, false while the server renders: portals only exist in the browser. */
const noop = () => () => {}
export const useIsClient = (): boolean => useSyncExternalStore(noop, () => true, () => false)

// ── Icons (line icons, 24x24, as drawn in the prototype) ────────────────────

export const ICON = {
  plus: 'M12 5v14M5 12h14',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  correction: 'M12 8v4l3 2M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  calendar: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  columns: 'M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12M18 6 6 18',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  history: NAV_ICON.history,
  play: 'M7 4.5v15l12-7.5z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
} as const

export function Icon({ d, size = 16, color = 'currentColor', width = 2, fill = 'none', className, style }: {
  d: string
  size?: number
  color?: string
  width?: number
  fill?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={width}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={{ flex: 'none', ...style }}>
      <path d={d} />
    </svg>
  )
}

// ── Pills ───────────────────────────────────────────────────────────────────

export const TONE: Record<PillTone, { bg: string; fg: string }> = {
  ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
  warn: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)' },
  bad: { bg: '#fdeeef', fg: '#c8323d' },
  neutral: { bg: 'var(--chip-neutral-bg)', fg: 'var(--chip-neutral-fg)' },
}

/** The status pill of the list (Raleway 800 10px, uppercase). */
export function Pill({ text, tone, tip, size = 'sm' }: { text: string; tone: PillTone; tip?: string; size?: 'sm' | 'md' }) {
  return (
    <span title={tip || undefined} style={{ background: TONE[tone].bg, color: TONE[tone].fg }}
      className={`font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full whitespace-nowrap ${size === 'sm' ? 'px-2 py-[3px]' : 'px-[9px] py-1'}`}>
      {text}
    </span>
  )
}

// ── Buttons the prototype draws smaller than BTN (Today, Columns, Add row) ──

export const BTN_SMALL = 'inline-flex items-center whitespace-nowrap gap-[7px] border border-slate-200 rounded-[10px] px-[13px] py-2 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] transition-colors hover:border-tn-teal'

/** The square icon buttons of the toolbar (arrows, calendar). */
export const ICON_BTN = 'w-8 h-8 border-0 bg-transparent rounded-[8px] flex items-center justify-center hover:bg-white transition-colors'

// ── Fields ──────────────────────────────────────────────────────────────────

export const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase'

export function FieldLabel({ children, warn = false }: { children: ReactNode; warn?: boolean }) {
  return <span className={`${LABEL} ${warn ? 'text-[var(--warn-fg)]' : 'text-muted'}`}>{children}</span>
}

/** The select's frame, for a select with no label above it. */
export const TRIGGER = 'h-10 px-3 bg-white border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-semibold text-[13px] tabular-nums lining-nums transition-colors hover:border-tn-teal aria-expanded:border-tn-teal aria-expanded:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'

/** A labelled dropdown: the prototype's field (label, "auto" hint) on the portal's Select. */
export function LabeledSelect({ label, value, options, onChange, placeholder = 'Choose', search = false, auto = false, disabled = false }: {
  label: string
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  placeholder?: string
  search?: boolean
  auto?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-[5px] min-w-0">
      <div className="flex items-center gap-1.5 min-h-4">
        <FieldLabel>{label}</FieldLabel>
        {auto && !!value && (
          <span title="Filled for this job, from your history or the job catalogue. You can change it."
            className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-tn-teal bg-tn-teal-soft rounded-full px-[7px] py-0.5">auto</span>
        )}
      </div>
      <Select value={value} onChange={onChange} options={options} placeholder={placeholder} searchable={search}
        fullWidth disabled={disabled} ariaLabel={label} className={TRIGGER} />
    </div>
  )
}

/** A read-only field in the same frame (the Person of an edit). */
export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[5px] min-w-0">
      <div className="flex items-center min-h-4"><FieldLabel>{label}</FieldLabel></div>
      <div className="h-10 flex items-center px-3 rounded-[10px] bg-subtle font-(family-name:--font-display) font-bold text-[13px] text-tn-ink truncate">{value}</div>
    </div>
  )
}

export const TEXTAREA = 'w-full box-border resize-y px-3 py-2.5 border rounded-[10px] font-sans text-[13px] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'
export const TEXTAREA_PLAIN = `${TEXTAREA} border-[var(--panel-border)] bg-white`
export const TEXTAREA_WARN = `${TEXTAREA} border-[#e9d48a] bg-[var(--warn-bg)]`

// ── Modal window ────────────────────────────────────────────────────────────

export function CloseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close"
      className={`w-[30px] h-[30px] flex-none border-0 bg-transparent rounded-[8px] text-muted flex items-center justify-center hover:bg-subtle transition-colors ${className}`}>
      <Icon d={ICON.close} size={17} width={2.2} />
    </button>
  )
}

/**
 * A modal over the page (the prototype's overlay at 32% navy, the card at
 * radius 16 with 22px padding). Clicking outside closes it; useModal keeps
 * the keyboard inside and Escape closes it.
 */
export function Modal({ label, width, onClose, children, alert = false, gap = 14 }: {
  label: string
  /** The prototype's max-width, which is the content's (its boxes size content-box): the padding comes on top. */
  width: number
  onClose: () => void
  children: ReactNode
  /** role="alertdialog" (the overlap fix, the delete). */
  alert?: boolean
  gap?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  // useModal leaves Escape to an open alertdialog, so one answers its own.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => { if (alert && e.key === 'Escape') { e.preventDefault(); onClose() } }
  const client = useIsClient()
  if (!client) return null
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[rgba(1,35,88,.32)] flex items-center justify-center p-5"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={label} onKeyDown={onKeyDown}
        style={{ maxWidth: width + 44, gap }}
        className="w-full max-h-full overflow-auto bg-white rounded-[16px] leading-[normal] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] p-[22px] flex flex-col">
        {children}
      </div>
    </div>,
    document.body,
  )
}

export const MODAL_TITLE = 'font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0'
/** Headings carry -0.015em from globals.css, outside the utilities' layer: the modal titles are drawn without it. */

/** The page's buttons (toolbar, empty list): white 10px 15px, navy with a small shadow; 8px gap, no letter spacing. */
export const BTN_PAGE_WHITE = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-[15px] py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-tn-teal'
export const BTN_PAGE_NAVY = 'inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[13px] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)] transition-colors hover:bg-[#0a2f6b]'

/** The entry form's Save (3E): 11px 20px with the small shadow. */
export const BTN_FORM_SAVE = 'inline-flex items-center gap-2 rounded-[10px] px-5 py-[11px] bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[13px] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)] transition-colors hover:bg-[#0a2f6b]'
/** The week grid's Save (3B-2): 10px 18px with the small shadow. */
export const BTN_GRID_SAVE = 'inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[13px] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)] transition-colors hover:bg-[#0a2f6b]'

/** The modals' white button (Cancel, Close): the prototype's 10px 16px. */
export const BTN_MODAL_WHITE = 'inline-flex items-center border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-tn-teal'
/** The modals' navy button (Submit, Approve, Save): 8px gap, no letter spacing, no shadow. */
export const BTN_MODAL_NAVY = 'inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:bg-[#0a2f6b]'
/** The white button with red words (Deny). */
export const BTN_MODAL_DANGER = 'inline-flex items-center border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-[#c8323d]'

// ── Toast ───────────────────────────────────────────────────────────────────

export interface ToastState { text: string; error?: boolean }

/** The navy toast at the foot of the page, five seconds (green check; the warning sign for a refusal). */
export function Toast({ toast }: { toast: ToastState | null }) {
  const client = useIsClient()
  if (!toast || !client) return null
  return createPortal(
    <div role="status" aria-live="polite"
      className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[90] flex items-center gap-3 bg-tn-primary text-[#ffffff] rounded-[12px] px-4 py-3 text-[13px] font-semibold leading-[1.4] shadow-[0_18px_40px_-14px_rgba(1,35,88,.6)] w-max max-w-[calc(100%-32px)]">
      {toast.error
        ? <Icon d={ICON.warn} size={16} color="#F2C40A" width={2.4} />
        : <Icon d={ICON.check} size={16} color="#1E9E6A" width={3} />}
      <span>{toast.text}</span>
    </div>,
    document.body,
  )
}

/**
 * A menu panel under a button (the calendar, the Columns menu, Add row, the Team member picker).
 * Its widths are the prototype's plus its padding and border: the prototype sizes boxes content-box.
 */
export const MENU = 'absolute z-50 bg-white border border-[var(--panel-border)] rounded-[11px] shadow-[0_18px_40px_-14px_rgba(1,35,88,.32)] flex flex-col'
