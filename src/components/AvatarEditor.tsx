'use client'

/**
 * AvatarEditor — a drag-and-drop / pick → crop modal. The chosen image sits in a
 * circular viewport you can drag to reposition and zoom with the slider; Save
 * exports the visible circle as a square JPEG blob (handed back via onSave).
 */

import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'

const V = 280 // viewport (crop circle) diameter, px
const OUT = 400 // exported square size, px

export function AvatarEditor({ open, onClose, onSave, busy }: {
  open: boolean
  onClose: () => void
  onSave: (blob: Blob) => Promise<void> | void
  busy?: boolean
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // display geometry: at zoom 1 the image "covers" the circle; zoom scales up
  const base = nat ? Math.max(V / nat.w, V / nat.h) : 1
  const s = base * zoom
  const dispW = nat ? nat.w * s : 0
  const dispH = nat ? nat.h * s : 0
  const left = (V - dispW) / 2 + offset.x
  const top = (V - dispH) / 2 + offset.y

  const clamp = (o: { x: number; y: number }, ss = s) => {
    const w = nat ? nat.w * ss : 0
    const h = nat ? nat.h * ss : 0
    const mx = Math.max(0, (w - V) / 2)
    const my = Math.max(0, (h - V) / 2)
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) }
  }

  function loadFile(file: File | undefined | null) {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (file.size > 12 * 1024 * 1024) { setError('Image is larger than 12 MB.'); return }
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => { setNat({ w: img.naturalWidth, h: img.naturalHeight }); setZoom(1); setOffset({ x: 0, y: 0 }); setSrc(url) }
    img.onerror = () => setError('Could not read that image.')
    img.src = url
  }

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }))
  }
  function onPointerUp() { drag.current = null }

  function onZoom(v: number) {
    const ns = base * v
    setZoom(v)
    setOffset(o => clamp(o, ns))
  }

  async function save() {
    const img = imgRef.current
    if (!img || !nat) return
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Map the circle viewport (0..V) back to source pixels.
    ctx.drawImage(img, -left / s, -top / s, V / s, V / s, 0, 0, OUT, OUT)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/jpeg', 0.9))
    if (blob) await onSave(blob)
  }

  function reset() { setSrc(null); setNat(null); setZoom(1); setOffset({ x: 0, y: 0 }) }
  function close() { reset(); onClose() }

  if (!open) return null
  const btn = 'font-(family-name:--font-display) font-extrabold text-[13px] rounded-[10px] px-4 py-2.5 transition-all'

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <div onClick={close} className="fixed inset-0 bg-[rgba(1,20,45,.5)] backdrop-blur-[2px]" />
      <div className="relative w-[360px] max-w-full bg-white rounded-[18px] border border-slate-200 shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] p-6">
        <h3 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0 mb-4">Profile photo</h3>

        {!src ? (
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]) }}
            className="flex flex-col items-center justify-center gap-2 h-[200px] border-2 border-dashed border-slate-300 rounded-[14px] cursor-pointer hover:border-tn-teal transition-colors text-center px-6"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            <span className="text-[13.5px] font-semibold text-tn-ink">Drag &amp; drop a photo</span>
            <span className="text-[12px] text-muted">or click to choose</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => loadFile(e.target.files?.[0])} />
          </label>
        ) : (
          <>
            <div
              className="relative mx-auto rounded-full overflow-hidden bg-slate-100 touch-none select-none cursor-grab active:cursor-grabbing"
              style={{ width: V, height: V }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={src} alt="" draggable={false} style={{ position: 'absolute', left, top, width: dispW, height: dispH, maxWidth: 'none' }} />
              <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/70" />
            </div>
            <div className="flex items-center gap-3 mt-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8593a4" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M8 11h6" /></svg>
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={e => onZoom(+e.target.value)} className="flex-1 accent-tn-teal" aria-label="Zoom" />
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8593a4" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M8 11h6M11 8v6" /></svg>
            </div>
            <button type="button" onClick={reset} className="mt-3 text-[12.5px] font-semibold text-muted hover:text-tn-ink transition-colors">Choose a different photo</button>
          </>
        )}

        {error && <p className="text-[12.5px] text-red-600 mt-2">{error}</p>}

        <div className="flex items-center justify-end gap-2.5 mt-5">
          <button type="button" onClick={close} className={`${btn} text-foreground border border-slate-200 hover:border-tn-ink`}>Cancel</button>
          <button type="button" disabled={!src || busy} onClick={save} className={`${btn} text-white bg-tn-primary hover:brightness-110 disabled:opacity-50`}>
            <span className="text-[#ffffff]">{busy ? 'Saving…' : 'Save photo'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
