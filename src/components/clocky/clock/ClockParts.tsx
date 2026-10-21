'use client'

/**
 * The small pieces the clock panel and Who's working share (Clock Panel.dc.html
 * and Who's Working.dc.html): the line icons at the prototype's sizes and
 * strokes, the pulsing dot, the uppercase section label, the labelled dropdown
 * (the portal's Select, with the prototype's label row and "auto" hint), the
 * search input, the combination row and the toast.
 */

import type { ReactNode, RefObject } from 'react'
import { Select } from '@/components/ui/Select'

// ── Icons ───────────────────────────────────────────────────────────────────

export const ICON = {
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  play: 'M7 4.5v15l12-7.5z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  back: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6 6 18',
  offline: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.1-1.5M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 11 5M12 20h.01',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  folder: 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  calendar: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 12l5 5 9-10',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  openPage: 'M14 4h6v6M20 4l-8 8M10 5H5v14h14v-5',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  list: 'M4 6h16M4 12h16M4 18h10',
} as const

/** A 24x24 line icon, sized and stroked as the prototype draws it. */
export function Icon({ d, size = 16, stroke = 'currentColor', sw = 2, fill = 'none', cap = 'round', join = 'round', className, style }: {
  d: string
  size?: number
  stroke?: string
  sw?: number
  fill?: string
  cap?: 'round' | 'butt'
  join?: 'round' | 'miter' | null
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={fill !== 'none' && stroke === 'currentColor' ? 'none' : stroke} strokeWidth={sw}
      strokeLinecap={cap} strokeLinejoin={join ?? undefined} aria-hidden="true" className={className} style={style}>
      <path d={d} />
    </svg>
  )
}

/** The filled triangle on Clock in and the combination rows. */
export const PlayIcon = ({ size = 14, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" className="shrink-0"><path d={ICON.play} /></svg>
)

/** The filled square on Clock out. */
export const StopIcon = ({ size = 13, color }: { size?: number; color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" className="shrink-0"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
)

// ── The dot ─────────────────────────────────────────────────────────────────

/** The pulse of a running clock (the prototype's ck-pulse), still under reduced motion. */
const PULSE_CSS = '@keyframes ck-pulse{0%{box-shadow:0 0 0 0 rgba(30,158,106,.55)}100%{box-shadow:0 0 0 8px rgba(30,158,106,0)}}.ck-pulse{animation:ck-pulse 1.8s ease-out infinite}@media (prefers-reduced-motion:reduce){.ck-pulse{animation:none}}'

export function ClockDot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <>
      {pulse && <style href="ck-pulse" precedence="default">{PULSE_CSS}</style>}
      <span aria-hidden="true" className={`shrink-0 w-[9px] h-[9px] rounded-full ${pulse ? 'ck-pulse' : ''}`} style={{ background: color }} />
    </>
  )
}

// ── Type ────────────────────────────────────────────────────────────────────

/** The uppercase label over a section: Raleway 800 10.5px, .08em, muted. */
export function SectionLabel({ children, className = 'text-muted', inline = false }: {
  children: ReactNode
  className?: string
  /** Inline in its line, as the prototype sets "Recent" (the line keeps the body's height). */
  inline?: boolean
}) {
  return <span className={`${inline ? '' : 'block '}font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase ${className}`}>{children}</span>
}

/** A teal text button: Manage, Browse, Change. */
export const LINK_BTN = 'border-0 bg-transparent cursor-pointer p-0 text-[12.5px] font-semibold text-tn-teal hover:text-tn-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tn-teal'

/** The prototype's focus ring on every button: teal, 2px, offset 2px. */
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tn-teal'

/** An input's focus: a teal border and a soft teal ring. */
export const INPUT_FOCUS = 'outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'

/** The red-filled confirm (Clock out): the prototype's 11px 18px, 8px gap, no letter spacing. */
export const BTN_DANGER = 'inline-flex items-center gap-2 bg-[#c8323d] text-[#ffffff] rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] hover:brightness-110'

/** The panel's white button (Cancel, Save as combination, Keep): 10px 16px, 8px gap, no letter spacing. */
export const CK_BTN_WHITE = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-tn-teal'

/** The panel's navy button (Clock in, Keep going, Confirm, Save combination): 11px 18px with the small shadow. */
export const CK_BTN_NAVY = 'inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)] transition-colors hover:bg-[#0a2f6b]'

