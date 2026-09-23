// Avatar: the person's photo if they have one, else their initials on a team
// colour. No hooks, so it renders in both server and client components.

import { initialsOf } from '@/lib/directory/people-types'

export function Avatar({ name, avatarUrl, size = 38, color = '#8593a4', ink = '#ffffff', dimmed = false, className = '' }: {
  name: string | null
  avatarUrl?: string | null
  size?: number
  color?: string
  /** The initials' colour. White on the team colours; navy on the rail's gold. */
  ink?: string
  dimmed?: boolean
  className?: string
}) {
  const dim = dimmed ? 'opacity-45 grayscale-[.4]' : ''
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name ?? ''} className={`shrink-0 rounded-full object-cover ${dim} ${className}`} style={{ width: size, height: size }} />
    )
  }
  const fontSize = size <= 26 ? 10 : size >= 56 ? 20 : Math.round(size * 0.34)
  return (
    <span className={`shrink-0 inline-flex items-center justify-center rounded-full font-(family-name:--font-display) font-extrabold ${dim} ${className}`} style={{ width: size, height: size, background: color, color: ink, fontSize }}>
      {initialsOf(name)}
    </span>
  )
}
