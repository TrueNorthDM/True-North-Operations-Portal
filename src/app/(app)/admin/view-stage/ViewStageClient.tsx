'use client'

// View Stage, the portal through each permission tier, side by side, on a
// pan/zoom canvas. Each column is a level rendered in an iframe, as a real
// person of that level, through a signed token on the iframe URL (?_vs=).
// Nothing is saved from inside a preview (lib/access/resolve.ts). Desktop-only. Theme-aware chrome
// (portal identity), the iframes themselves render the portal in the theme.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { tokenViewAs } from './actions'
import { Select } from '@/components/ui/Select'
import type { ViewAsRole } from '@/lib/auth/view-as'
import { PREVIEW_CAVEATS } from '@/lib/access/preview-fidelity'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

type Tier = 'super_admin' | ViewAsRole
const TIERS: Tier[] = ['super_admin', 'admin', 'team_leader', 'user']
const LABEL: Record<Tier, string> = {
  super_admin: 'Super Admin', admin: 'Admin', team_leader: 'Team Leader', user: 'User',
}
// Super Admin = your own live session (no token); the rest impersonate.
const IMPERSONATE = (t: Tier): t is ViewAsRole => t !== 'super_admin'

const DV = { label: 'Desktop · 1440px', w: 1440, h: 900, base: 0.34 }

type TokState = { token?: string; name?: string; error?: string; loading?: boolean }

