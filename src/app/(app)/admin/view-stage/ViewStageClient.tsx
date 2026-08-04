'use client'

// View Stage, the portal through each permission tier, side by side, on a
// pan/zoom canvas. Each column is a TIER rendered in an iframe. The Admin column
// is your real session; the others impersonate a real person of that tier via a
// signed token on the iframe URL (?_vs=). Desktop-only. Theme-aware chrome
// (portal identity), the iframes themselves render the portal in the theme.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { tokenViewAs } from './actions'
import { Select } from '@/components/ui/Select'
import type { ViewAsRole } from '@/lib/auth/view-as'

type Tier = ViewAsRole
const TIERS: Tier[] = ['admin', 'admin_assistant', 'team_leader', 'user']
const LABEL: Record<Tier, string> = {
  admin: 'Admin', admin_assistant: 'Admin Assistant', team_leader: 'Team Leader', user: 'User',
}
// Admin = your own live session (no token); the rest impersonate.
const IMPERSONATE = (t: Tier) => t !== 'admin'

const DV = { label: 'Desktop · 1440px', w: 1440, h: 900, base: 0.34 }

type TokState = { token?: string; name?: string; error?: string; loading?: boolean }

export default function ViewStageClient({ myName }: { myName: string }) {
  const [cols, setCols] = useState<Tier[]>([...TIERS])
  const [toks, setToks] = useState<Record<string, TokState>>({})
  const [, startTransition] = useTransition()

  const load = useCallback((t: Tier, force = false) => {
    if (!IMPERSONATE(t)) return
    setToks(prev => (!force && (prev[t]?.loading || prev[t]?.token) ? prev : { ...prev, [t]: { loading: true } }))
    startTransition(async () => {
      const res = await tokenViewAs(t)
      setToks(prev => ({ ...prev, [t]: { token: res.token, name: res.name, error: res.error, loading: false } }))
    })
  }, [])
  useEffect(() => { cols.forEach(t => load(t)) }, [cols, load])

  // The columns show whoever holds each level RIGHT NOW, so re-resolve them
  // whenever this tab regains focus: edit somebody's level elsewhere, come
  // back, and the stage reflects it without a manual reload.
  const [reloadNonce, setReloadNonce] = useState(0)
  const refresh = useCallback(() => {
    cols.forEach(t => load(t, true))
    setReloadNonce(n => n + 1)
  }, [cols, load])
  useEffect(() => {
    function onFocus() { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [refresh])

  // ── canvas: pan + zoom ──
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [tr, setTr] = useState({ x: 24, y: 20, s: 0.6 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ on: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = frameRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    setTr(prev => {
      const ns = Math.min(2.5, Math.max(0.12, prev.s * Math.pow(1.0015, -e.deltaY)))
      const wx = (px - prev.x) / prev.s, wy = (py - prev.y) / prev.s
      return { s: ns, x: px - wx * ns, y: py - wy * ns }
    })
  }, [])
  const onDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'IFRAME') return
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, ox: tr.x, oy: tr.y }
    setDragging(true)
  }, [tr.x, tr.y])
  useEffect(() => {
    const mv = (e: MouseEvent) => { if (drag.current.on) setTr(p => ({ ...p, x: drag.current.ox + (e.clientX - drag.current.sx), y: drag.current.oy + (e.clientY - drag.current.sy) })) }
    const up = () => { drag.current.on = false; setDragging(false) }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
  }, [])
  const zoom = (d: number) => setTr(p => ({ ...p, s: Math.min(2.5, Math.max(0.12, p.s + d)) }))

  // Fit: scale so the columns fill the canvas width, top-aligned.
  const fit = useCallback(() => {
    const frame = frameRef.current, content = contentRef.current
    if (!frame || !content) return
    const cw = content.offsetWidth || 1
    const s = Math.min(2.5, Math.max(0.12, (frame.clientWidth - 8) / cw))
    setTr({ x: 4, y: 20, s })
  }, [])
  // Fit to width on mount (columns have fixed sizes, so layout is known at once).
  useEffect(() => { fit() }, [fit])

  const swap = (i: number, t: Tier) => setCols(cs => cs.map((c, j) => (j === i ? t : c)))

  return (
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-65px)] bg-background text-foreground overflow-hidden">
      {/* topbar */}
      <div className="flex items-center gap-3 px-5 h-14 shrink-0 bg-white border-b border-slate-200">
        <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">View Stage</span>
        <span className="text-xs text-muted hidden md:inline">the portal through each access level</span>
        <span className="flex-1" />
        <div className="flex items-center gap-1 bg-subtle border border-slate-200 rounded-lg p-1">
          <button onClick={() => zoom(-0.12)} className="w-7 h-7 rounded text-muted hover:bg-white hover:text-tn-ink transition-colors">−</button>
          <span className="text-xs w-11 text-center tabular-nums text-tn-ink">{Math.round(tr.s * 100)}%</span>
          <button onClick={() => zoom(0.12)} className="w-7 h-7 rounded text-muted hover:bg-white hover:text-tn-ink transition-colors">+</button>
          <button onClick={fit} className="text-xs px-2 h-7 rounded text-muted hover:bg-white hover:text-tn-ink transition-colors font-(family-name:--font-display) font-bold">Fit</button>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={frameRef}
        onWheel={onWheel}
        onMouseDown={onDown}
        // The canvas pans by transform and never uses native scrolling, so any
        // scrollLeft/Top here came from something inside an iframe focusing an
        // element. Snap it back, otherwise the column sits offset with no way
        // for the user to recover it.
        onScroll={e => { const el = e.currentTarget; if (el.scrollLeft || el.scrollTop) { el.scrollLeft = 0; el.scrollTop = 0 } }}
        className="flex-1 relative overflow-hidden cursor-grab bg-subtle"
        style={{
          backgroundImage: 'linear-gradient(rgba(30,125,127,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(30,125,127,0.06) 1px, transparent 1px), radial-gradient(circle at 24% 6%, rgba(30,125,127,0.10), transparent 66%)',
          backgroundSize: '32px 32px, 32px 32px, 100% 100%',
        }}
      >
        <div ref={contentRef} className="absolute top-0 left-0" style={{ transform: `translate(${tr.x}px, ${tr.y}px) scale(${tr.s})`, transformOrigin: '0 0', transition: dragging ? 'none' : 'transform .16s ease-out' }}>
          <div className="flex items-start gap-6 p-8">
            {cols.map((t, i) => {
              const st = IMPERSONATE(t) ? toks[t] : undefined
              const name = t === 'admin' ? `${myName} · you` : (st?.name ?? '-')
              const src = IMPERSONATE(t) ? (st?.token ? `/?_vs=${encodeURIComponent(st.token)}` : null) : '/'
              return (
                <div key={i} className="flex flex-col items-center gap-2" style={{ width: DV.w * DV.base }}>
                  {/* column header */}
                  <div className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-tn-teal">{LABEL[t]}</span>
                      <Select
                        value={t}
                        onChange={v => swap(i, v as Tier)}
                        options={TIERS.map(op => ({ value: op, label: LABEL[op] }))}
                        ariaLabel="Tier"
                        className="bg-subtle border border-slate-200 rounded text-[11px] px-1.5 py-0.5 text-foreground"
                      />
                    </div>
                    <div className="text-sm font-semibold text-tn-ink truncate mt-0.5">{name}</div>
                  </div>

                  {/* device frame */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_22px_55px_-22px_rgba(1,35,88,.4)]" style={{ width: DV.w * DV.base, height: DV.h * DV.base + 26 }}>
                    <div className="h-[26px] bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 px-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div style={{ width: DV.w * DV.base, height: DV.h * DV.base, overflow: 'hidden' }}>
                      {src ? (
                        <iframe
                          // Keyed on the refresh counter so a re-resolve
                          // remounts the frame instead of leaving a stale render.
                          key={`${t}-${reloadNonce}`}
                          src={src}
                          title={`${LABEL[t]}, desktop`}
                          style={{ width: DV.w, height: DV.h, border: 'none', transform: `scale(${DV.base})`, transformOrigin: 'top left' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-center text-xs text-muted p-4">
                          {st?.loading ? 'Loading…' : (st?.error ?? 'No user of this tier.')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted">{DV.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="absolute left-4 bottom-4 text-[11px] text-muted bg-white/90 border border-slate-200 rounded-lg px-3 py-2 max-w-md shadow-sm">
          Drag the background to move · scroll to zoom. Each tier is a live preview of what that access level sees, the <b className="text-tn-ink font-semibold">Admin</b> column is your own session.
        </div>
      </div>
    </div>
  )
}
