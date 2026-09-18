'use client'

/**
 * The marks and bands that say which order a step follows: placed by hand by a
 * team leader, or True North's (lib/monday/worklist/order-bands.ts). Shared by
 * the list on My Work and the priority editor, chosen on 18 September 2026
 * from /design-check/order-clarity and /design-check/order-bands.
 *
 *   OrderMark     a navy pin with a gold head (placed by hand) or a teal
 *                 compass (True North's order), on every row
 *   BandMap       the top of the table: how many bands, in order, to scale,
 *                 each one a jump; collapse and expand all
 *   BandHeader    the line that opens a band, says what it is and why, and
 *                 collapses it
 *   NextBandPill  pinned to the bottom of the screen while a band fills it,
 *                 naming the next one. Fixed rather than sticky: the list on
 *                 My Work scrolls sideways inside its own box, and a sticky
 *                 element in there would stick to the box, not the screen.
 */

import { useEffect, useState, type ReactNode, type RefObject } from 'react'

const PIN = <><path d="M12 17v5" /><path d="M5 17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2Z" /></>
const COMPASS = <><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-1.8 5.4a2 2 0 0 1-1.3 1.3l-5.4 1.8 1.8-5.4a2 2 0 0 1 1.3-1.3z" /></>

export function OrderMark({ placed, size = 22, title }: { placed: boolean; size?: number; title?: string }) {
  const svg = (d: ReactNode, colour: string, k: number) => (
    <svg width={size * k} height={size * k} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )
  return placed
    ? <span role="img" aria-label={title ?? 'Placed by hand'} title={title ?? 'Placed by hand'} className="inline-flex items-center justify-center rounded-full bg-tn-primary shrink-0" style={{ width: size, height: size }}>{svg(PIN, '#F2C40A', 0.52)}</span>
    : <span role="img" aria-label={title ?? "Follows True North's order"} title={title ?? "Follows True North's order"} className="inline-flex items-center justify-center rounded-full bg-[rgba(30,125,127,.14)] shrink-0" style={{ width: size, height: size }}>{svg(COMPASS, '#1E7D7F', 0.58)}</span>
}

