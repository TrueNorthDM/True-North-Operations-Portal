'use client'

/**
 * OrgChart: read-only company org chart as a horizontal connector tree
 * (boxes), auto-laid-out from the reporting hierarchy. Each card carries its
 * team's signature color (top band) and the connector thread leading into it is
 * tinted the same color (via the --thread CSS var on each <li>; see globals.css
 * .org-tree).
 *
 * Inline, the tree auto-scales to fit the block's width (no horizontal scroll).
 * A full-screen view shows it bigger with zoom in/out controls. Both scale via
 * a CSS transform; the scroll/area math reserves the scaled size so panning
 * works when zoomed in.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { OrgPerson } from '@/lib/org/data'

const NEUTRAL = '#cbd5e1'

// Measure before paint on the client; fall back to useEffect during SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function PersonCard({ p }: { p: OrgPerson }) {
  const color = p.color ?? NEUTRAL
  return (
    <div data-person-id={p.id} className="inline-block min-w-[280px] max-w-[380px] rounded-[14px] border border-slate-200 bg-white text-left shadow-sm overflow-hidden transition-all hover:-translate-y-1 hover:border-tn-teal hover:shadow-[0_16px_34px_-16px_rgba(1,35,88,.45)]">
      <div className="h-3" style={{ backgroundColor: color }} />
      <div className="px-5 py-3.5">
        <div className="font-(family-name:--font-display) text-[19px] font-bold text-tn-ink leading-tight">{p.name}</div>
        {p.title && <div className="mt-1 text-[14px] text-muted leading-tight">{p.title}</div>}
        {p.teams.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.teams.map(t => (
              <span key={t.name} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500" title={t.name}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color ?? NEUTRAL }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** One vertical column of leaf reports, with a left spine + elbow connectors
 *  tinted the column's team colour. */
function StackColumn({ reports, color }: { reports: OrgPerson[]; color: string }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 34, textAlign: 'left' }}>
      <div style={{ position: 'absolute', left: 17, top: 0, bottom: 34, width: 2, background: color }} />
      {reports.map(r => (
        <div key={r.id} style={{ position: 'relative', marginTop: 12 }}>
          <div style={{ position: 'absolute', left: -17, top: 26, width: 17, height: 2, background: color }} />
          <PersonCard p={r} />
        </div>
      ))}
    </div>
  )
}

/** Bottom-level team: leaf reports stacked vertically under their leader. When
 *  the leader runs several teams, the collaborators split into one column per
 *  team (side by side), each spine tinted its own team colour. */
function StackList({ reports, color }: { reports: OrgPerson[]; color: string }) {
  const groups = new Map<string, OrgPerson[]>()
  for (const r of reports) {
    const key = r.primaryTeamName ?? '—'
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }
  const cols = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  return (
    <div style={{ display: 'flex', gap: 24, paddingTop: 6, alignItems: 'flex-start', justifyContent: 'center' }}>
      {cols.map(([key, group]) => (
        <StackColumn key={key} reports={group} color={group[0].color ?? color} />
      ))}
    </div>
  )
}

