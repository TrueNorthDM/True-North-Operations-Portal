// A status icon (lib/ui/status-icons.ts), beside NavIcon: a 24x24 stroke path
// in its state's colour, stroke 2.2, 16px unless told otherwise. `color`
// overrides the state's colour where the icon sits on a coloured ground.

import { STATUS_COLOR, STATUS_ICON, STATUS_TIP, type StatusState } from '@/lib/ui/status-icons'

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
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? STATUS_COLOR[state]} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={tip ? undefined : true} role={tip ? 'img' : undefined} aria-label={tip} className={`flex-none ${className ?? ''}`}>
      {tip && <title>{tip}</title>}
      <path d={STATUS_ICON[state]} />
    </svg>
  )
}