export default function ViewStageClient({ myName }: { myName: string }) {
  const [cols, setCols] = useState<Tier[]>([...TIERS])
  const [toks, setToks] = useState<Record<string, TokState>>({})
  const [, startTransition] = useTransition()

  const load = useCallback((t: Tier, force = false) => {
    if (!IMPERSONATE(t)) return
    const role = t
    // A forced refresh keeps the current token on screen until the new one
    // arrives, so the column does not blank out to "Loading…" in between.
    setToks(prev => (!force && (prev[t]?.loading || prev[t]?.token) ? prev : { ...prev, [t]: { ...(force ? prev[t] : {}), loading: true } }))
    startTransition(async () => {
      const res = await tokenViewAs(role)
      setToks(prev => ({ ...prev, [t]: { token: res.token, name: res.name, error: res.error, loading: false } }))
    })
  }, [])
  useEffect(() => { cols.forEach(t => load(t)) }, [cols, load])

  // The columns show whoever holds each level RIGHT NOW, and their tokens last
  // 30 minutes, so the tokens are signed again when this browser tab becomes
  // visible: edit somebody's level in another tab, come back, and the stage
  // reflects it.
  //
  // Only on visibilitychange (audit, 10 October 2026). It also listened to the
  // window's focus event, and hovering a column focuses its iframe (see
  // onMouseEnter below), so the next click on the canvas, the zoom or Fit gave
  // focus back to this window and reloaded every column back to Home.
  const refreshTokens = useCallback(() => { cols.forEach(t => load(t, true)) }, [cols, load])
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') refreshTokens() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshTokens])

  // The explicit Refresh: new tokens and every column reloaded, the Super Admin
  // one included (its address never changes, so only the key remounts it).
  const [reloadNonce, setReloadNonce] = useState(0)
  const refreshAll = useCallback(() => {
    refreshTokens()
    setReloadNonce(n => n + 1)
  }, [refreshTokens])

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
    <div className="-mx-6 -my-8 flex flex-col h-[calc(100vh-var(--chrome-top))] bg-background text-foreground overflow-hidden">
      {/* topbar */}
      <div className="flex items-center gap-3 px-5 h-14 shrink-0 bg-white border-b border-slate-200">
        <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">View Stage</span>
        <span className="text-xs text-muted hidden md:inline">the portal through each access level</span>
        {/*
          The badge states where the preview can be believed, and it has to be
          honest about the answer rather than reassuring.
          The old wording promised that what each column renders "is accurate",
          which was true of menus and guards and false of any screen that
          narrowed its ROWS by who was asking. A team leader's client report was
          the case that proved it, and the preview showed it as correct.
        */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            PREVIEW_CAVEATS.length
              ? 'border-amber-300/60 bg-amber-50 text-[#7a4e05]'
              : 'border-emerald-300/60 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span aria-hidden="true">{PREVIEW_CAVEATS.length ? '⚠' : '✓'}</span>
          {PREVIEW_CAVEATS.length
            ? `Faithful except on ${PREVIEW_CAVEATS.map(c => c.label).join(', ')}`
            : 'Every screen here renders exactly what that level sees'}
        </span>
        <span className="flex-1" />
        <button type="button" onClick={refreshAll} className={BTN.white}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          Refresh
        </button>
        <div className="flex items-center gap-1 bg-subtle border border-slate-200 rounded-lg p-1">
          <button type="button" onClick={() => zoom(-0.12)} aria-label="Zoom out" className="w-7 h-7 rounded text-muted hover:bg-white hover:text-tn-ink transition-colors">−</button>
          <span className="text-xs w-11 text-center tabular-nums text-tn-ink" aria-live="polite">{Math.round(tr.s * 100)}%</span>
          <button type="button" onClick={() => zoom(0.12)} aria-label="Zoom in" className="w-7 h-7 rounded text-muted hover:bg-white hover:text-tn-ink transition-colors">+</button>
          <button type="button" onClick={fit} className="text-xs px-2 h-7 rounded text-muted hover:bg-white hover:text-tn-ink transition-colors font-(family-name:--font-display) font-bold">Fit</button>
        </div>
      </div>

      {/* The reason behind the badge. Two separate limits, and they used to be
          collapsed into one: what the preview cannot show ON SCREEN, and what
          somebody could reach around the portal entirely. Only the second was
          ever written down, which is how a wrong report passed review here. */}
      <div className="shrink-0 bg-subtle border-b border-slate-200 px-5 py-2.5 text-[12.5px] leading-relaxed text-muted">
        Each column shows what that level reaches and what it is shown: the menus, the widgets, the pages that turn
        it away, and the contents of those pages. Access is decided in <strong className="font-semibold text-tn-ink">Access levels</strong> and
        the Teams tab, which is what makes this preview mean something.
        {PREVIEW_CAVEATS.length > 0 && (
          <>
            {' '}
            <span className="text-[#7a4e05]">
              With {PREVIEW_CAVEATS.length === 1 ? 'one exception' : `${PREVIEW_CAVEATS.length} exceptions`}, because
              the preview changes the level but stays signed in as you:
            </span>
            <ul className="mt-1.5 mb-0 pl-4 list-disc space-y-0.5 text-[#7a4e05]">
              {PREVIEW_CAVEATS.map(c => (
                <li key={c.surfaceKey}>
                  <strong className="font-semibold">{c.label}</strong> shows {c.shows}
                </li>
              ))}
            </ul>
          </>
        )}
        <span className="block mt-1.5">
          Separately, none of this shows what somebody could pull out of the database directly, going around the
          portal. A page looking empty proves the portal hides it, not that they have no other way to it.
        </span>
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
              const name = t === 'super_admin' ? `${myName} · you` : (st?.name ?? '-')
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
                          // The first click on an unfocused frame is spent
                          // focusing it, so it never reaches the page: the
                          // avatar menu needed two clicks to open, which reads
                          // as "the menu does not work". Focusing on hover
                          // means the click you make is the click that counts.
                          // contentWindow.focus() focuses the FRAME, not an
                          // element inside it, so it cannot scroll a child into
                          // view and shove the canvas sideways the way an
                          // element focus() did.
                          onMouseEnter={e => e.currentTarget.contentWindow?.focus()}
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
          Drag the background to move · scroll to zoom. Each tier is a live preview of what that access level sees; the <b className="text-tn-ink font-semibold">Super Admin</b> column is your own session. <b className="text-tn-ink font-semibold">Refresh</b> reloads every column.
        </div>
      </div>
    </div>
  )
}