function Node({ node }: { node: OrgPerson }) {
  // The connector INTO this node is tinted by the node's own primary-team color,
  // so each branch reads as a coloured thread. Colour-less nodes fall back to the
  // theme's connector token (light/dark aware). Pure reporting tree: every person
  // is one card, parented by their primary manager, so no one is duplicated.
  const threadStyle = { ['--thread']: node.color ?? 'var(--org-thread)' } as React.CSSProperties
  const reports = node.children
  // A bottom-level team = a leader whose reports are ALL collaborators (leaves).
  // Those stack vertically; anything with its own reports keeps branching sideways.
  const stack = reports.length > 1 && reports.every(c => c.children.length === 0)
  return (
    <li style={threadStyle}>
      {stack ? (
        <div style={{ display: 'inline-block', textAlign: 'center' }}>
          <PersonCard p={node} />
          <StackList reports={reports} color={node.color ?? NEUTRAL} />
        </div>
      ) : (
        <>
          <PersonCard p={node} />
          {reports.length > 0 && (
            <ul>
              {reports.map(c => <Node key={c.id} node={c} />)}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

// Flatten the tree to person → secondary-manager pairs (the dotted lines).
function secondaryPairs(roots: OrgPerson[]): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  const walk = (n: OrgPerson) => {
    if (n.secondaryManagerId && n.secondaryManagerId !== n.id) out.push({ from: n.id, to: n.secondaryManagerId })
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return out
}

/**
 * SecondaryEdges: an SVG overlay inside the .org-tree that draws a dotted line
 * from each person to their SECONDARY manager (also_reports_to). Positions are
 * read from layout offsets relative to the tree, so they're immune to the
 * zoom/scale transform used in full-screen. Sits behind the cards (drawn first),
 * so lines tuck under the boxes and show in the gaps.
 */
function SecondaryEdges({ roots }: { roots: OrgPerson[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [paths, setPaths] = useState<string[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useIsoLayoutEffect(() => {
    const svg = svgRef.current
    const container = svg?.parentElement as HTMLElement | null
    if (!container) return
    // Sum offsets up the offsetParent chain to the tree container, so positions
    // are correct even for cards nested inside positioned wrappers (the stacks).
    const offsetWithin = (el: HTMLElement) => {
      let l = 0, t = 0
      let cur: HTMLElement | null = el
      while (cur && cur !== container) { l += cur.offsetLeft; t += cur.offsetTop; cur = cur.offsetParent as HTMLElement | null }
      return { l, t }
    }
    const compute = () => {
      const box = new Map<string, { l: number; t: number; w: number; h: number }>()
      container.querySelectorAll<HTMLElement>('[data-person-id]').forEach(el => {
        const { l, t } = offsetWithin(el)
        box.set(el.dataset.personId as string, { l, t, w: el.offsetWidth, h: el.offsetHeight })
      })
      const ds: string[] = []
      for (const { from, to } of secondaryPairs(roots)) {
        const a = box.get(from), b = box.get(to)
        if (!a || !b) continue
        // From the top-center of the report to the bottom-center of the manager,
        // as a smooth S-curve.
        const x1 = a.l + a.w / 2, y1 = a.t
        const x2 = b.l + b.w / 2, y2 = b.t + b.h
        const my = (y1 + y2) / 2
        ds.push(`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`)
      }
      setPaths(ds)
      setSize({ w: container.scrollWidth, h: container.scrollHeight })
    }
    compute()
    const t = setTimeout(compute, 300) // re-measure once fonts/layout settle
    const ro = new ResizeObserver(compute)
    ro.observe(container)
    return () => { clearTimeout(t); ro.disconnect() }
  }, [roots])

  return (
    <svg ref={svgRef} width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }} aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#94a3b8" strokeWidth={1.25} strokeDasharray="4 5" strokeOpacity={0.5} />
      ))}
    </svg>
  )
}

function Tree({ roots }: { roots: OrgPerson[] }) {
  // Cards sit in a z-index:1 layer above the dotted-line SVG (z-index:0), so the
  // secondary lines tuck BEHIND the boxes and show only in the gaps, much
  // calmer than drawing them on top of everything.
  return (
    <div className="org-tree inline-block" style={{ position: 'relative' }}>
      <SecondaryEdges roots={roots} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <ul>
          {roots.map(r => <Node key={r.id} node={r} />)}
        </ul>
      </div>
    </div>
  )
}

/**
 * ScaledTree: renders the tree at an explicit scale, reserving the scaled
 * footprint so a scrolling parent can pan when zoomed in. `width: max-content`
 * lets the inner tree take its natural width regardless of the parent.
 */
function ScaledTree({ roots, scale, innerRef }: { roots: OrgPerson[]; scale: number; innerRef: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 'max-content' }}>
      <Tree roots={roots} />
    </div>
  )
}

/** Inline: full-size tree in a scroll area (horizontal + capped-height vertical),
 *  so cards stay readable and you pan a large org instead of shrinking it. Opens
 *  centred on the diagram (the root sits above the middle of the tree). */
function ScrollTree({ roots }: { roots: OrgPerson[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const center = () => { el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2) }
    center()
    const t = setTimeout(center, 250) // re-centre once fonts/layout settle
    return () => clearTimeout(t)
  }, [roots])
  return (
    <div ref={ref} className="overflow-auto max-h-[78vh] pt-1 pb-2">
      <Tree roots={roots} />
    </div>
  )
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex w-8 h-8 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
    >
      {children}
    </button>
  )
}