/** The navy button of a confirm step (Switch beside Cancel): no shadow. */
export const CK_BTN_NAVY_FLAT = 'inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:bg-[#0a2f6b]'

/** The white button with red words and a red symbol (Clock out now). */
export const BTN_WHITE_DANGER = CK_BTN_WHITE.replace('text-tn-ink', 'text-[#c8323d]').replace('hover:border-tn-teal', 'hover:border-[#c8323d]')

/** The small round close / back / refresh buttons in a panel header. */
export function HeadButton({ label, onClick, size = 30, title, children, className = '' }: {
  label: string; onClick: () => void; size?: 30 | 32; title?: string; children: ReactNode; className?: string
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={title}
      className={`shrink-0 flex items-center justify-center border-0 bg-transparent rounded-[8px] cursor-pointer text-muted hover:bg-subtle hover:text-tn-ink ${FOCUS} ${size === 30 ? 'w-[30px] h-[30px]' : 'w-8 h-8'} ${className}`}>
      {children}
    </button>
  )
}

// ── Fields ──────────────────────────────────────────────────────────────────

/**
 * A dropdown with the prototype's label row (Select.dc.html): the uppercase
 * label, the "auto" hint when the value came from the job's history, and a
 * warning. The dropdown itself is the portal's Select.
 */
export function ClockField({ label, value, options, onChange, search = false, auto = false, placeholder = 'Choose', warn, compact = false, ariaLabel }: {
  label?: string
  value: string
  options: readonly (string | { value: string; label: string })[]
  onChange: (v: string) => void
  search?: boolean
  auto?: boolean
  placeholder?: string
  warn?: string
  compact?: boolean
  ariaLabel?: string
}) {
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o))
  const has = value !== ''
  return (
    <div className="relative flex flex-col gap-[5px] min-w-0">
      {label && (
        <div className="flex items-center gap-1.5 min-h-4">
          <SectionLabel>{label}</SectionLabel>
          {auto && has && (
            <span title="Filled for this job, from your history or the job catalogue. You can change it." className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.06em] uppercase text-tn-teal bg-tn-teal-soft rounded-full px-[7px] py-[2px]">auto</span>
          )}
          {warn && <span className="text-[11px] font-semibold text-[#8a6d1a]">{warn}</span>}
        </div>
      )}
      <Select
        value={value}
        onChange={onChange}
        options={opts}
        placeholder={placeholder}
        searchable={search}
        fullWidth
        ariaLabel={ariaLabel ?? label}
        className={`${compact ? 'h-[34px]' : 'h-10'} px-3 bg-white border rounded-[10px] cursor-pointer font-(family-name:--font-display) font-semibold text-[13px] tabular-nums lining-nums hover:border-tn-teal aria-expanded:border-tn-teal aria-expanded:shadow-[0_0_0_3px_rgba(30,125,127,.15)] ${warn ? 'border-[#e9d48a]' : 'border-[var(--panel-border)]'} ${FOCUS}`}
      />
    </div>
  )
}

/** A search input with the magnifier inside (42px off the clock, 40px under Switch to, 36px in Who's working). */
export function SearchInput({ value, onChange, placeholder, height, iconTop, iconLeft = 12, iconSize = 16, padLeft = 36, fontSize = 13.5, autoFocus, inputRef, ariaLabel }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  height: number
  iconTop: number
  iconLeft?: number
  iconSize?: number
  padLeft?: number
  fontSize?: number
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  ariaLabel?: string
}) {
  return (
    <div className="relative">
      <Icon d={ICON.search} size={iconSize} stroke="#8593a4" sw={2} join={null} className="absolute pointer-events-none" style={{ left: iconLeft, top: iconTop }} />
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoFocus={autoFocus}
        onFocus={e => { const n = e.currentTarget.value.length; e.currentTarget.setSelectionRange(n, n) }}
        className={`w-full box-border pr-3 border border-[var(--panel-border)] rounded-[10px] bg-white text-tn-ink placeholder:text-muted ${INPUT_FOCUS}`}
        style={{ height, paddingLeft: padLeft, fontSize }}
      />
    </div>
  )
}

// ── Rows ────────────────────────────────────────────────────────────────────

/**
 * A combination row: the star (saved, or save this one), the name over its
 * job, and the action symbol. The whole row clocks in (or switches); the star
 * is its own button.
 */
