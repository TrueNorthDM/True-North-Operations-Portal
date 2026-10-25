// Avatar: the person's photo if they have one, else their initials on a team
// colour. No hooks, so it renders in both server and client components.
//
// `tone="neutral"` is the Home's look (design_handoff_home, Avatars): no team
// colour, the initials in slate on a pale grey with a hairline border, and the
// border kept around a photo too. Every other page keeps the team colours.

import { initialsOf } from '@/lib/directory/people-types'

const NEUTRAL = { background: '#eef1f5', color: '#435066', border: '1px solid #dfe4ea', boxSizing: 'border-box' } as const

export function Avatar({ name, avatarUrl, size = 38, color = '#8593a4', ink = '#ffffff', tone = 'team', dimmed = false, className = '' }: {
  name: string | null
  avatarUrl?: string | null
  size?: number
  color?: string
  /** The initials' colour. White on the team colours; navy on the rail's gold. */
  ink?: string
  /** `neutral` ignores `color` and `ink` (Home). */
  tone?: 'team' | 'neutral'
  dimmed?: boolean
  className?: string
}) {
  const dim = dimmed ? 'opacity-45 grayscale-[.4]' : ''
  const neutral = tone === 'neutral'
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name ?? ''} className={`shrink-0 rounded-full object-cover ${dim} ${className}`} style={{ width: size, height: size, ...(neutral ? { border: NEUTRAL.border, boxSizing: NEUTRAL.boxSizing } : {}) }} />
    )
  }
  // The prototype draws 10.5px initials in a 30px neutral circle: a third and a bit of the size.
  const fontSize = neutral ? Math.round(size * 0.7) / 2 : size <= 26 ? 10 : size >= 56 ? 20 : Math.round(size * 0.34)
  return (
    <span className={`shrink-0 inline-flex items-center justify-center rounded-full font-(family-name:--font-display) font-extrabold ${dim} ${className}`} style={{ width: size, height: size, fontSize, ...(neutral ? NEUTRAL : { background: color, color: ink }) }}>
      {initialsOf(name)}
    </span>
  )
}
