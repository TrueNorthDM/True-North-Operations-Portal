'use client'

// View Stage — the portal through each permission tier, side by side, on a
// pan/zoom canvas. Each column is a TIER rendered in an iframe. The Admin column
// is your real session; the others impersonate a real person of that tier via a
// signed token on the iframe URL (?_vs=). Desktop-only for this project.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { tokenViewAs } from './actions'
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

  const load = useCallback((t: Tier) => {
    if (!IMPERSONATE(t)) return
    setToks(prev => (prev[t]?.loading || prev[t]?.token ? prev : { ...prev, [t]: { loading: true } }))
    startTransition(async () => {
      const res = await tokenViewAs(t)
      setToks(prev => ({ ...prev, [t]: { token: res.token, name: res.name, error: res.error, loading: false } }))
    })
  }, [])
  useEffect(() => { cols.forEach(load) }, [cols, load])

  // ── canvas: pan + zoom ──
  const frameRef = useRef<HTMLDivElement>(null)
  const [tr, setTr] = useState({ x: 40, y: 24, s: 0.6 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ on: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = frameRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    setTr(prev => {
      const ns = Math.min(2.5, Math.max(0.15, prev.s * Math.pow(1.0015, -e.deltaY)))
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
  const zoom = (d: number) => setTr(p => ({ ...p, s: Math.min(2.5, Math.max(0.15, p.s + d)) }))
  const fit = () => setTr({ x: 40, y: 24, s: 0.6 })

  const swap = (i: number, t: Tier) => setCols(cs => cs.map((c, j) => (j === i ? t : c)))

  return (
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-65px)] bg-[#0a1226] text-slate-100 overflow-hidden">
      {/* topbar */}
      <div className="flex items-center gap-3 px-5 h-14 shrink-0 bg-[#0d1f3d] border-b border-white/10">
        <span className="font-(family-name:--font-display) font-extrabold text-white">View Stage</span>
        <span className="text-xs text-slate-400 hidden md:inline">the portal through each access level</span>
        <span className="flex-1" />
        <div className="flex items-center gap-1 bg-[#0a1226] border border-white/10 rounded-lg p-1">
          <button onClick={() => zoom(-0.12)} className="w-7 h-7 rounded text-slate-300 hover:bg-white/10">−</button>
          <span className="text-xs w-11 text-center tabular-nums">{Math.round(tr.s * 100)}%</span>
          <button onClick={() => zoom(0.12)} className="w-7 h-7 rounded text-slate-300 hover:bg-white/10">+</button>
          <button onClick={fit} className="text-xs px-2 h-7 rounded text-slate-300 hover:bg-white/10">Fit</button>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={frameRef}
        onWheel={onWheel}
        onMouseDown={onDown}
        className="flex-1 relative overflow-hidden cursor-grab"
        style={{
          backgroundColor: '#0a1226',
          backgroundImage: 'linear-gradient(rgba(90,194,191,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(90,194,191,0.05) 1px, transparent 1px), radial-gradient(circle at 26% 8%, rgba(30,125,127,0.20), transparent 68%)',
          backgroundSize: '32px 32px, 32px 32px, 100% 100%',
        }}
      >
        <div className="absolute top-0 left-0" style={{ transform: `translate(${tr.x}px, ${tr.y}px) scale(${tr.s})`, transformOrigin: '0 0', transition: dragging ? 'none' : 'transform .16s ease-out' }}>
          <div className="flex items-start gap-6 p-8">
            {cols.map((t, i) => {
              const st = IMPERSONATE(t) ? toks[t] : undefined
              const name = t === 'admin' ? `${myName} · you` : (st?.name ?? '—')
              const src = IMPERSONATE(t) ? (st?.token ? `/?_vs=${encodeURIComponent(st.token)}` : null) : '/'
              return (
                <div key={i} className="flex flex-col items-center gap-2" style={{ width: DV.w * DV.base }}>
                  {/* column header */}
                  <div className="w-full bg-[#12294d] border border-white/10 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-[#94C4C5]">{LABEL[t]}</span>
                      <select
                        value={t}
                        onChange={e => swap(i, e.target.value as Tier)}
                        className="bg-[#0a1226] border border-white/15 rounded text-[11px] px-1.5 py-0.5 text-slate-200"
                      >
                        {TIERS.map(op => <option key={op} value={op}>{LABEL[op]}</option>)}
                      </select>
                    </div>
                    <div className="text-sm text-white truncate mt-0.5">{name}</div>
                  </div>

                  {/* device frame */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl" style={{ width: DV.w * DV.base, height: DV.h * DV.base + 26 }}>
                    <div className="h-[26px] bg-slate-200 flex items-center gap-1.5 px-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div style={{ width: DV.w * DV.base, height: DV.h * DV.base, overflow: 'hidden', background: '#fff' }}>
                      {src ? (
                        <iframe
                          src={src}
                          title={`${LABEL[t]} — desktop`}
                          style={{ width: DV.w, height: DV.h, border: 'none', transform: `scale(${DV.base})`, transformOrigin: 'top left', background: '#fff' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-center text-xs text-slate-500 p-4">
                          {st?.loading ? 'Loading…' : (st?.error ?? 'No user of this tier.')}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">{DV.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="absolute left-4 bottom-4 text-[11px] text-slate-400 bg-[#0a1226]/85 border border-white/10 rounded-lg px-3 py-2 max-w-md">
          Drag the background to move · scroll to zoom. Each tier is a live preview of what that access level sees — the <b className="text-slate-200">Admin</b> column is your own session.
        </div>
      </div>
    </div>
  )
}