/**
 * Whether the screen is a phone. 'css' in the app: the phone and desktop
 * differences are written as responsive classes (under 768px vs md up), so
 * the first paint is already right; true/false where a frame fixes the size
 * (design checks). byWidth picks the class string for each case.
 */
export type Phone = boolean | 'css'
export const byWidth = (phone: Phone, onPhone: string, onDesktop: string, css: string) =>
  phone === 'css' ? css : phone ? onPhone : onDesktop

export function ChoiceRowView({ title, sub, saved, phone, action, actionLabel, onGo, onStar, disabled }: {
  title: string
  sub: string
  saved: boolean
  phone: Phone
  action: 'play' | 'swap'
  actionLabel: string
  onGo: () => void
  /** Recent rows only: save it as a combination. */
  onStar?: () => void
  disabled?: boolean
}) {
  return (
    <div className={`group relative flex items-center gap-2.5 rounded-[11px] hover:bg-[var(--row-hover)] ${byWidth(phone, 'py-[13px] px-2.5', 'py-[9px] px-2', 'py-[13px] px-2.5 md:py-[9px] md:px-2')}`}>
      {/* A saved combination's star is only a mark (Manage changes it); a recent row's star saves it. */}
      {saved ? (
        <span title="Saved combination" className="relative z-[1] shrink-0 w-[26px] h-[26px] rounded-[7px] flex items-center justify-center">
          <Icon d={ICON.star} size={16} fill="#F2C40A" stroke="#d9a400" sw={1.8} cap="butt" />
        </span>
      ) : (
        <button type="button" onClick={onStar} title="Save as combination" aria-label={`Save ${title} as a combination`}
          className={`relative z-[1] shrink-0 w-[26px] h-[26px] border-0 bg-transparent p-0 rounded-[7px] flex items-center justify-center hover:bg-subtle cursor-pointer ${FOCUS}`}>
          <Icon d={ICON.star} size={16} fill="none" stroke="#8593a4" sw={1.8} cap="butt" />
        </button>
      )}
      <button type="button" onClick={onGo} disabled={disabled} title={action === 'play' ? 'Clock in with this' : 'Switch to this'} aria-label={`${actionLabel} ${title}`}
        className={`flex-1 min-w-0 flex items-center gap-2.5 border-0 bg-transparent p-0 text-left cursor-pointer disabled:cursor-wait after:absolute after:inset-0 after:rounded-[11px] after:content-[''] ${FOCUS}`}>
        <span className="flex-1 min-w-0">
          <span className="block font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink truncate">{title}</span>
          <span className="block text-[12px] text-muted mt-0.5 truncate">{sub}</span>
        </span>
        {action === 'play'
          ? <PlayIcon size={14} color="#1E9E6A" />
          : <Icon d={ICON.swap} size={17} stroke="#1E9E6A" sw={2} className="shrink-0" />}
      </button>
    </div>
  )
}

// ── The toast ───────────────────────────────────────────────────────────────

export function ClockToast({ text, error, onUndo, contained, phone }: { text: string; error?: boolean; onUndo?: () => void; contained?: boolean; phone?: Phone }) {
  return (
    // In the app the height follows the window width in CSS, so it is right
    // from the first paint. On a phone it sits about 8px above the big Clock in
    // button and is wider than it, so the two read as two things (owner,
    // 19 October 2026); 24px from the bottom from md up.
    <div role="status" style={contained ? { bottom: phone === true ? 140 : 24 } : undefined}
      className={`${contained ? 'absolute' : 'fixed bottom-[140px] md:bottom-6'} left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 bg-tn-primary text-[#ffffff] rounded-[12px] px-4 py-3 text-[13px] font-semibold leading-[1.4] shadow-[0_18px_40px_-14px_rgba(1,35,88,.6)] w-max max-w-[calc(100%-16px)] md:max-w-[calc(100%-32px)] tabular-nums lining-nums`}>
      {/* A failure (an Undo refused) never wears the green check. */}
      {error
        ? <Icon d={ICON.warn} size={16} stroke="#F2C40A" sw={2.4} className="shrink-0" />
        : <Icon d={ICON.check} size={16} stroke="#1E9E6A" sw={3} className="shrink-0" />}
      <span>{text}</span>
      {onUndo && (
        <button type="button" onClick={onUndo} className={`border-0 bg-transparent text-[#F2C40A] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer pl-1 ${FOCUS}`}>Undo</button>
      )}
    </div>
  )
}
