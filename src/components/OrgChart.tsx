'use client'

/**
 * OrgChart: read-only company org chart, positioned by a computed tidy-tree
 * engine (src/lib/org/layout.ts) instead of the browser's auto-flow, so a
 * person's direct reports are evenly spaced no matter how big one sibling's team
 * is (leaf siblings pack tight; a wide team flows below and under them). Cards
 * are absolutely positioned; every connector (solid primary + dotted secondary)
 * is drawn in one SVG. Inline it scrolls; full screen adds zoom + drag-to-pan.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { OrgPerson, OrgGhost } from '@/lib/org/data'
import { layoutOrg, CARD_W, CARD_H } from '@/lib/org/layout'
import { BTN_ICON } from '@/lib/ui/buttons'

const NEUTRAL = '#cbd5e1'

// Measure before paint on the client; fall back to useEffect during SSR.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function PersonCard({ p }: { p: OrgPerson }) {
  const color = p.color ?? NEUTRAL
  return (
    <div className="w-full h-full rounded-[14px] border border-slate-200 bg-white text-left shadow-sm overflow-hidden transition-all hover:-translate-y-1 hover:border-tn-teal hover:shadow-[0_16px_34px_-16px_rgba(1,35,88,.45)]">
      <div className="h-2.5" style={{ backgroundColor: color }} />
      <div className="px-5 py-3">
        <div className="font-(family-name:--font-display) text-[18px] font-bold text-tn-ink leading-tight truncate">{p.name}</div>
        {p.title && <div className="mt-0.5 text-[13px] text-muted leading-tight truncate">{p.title}</div>}
        {p.teams.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 overflow-hidden">
            {p.teams.map(t => (
              <span key={t.name} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 whitespace-nowrap" title={t.name}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color ?? NEUTRAL }} />
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** A borrowed team member: the same person as a solid card elsewhere, shown as a
 *  lighter dashed "also on this team" card so it never reads as extra headcount. */
function GhostCard({ g }: { g: OrgGhost }) {
  const color = g.onTeamColor ?? NEUTRAL
  return (
    <div className="w-full h-full rounded-[14px] border border-dashed border-slate-300 bg-white/50 text-left overflow-hidden">
      <div className="h-2.5 opacity-40" style={{ backgroundColor: color }} />
      <div className="px-5 py-3">
        <div className="font-(family-name:--font-display) text-[16px] font-semibold text-slate-500 leading-tight truncate">{g.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-400">
          <span aria-hidden="true" style={{ color }}>↪</span> also on {g.onTeamName}
        </div>
        {g.primaryTeamName && (
          <div className="mt-1.5 inline-block text-[10.5px] text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">primary: {g.primaryTeamName}</div>
        )}
      </div>
    </div>
  )
}

/** The positioned card + connector canvas, sized to the computed layout. */
function Canvas({ roots, innerRef }: { roots: OrgPerson[]; innerRef?: React.Ref<HTMLDivElement> }) {
  const layout = useMemo(() => layoutOrg(roots), [roots])
  return (
    <div ref={innerRef} style={{ position: 'relative', width: layout.width, height: layout.height }}>
      <svg
        width={layout.width}
        height={layout.height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}
        aria-hidden="true"
      >
        {layout.edges.map(e => (
          <path
            key={e.key}
            d={e.d}
            fill="none"
            stroke={e.color}
            strokeWidth={e.kind === 'secondary' ? 1.25 : 2}
            strokeDasharray={e.kind === 'secondary' ? '4 5' : undefined}
            strokeOpacity={e.kind === 'secondary' ? 0.5 : 1}
          />
        ))}
      </svg>
      {layout.cards.map(c => (
        <div key={c.id} style={{ position: 'absolute', left: c.x, top: c.y, width: CARD_W, height: CARD_H, zIndex: 1 }}>
          {c.person ? <PersonCard p={c.person} /> : c.ghost ? <GhostCard g={c.ghost} /> : null}
        </div>
      ))}
    </div>
  )
}

/** Inline: the whole chart auto-scaled to fit the container width, no scrollbars.
 *  (Full screen is where you zoom in to read detail.) */
function AutoFit({ roots }: { roots: OrgPerson[] }) {
  const layout = useMemo(() => layoutOrg(roots), [roots])
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { const w = el.clientWidth; setScale(w > 0 ? Math.min(1, w / layout.width) : 1) }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout.width])
  return (
    <div ref={ref} className="w-full overflow-hidden" style={{ height: layout.height * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: layout.width, height: layout.height }}>
        <Canvas roots={roots} />
      </div>
    </div>
  )
}

/** ScaledTree: the canvas at an explicit scale, reserving the scaled footprint
 *  so a scrolling parent can pan when zoomed in. */
function ScaledTree({ roots, scale, innerRef }: { roots: OrgPerson[]; scale: number; innerRef: React.Ref<HTMLDivElement> }) {
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 'max-content' }}>
      <Canvas roots={roots} innerRef={innerRef} />
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
    if (e.button !== 0 || !el) return
    e.preventDefault()
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
          Full screen
        </button>
      </div>

      <AutoFit roots={roots} />

      {full && <FullScreen roots={roots} onClose={() => setFull(false)} />}
    </>
  )
}
