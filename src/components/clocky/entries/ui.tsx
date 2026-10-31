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
import { MODAL_BACKDROP, MODAL_PANEL, MODAL_TITLE } from '@/lib/ui/modal'
import { BTN } from '@/lib/ui/buttons'
import { TEXTAREA as FIELD_TEXTAREA, TEXTAREA_SHAPE } from '@/lib/ui/fields'
import { FIELD_LABEL_TYPE } from '@/lib/ui/type'
import { NAV_ICON } from '@/lib/nav/nav-icons'

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

/** The status pill of the list: the portal's one pill (components/ui/Pill), on the badge tokens. */
export { Pill } from '@/components/ui/Pill'

// ── Buttons: aliases of lib/ui/buttons.ts, the portal's only button source ──

/** The compact white button (Today, Columns, Add row). */
export const BTN_SMALL = BTN.smallWhite

/** The square icon buttons of the toolbar (arrows, calendar). */
export const ICON_BTN = BTN.icon

// ── Fields ──────────────────────────────────────────────────────────────────

/** The field label's type (lib/ui/type.ts), coloured by FieldLabel. */
export const LABEL = FIELD_LABEL_TYPE

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

/** The portal's textarea (lib/ui/fields.ts), full width; the warn one tinted for a required reason. */
export const TEXTAREA = `w-full ${TEXTAREA_SHAPE}`
export const TEXTAREA_PLAIN = `w-full ${FIELD_TEXTAREA}`
export const TEXTAREA_WARN = `${TEXTAREA} border-[#e9d48a] bg-[var(--warn-bg)]`

/** Why a Save or Send was refused, right above the buttons pressed (a tall form is scrolled to its foot). */
export function SaveError({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="alert" className="flex gap-2.5 items-center rounded-[11px] bg-[#fdeeef] border border-[#f3c6ca] px-3.5 py-3 text-[13.5px] text-[#c8323d] font-bold">
      <Icon d={ICON.warn} size={17} />{text}
    </div>
  )
}

// ── Modal window ────────────────────────────────────────────────────────────

export function CloseButton({ onClick, className = '', label = 'Close' }: { onClick: () => void; className?: string; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className={`${BTN.icon} ${className}`}>
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
    <div className={`fixed inset-0 z-[70] ${MODAL_BACKDROP} flex items-center justify-center p-5`}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} role={alert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={label} onKeyDown={onKeyDown}
        style={{ maxWidth: width + 44, gap }}
        className={`w-full max-h-full overflow-auto ${MODAL_PANEL} leading-[normal] p-[22px] flex flex-col`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** The modal title lives in lib/ui/modal.ts with the overlay and the card; North Time imports it from here. */
export { MODAL_TITLE }

/** The page's buttons (toolbar, empty list). */
export const BTN_PAGE_WHITE = BTN.white
export const BTN_PAGE_NAVY = BTN.navy

/** The entry form's Save and the week grid's Save. */
export const BTN_FORM_SAVE = BTN.navy
export const BTN_GRID_SAVE = BTN.navy

/** The modals' buttons: Cancel / Close, Submit / Approve / Save, and the red-worded Deny. */
export const BTN_MODAL_WHITE = BTN.white
export const BTN_MODAL_NAVY = BTN.navy
export const BTN_MODAL_DANGER = BTN.whiteDanger

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
