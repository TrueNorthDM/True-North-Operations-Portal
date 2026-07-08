'use client'

/**
 * OrgChart — read-only company org chart as a horizontal connector tree
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
import type { OrgPerson, OrgTeamGroup } from '@/lib/org/data'

const NEUTRAL = '#cbd5e1'

// Measure before paint on the client; fall back to useEffect during SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function PersonCard({ p }: { p: OrgPerson }) {
  const color = p.color ?? NEUTRAL
  return (
    <div className="inline-block min-w-[148px] max-w-[210px] rounded-[10px] border border-slate-200 bg-white text-left shadow-sm overflow-hidden transition-all hover:-translate-y-1 hover:border-tn-teal hover:shadow-[0_16px_34px_-16px_rgba(1,35,88,.45)]">
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="px-3 py-2">
        <div className="font-(family-name:--font-display) text-[13.5px] font-bold text-tn-ink leading-tight">{p.name}</div>
        {p.title && <div className="mt-0.5 text-[11px] text-muted leading-tight">{p.title}</div>}
        {p.teams.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {p.teams.map(t => (
              <span key={t.name} className="inline-flex items-center gap-1 text-[9px] font-medium text-slate-500" title={t.name}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color ?? NEUTRAL }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** A team rendered as a box: coloured header + members stacked vertically. */
function TeamBox({ team }: { team: OrgTeamGroup }) {
  const color = team.color ?? NEUTRAL
  const threadStyle = { ['--thread']: color } as React.CSSProperties
  return (
    <li style={threadStyle}>
      <div className="inline-block align-top min-w-[150px] max-w-[230px] rounded-[10px] border border-slate-200 bg-white text-left shadow-sm overflow-hidden transition-all hover:-translate-y-1 hover:border-tn-teal hover:shadow-[0_16px_34px_-16px_rgba(1,35,88,.45)]">
        {/* Team band colours are fixed light pastels, so the header text is a
            fixed dark ink — not a themed token — to keep contrast in dark mode. */}
        <div className="px-3 py-2 font-(family-name:--font-display) text-[12.5px] font-extrabold text-[#26261f]" style={{ backgroundColor: color }}>{team.name}</div>
        {team.members.length === 0 ? (
          <div className="px-3 py-2 text-xs text-slate-400">No members</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.members.map(m => <li key={m.id} className="px-3 py-1.5 text-xs text-slate-700">{m.name}</li>)}
          </ul>
        )}
      </div>
    </li>
  )
}

function Node({ node }: { node: OrgPerson }) {
  // The connector INTO this node is tinted by the node's own team color, so each
  // branch reads as a coloured thread down to its team. Colour-less nodes fall
  // back to the theme's connector token (light/dark aware).
  const threadStyle = { ['--thread']: node.color ?? 'var(--org-thread)' } as React.CSSProperties
  // Members of a team this person leads are shown INSIDE the team box, so they
  // shouldn't also appear as individual report nodes.
  const ledMemberIds = new Set(node.ledTeams.flatMap(t => t.members.map(m => m.id)))
  const reports = node.children.filter(c => !ledMemberIds.has(c.id))
  const hasBelow = node.ledTeams.length > 0 || reports.length > 0
  return (
    <li style={threadStyle}>
      <PersonCard p={node} />
      {hasBelow && (
        <ul>
          {node.ledTeams.map(t => <TeamBox key={t.name} team={t} />)}
          {reports.map(c => <Node key={c.id} node={c} />)}
        </ul>
      )}
    </li>
  )
}

function Tree({ roots }: { roots: OrgPerson[] }) {
  return (
    <div className="org-tree inline-block">
      <ul>
        {roots.map(r => <Node key={r.id} node={r} />)}
      </ul>
    </div>
  )
}

/**
 * ScaledTree — renders the tree at an explicit scale, reserving the scaled
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

/** Inline: auto-fit the tree to the block width (downscale only). */
function FitTree({ roots }: { roots: OrgPerson[] }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, height: 0, ready: false })

  useIsoLayoutEffect(() => {
    const box = boxRef.current
    const tree = treeRef.current
    if (!box || !tree) return
    const measure = () => {
      const natW = tree.scrollWidth || 1 //  transform doesn't affect scrollWidth
      const natH = tree.scrollHeight || 0
      const avail = box.clientWidth || natW
      const scale = Math.min(1, avail / natW)
      const height = Math.ceil(natH * scale)
      setFit(prev => (prev.scale === scale && prev.height === height && prev.ready ? prev : { scale, height, ready: true }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    const t = setTimeout(measure, 250) // re-measure once fonts settle
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [roots])

  return (
    <div
      ref={boxRef}
      className="overflow-hidden transition-opacity"
      style={{ height: fit.ready ? fit.height : undefined, opacity: fit.ready ? 1 : 0 }}
    >
      <ScaledTree roots={roots} scale={fit.scale} innerRef={treeRef} />
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

      <FitTree roots={roots} />

      {full && <FullScreen roots={roots} onClose={() => setFull(false)} />}
    </>
  )
}