/** What the map and the headers need to know of a band. */
export interface BandSummary {
  placed: boolean
  count: number
  /** "#1 to #165". */
  range: string
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

export function BandMap({
  bands, title, placedLabel, followLabel, onJump, onCollapseAll, onExpandAll,
}: {
  bands: BandSummary[]
  /** "Your list" or "The team's order". */
  title: string
  placedLabel: string
  followLabel: string
  onJump: (i: number) => void
  onCollapseAll: () => void
  onExpandAll: () => void
}) {
  const placed = bands.filter(b => b.placed).reduce((t, b) => t + b.count, 0)
  const follow = bands.filter(b => !b.placed).reduce((t, b) => t + b.count, 0)
  return (
    <div className="px-4 pt-3 pb-3.5 border-b border-[var(--row-rule)]">
      <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap">
        <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">
          {`${title}, in ${bands.length === 1 ? 'one band' : `${bands.length} bands`}`}
        </span>
        <span className="inline-flex items-center gap-3 flex-wrap text-[12.5px] text-tn-ink">
          {placed > 0 && <span className="inline-flex items-center gap-1.5"><OrderMark placed size={18} />{`${placed.toLocaleString('en-US')} ${placedLabel}`}</span>}
          {follow > 0 && <span className="inline-flex items-center gap-1.5"><OrderMark placed={false} size={18} />{`${follow.toLocaleString('en-US')} ${followLabel}`}</span>}
        </span>
        {bands.length > 1 && (
          <span className="ml-auto inline-flex items-center gap-3">
            <button type="button" onClick={onCollapseAll} className="text-[12.5px] font-semibold text-tn-teal hover:underline">Collapse all</button>
            <button type="button" onClick={onExpandAll} className="text-[12.5px] font-semibold text-tn-teal hover:underline">Expand all</button>
          </span>
        )}
      </div>
      {/* To scale, so a long band reads as long before anything is scrolled. */}
      <div className="flex h-2.5 gap-[3px] mt-2.5">
        {bands.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Go to band ${i + 1}: ${b.placed ? 'placed by hand' : "True North's order"}, ${plural(b.count, 'step', 'steps')}`}
            className={`rounded-full min-w-[6px] hover:opacity-80 transition-opacity ${b.placed ? 'bg-tn-primary' : 'bg-tn-teal'}`}
            style={{ flexGrow: b.count }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {bands.map((b, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            className={`inline-flex items-center gap-2 rounded-full border bg-white pl-1 pr-3 py-1 text-[12px] transition-colors ${b.placed ? 'border-[rgba(1,35,88,.25)] hover:bg-[rgba(1,35,88,.05)]' : 'border-[rgba(30,125,127,.35)] hover:bg-[rgba(30,125,127,.07)]'}`}
          >
            <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted w-4 text-center">{i + 1}</span>
            <OrderMark placed={b.placed} size={18} />
            <span className="font-semibold text-tn-ink">{plural(b.count, 'step', 'steps')}</span>
            <span className="text-muted">{b.range}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function BandHeader({
  index, band, label, reason, open, onToggle,
}: {
  index: number
  band: BandSummary
  /** "Placed by hand by Jeannette Owens", "Following True North's order". */
  label: string
  reason?: string | null
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`w-full flex items-center gap-2.5 px-4 py-2 border-b border-[var(--row-rule)] text-left border-l-[3px] ${band.placed ? 'bg-[rgba(1,35,88,.06)] border-l-tn-primary' : 'bg-[rgba(30,125,127,.09)] border-l-tn-teal'}`}
    >
      <span className={`text-[11px] text-muted transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true">▾</span>
      <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted">{index + 1}</span>
      <OrderMark placed={band.placed} size={22} />
      <span className="text-[12.5px] text-tn-ink leading-snug flex-1 min-w-0">
        <b>{label}</b>
        <span className="text-muted">{` · ${plural(band.count, 'step', 'steps')} · ${band.range}`}{reason ? `. ${reason}` : ''}</span>
      </span>
      <span className="text-[12px] font-semibold text-tn-teal shrink-0">{open ? 'Collapse' : `Show ${plural(band.count, 'step', 'steps')}`}</span>
    </button>
  )
}

/**
 * The next band, named at the bottom of the screen while the current one fills
 * it. Hidden when the next band's header is already in view, when the current
 * band is collapsed, and when the list is off screen.
 */
export function NextBandPill({
  sections, bands, closed, onJump,
}: {
  sections: RefObject<(HTMLElement | null)[]>
  bands: BandSummary[]
  closed: ReadonlySet<number>
  onJump: (i: number) => void
}) {
  const [next, setNext] = useState<number | null>(null)
  // Measured on scroll against the latest bands, without re-subscribing every
  // render: the signature changes only when the bands or what is open do.
  const signature = `${bands.map(b => `${b.placed ? 'p' : 'f'}${b.count}`).join(',')}|${[...closed].join(',')}`
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const els = sections.current ?? []
      const vh = window.innerHeight
      const line = vh * 0.4
      let found: number | null = null
      for (let i = 0; i < els.length - 1; i++) {
        const el = els[i]
        const after = els[i + 1]
        if (!el || !after || closed.has(i)) continue
        const r = el.getBoundingClientRect()
        if (r.top <= line && r.bottom > line && after.getBoundingClientRect().top > vh - 40) { found = i + 1; break }
      }
      setNext(found)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, signature])

  if (next === null || !bands[next]) return null
  const b = bands[next]
  return (
    <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center pointer-events-none px-4">
      <button
        type="button"
        onClick={() => onJump(next)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-tn-primary pl-3 pr-4 py-2 shadow-[0_12px_28px_-10px_rgba(1,35,88,.75)] font-(family-name:--font-display) font-extrabold text-[12.5px]"
      >
        <span className="text-[#F2C40A]" aria-hidden="true">↓</span>
        <span className="text-[#ffffff]">{`Next: ${b.placed ? 'placed by hand' : "True North's order"} · ${plural(b.count, 'step', 'steps')} · ${b.range}`}</span>
      </button>
    </div>
  )
}
