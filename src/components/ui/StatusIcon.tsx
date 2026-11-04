// A status icon (lib/ui/status-icons.ts), beside NavIcon: a 24x24 stroke path
// in its state's colour, stroke 2.2, 16px unless told otherwise; done is a
// filled green circle with a white check. `color`
// overrides the state's colour where the icon sits on a coloured ground.

import { STATUS_COLOR, STATUS_ICON, STATUS_TIP, type StatusState } from '@/lib/ui/status-icons'

/** The progress steps' done green (the review's step tracker, design handoff C3). */
const DONE_FILL = '#1E9E6A'

export function StatusIcon({ state, size = 16, strokeWidth = 2.2, color, title, className }: {
  state: StatusState
  size?: number
  strokeWidth?: number
  color?: string
  /** Hover text; the state's own word when true. */
  title?: string | true
  className?: string
}) {
  const tip = title === true ? STATUS_TIP[state] : title
  // Done is the progress steps' mark everywhere (the owner, 4 November 2026):
  // a filled green circle with a white check, not a stroked outline.
  if (state === 'done') return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={tip ? undefined : true} role={tip ? 'img' : undefined} aria-label={tip} className={`flex-none ${className ?? ''}`}>
      {tip && <title>{tip}</title>}
      <circle cx="12" cy="12" r="11" fill={color ?? DONE_FILL} />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? STATUS_COLOR[state]} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={tip ? undefined : true} role={tip ? 'img' : undefined} aria-label={tip} className={`flex-none ${className ?? ''}`}>
      {tip && <title>{tip}</title>}
      <path d={STATUS_ICON[state]} />
    </svg>
  )
}
