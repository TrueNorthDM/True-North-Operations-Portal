// TenureBadge: the anniversary medallion. A YEAR milestone (1–20) is a solid
// coloured medal with the year number; a QUARTER milestone (3/6/9 months) is a
// lighter progress ring filling toward the first year. Pure presentational, no
// hooks, so it renders in server and client components alike.

import type { Milestone } from '@/lib/tenure'

const TEAL = '#1E7D7F'

export function TenureBadge({ milestone, size = 56 }: { milestone: Milestone; size?: number }) {
  if (milestone.kind === 'none') return null

  if (milestone.kind === 'year') {
    const c = milestone.color
    // Alternate solid (even years) / outline (odd years) so adjacent years,
    // which can share a similar palette hue, always read as distinct badges.
    const solid = milestone.value % 2 === 0
    const ink = solid ? '#ffffff' : c
    return (
      <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
          {solid ? (
            <>
              <circle cx="28" cy="28" r="26" fill={c} />
              <circle cx="28" cy="28" r="21.5" fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.5" />
            </>
          ) : (
            <>
              <circle cx="28" cy="28" r="25.5" fill={`${c}1f`} stroke={c} strokeWidth="2.75" />
              <circle cx="28" cy="28" r="21" fill="none" stroke={c} strokeWidth="1" strokeOpacity="0.35" />
            </>
          )}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="font-(family-name:--font-display) font-extrabold" style={{ color: ink, fontSize: size * 0.42 }}>{milestone.value}</span>
          <span className="font-(family-name:--font-display) font-extrabold uppercase tracking-wide" style={{ color: ink, fontSize: size * 0.135, marginTop: size * 0.02 }}>
            {milestone.value === 1 ? 'year' : 'years'}
          </span>
        </span>
      </span>
    )
  }

  // Quarter: a progress ring (1/4, 2/4, 3/4) building toward the first year.
  const r = 24
  const circ = 2 * Math.PI * r
  const filled = (milestone.value / 4) * circ
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`${milestone.value * 3} months of service`}>
      <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke={`${TEAL}22`} strokeWidth="3.5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={TEAL} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-(family-name:--font-display) font-extrabold text-tn-teal" style={{ fontSize: size * 0.3 }}>{milestone.value * 3}</span>
        <span className="font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal" style={{ fontSize: size * 0.125, marginTop: size * 0.02 }}>months</span>
      </span>
    </span>
  )
}
