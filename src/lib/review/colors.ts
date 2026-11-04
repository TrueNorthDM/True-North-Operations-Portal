import type { CSSProperties } from 'react'

/**
 * The annual review's own state colours (design handoff, 3 November 2026,
 * its `T` palette): on a wrapper, the pills, status icons and notes inside
 * take the handoff's values through the badge tokens; the rest of the portal
 * keeps its own.
 */
export const APR_COLORS = {
  '--bdg-green-bg': '#e6f6ee', '--bdg-green-fg': '#0d7a4f',
  '--bdg-orange-bg': '#fdf1e0', '--bdg-orange-fg': '#9a5a00',
  '--bdg-red-bg': '#fdeeef', '--bdg-red-fg': '#c8323d',
  '--bdg-blue-bg': '#e8effa', '--bdg-blue-fg': '#1e40af',
  '--bdg-slate-bg': '#f1f3f6', '--bdg-slate-fg': '#5b6b82',
} as CSSProperties
