/**
 * WpLinks — Dev / Live WordPress quick-access pills shown on each project
 * page header. Renders nothing when both URLs are missing.
 *
 * Styling matches the handoff: WP Dev is a neutral pill with a grey status
 * dot; WP Live is a brand-tinted pill (green for AAAF, orange for HFA) with a
 * matching dot — a glanceable cue about which environment they're heading into.
 *
 * Server Component (no client state needed).
 */

interface Props {
  dev?: string | null
  live?: string | null
  accent: 'aaaf' | 'hfa'
}

// Live-pill brand colour (dot + border/bg tint) and a darker text shade.
// Literal hex so the pill reads identically in light and dark, like the proto.
const accentMap = {
  aaaf: { color: '#44ad85', text: '#2f8e6a' },
  hfa: { color: '#fe9d2d', text: '#b3600f' },
}

export function WpLinks({ dev, live, accent }: Props) {
  const a = accentMap[accent]
  if (!dev && !live) return null

  return (
    <div className="flex items-center gap-2">
      {dev && (
        <a
          href={dev}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-slate-50"
        >
          <span className="w-[7px] h-[7px] rounded-full bg-slate-400" aria-hidden="true" />
          WP Dev <span aria-hidden="true">↗</span>
        </a>
      )}
      {live && (
        <a
          href={live}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold transition-colors"
          style={{ border: `1px solid ${a.color}55`, background: `${a.color}14`, color: a.text }}
        >
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: a.color }} aria-hidden="true" />
          WP Live <span aria-hidden="true">↗</span>
        </a>
      )}
    </div>
  )
}
