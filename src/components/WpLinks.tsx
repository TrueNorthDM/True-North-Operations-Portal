/**
 * WpLinks — Dev / Live WordPress quick-access buttons shown on each
 * project page header. Renders nothing when both URLs are missing.
 *
 * Why two buttons (not one dropdown):
 *   - SEO 2 jumps between Dev and Live many times per page during
 *     hreflang work. A second click for a dropdown is wasted motion.
 *   - The visual difference (dev = ghost, live = solid brand) gives
 *     a glanceable cue about which environment they're heading into.
 *
 * Server Component (no client state needed).
 */

interface Props {
  dev?: string | null
  live?: string | null
  accent: 'aaaf' | 'hfa'
}

const accentMap = {
  aaaf: {
    solid: 'bg-aaaf-primary hover:bg-aaaf-primary-hover text-white',
    ghost: 'border border-aaaf-primary/40 text-aaaf-secondary hover:bg-aaaf-soft',
  },
  hfa: {
    solid: 'bg-hfa-primary hover:bg-hfa-primary-hover text-white',
    ghost: 'border border-hfa-primary/40 text-hfa-secondary hover:bg-hfa-soft',
  },
}

function ExternalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export function WpLinks({ dev, live, accent }: Props) {
  const a = accentMap[accent]
  if (!dev && !live) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">WordPress</span>
      {dev && (
        <a
          href={dev}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${a.ghost}`}
        >
          Dev <ExternalIcon />
        </a>
      )}
      {live && (
        <a
          href={live}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${a.solid}`}
        >
          Live <ExternalIcon />
        </a>
      )}
    </div>
  )
}