const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))

/** Full screen: bigger view with zoom in/out + scroll/drag-to-pan. */
function FullScreen({ roots, onClose }: { roots: OrgPerson[]; onClose: () => void }) {
  const treeRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Drag-to-pan state kept in a ref (no re-render per mouse-move).
  const drag = useRef({ active: false, startX: 0, startY: 0, left: 0, top: 0 })
  const [grabbing, setGrabbing] = useState(false)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)

  useIsoLayoutEffect(() => {
    const el = treeRef.current
    if (!el) return
    const m = () => setNat({ w: el.scrollWidth, h: el.scrollHeight })
    m()
    const t = setTimeout(m, 250)
    return () => clearTimeout(t)
  }, [])

  // Open centred on the diagram (runs once the natural size is known).
  useIsoLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !nat.w) return
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
  }, [nat.w])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') setZoom(z => clampZoom(z + 0.2))
      else if (e.key === '-' || e.key === '_') setZoom(z => clampZoom(z - 0.2))
      else if (e.key === '0') setZoom(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Drag-to-pan: listen on window so the pan keeps tracking even if the cursor
  // leaves the canvas mid-drag.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = scrollRef.current
      if (!drag.current.active || !el) return
      el.scrollLeft = drag.current.left - (e.clientX - drag.current.startX)
      el.scrollTop = drag.current.top - (e.clientY - drag.current.startY)
    }
    const onUp = () => {
      if (drag.current.active) {
        drag.current.active = false
        setGrabbing(false)
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current
    if (e.button !== 0 || !el) return // left button only
    e.preventDefault() // stop native text/image drag
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    setGrabbing(true)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/80 backdrop-blur">
        <h2 className="text-sm font-bold text-slate-800">Organization</h2>
        <div className="flex items-center gap-1.5">
          <ZoomBtn label="Zoom out" onClick={() => setZoom(z => clampZoom(z - 0.2))}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
          </ZoomBtn>
          <span className="text-xs font-medium text-slate-500 tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
          <ZoomBtn label="Zoom in" onClick={() => setZoom(z => clampZoom(z + 0.2))}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </ZoomBtn>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
          >
            Close ✕
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        className={`flex-1 overflow-auto p-8 select-none ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        {/* Reserve the scaled footprint so panning works when zoomed in. */}
        <div style={{ width: nat.w ? nat.w * zoom : undefined, height: nat.h ? nat.h * zoom : undefined }}>
          <ScaledTree roots={roots} scale={zoom} innerRef={treeRef} />
        </div>
      </div>
    </div>
  )
}

export function OrgChart({ roots }: { roots: OrgPerson[] }) {
  const [full, setFull] = useState(false)

  if (roots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-10 text-center text-sm text-slate-400">
        The org chart appears here once the People directory is set up.
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setFull(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-tn-ink border border-slate-200 hover:border-tn-teal rounded-[9px] px-[13px] py-1.5 bg-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          Full screen
        </button>
      </div>

      <ScrollTree roots={roots} />

      {full && <FullScreen roots={roots} onClose={() => setFull(false)} />}
    </>
  )
}
