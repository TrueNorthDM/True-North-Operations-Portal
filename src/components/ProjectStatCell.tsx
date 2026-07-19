'use client'

// A single project metric (big number + label) that counts up from 0 to its
// value on first render. Client component because the count-up runs in the
// browser (requestAnimationFrame), the Projects page that renders it is a
// Server Component and just passes the final value down as a prop.

import { useEffect, useState } from 'react'

/**
 * Count-up hook: eases from 0 to `target` over `durationMs`. Honours
 * prefers-reduced-motion (jumps straight to the value, no animation).
 */
function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Jump straight to the value (no animation) when reduced-motion is on,
    // there's nothing to count, or the tab is hidden, rAF is paused in
    // background tabs, so animating there would leave a stale 0 until focus.
    // setTimeout fires regardless of visibility and is deferred, so we never
    // setState synchronously in the effect body.
    if (reduce || target <= 0 || document.hidden) {
      const id = setTimeout(() => setValue(target), 0)
      return () => clearTimeout(id)
    }

    let raf = 0
    let start = 0
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min(1, (ts - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic, fast then settles
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}

/**
 * `color` tints the number with the site's brand colour, used for the
 * "Remaining" cell, the one the team actually needs to act on. The other two
 * use the neutral ink token.
 */
export function StatCell({
  value,
  label,
  hint,
  color,
}: {
  value: number
  label: string
  hint?: string
  color?: string
}) {
  const display = useCountUp(value)
  return (
    <div className="px-4 py-3.5 flex flex-col" title={hint}>
      <span
        className="text-3xl font-(family-name:--font-display) font-black tabular-nums text-tn-ink"
        style={color ? { color } : undefined}
      >
        {display}
      </span>
      <span className="text-xs text-muted mt-1 font-medium">{label}</span>
    </div>
  )
}
