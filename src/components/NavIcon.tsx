// One of the rail and panel icons (lib/nav/nav-icons.ts): a 24x24 stroke path
// in currentColor, stroke 1.9 with round caps, the style of the portal's icons.

import { NAV_ICON, type NavIconKey } from '@/lib/nav/nav-icons'

export function NavIcon({ name, size = 22, strokeWidth = 1.9, className }: {
  name: NavIconKey
  size?: number
  strokeWidth?: number
  className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={NAV_ICON[name]} />
    </svg>
  )
}
