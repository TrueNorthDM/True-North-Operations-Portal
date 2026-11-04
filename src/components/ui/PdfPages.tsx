'use client'

// PdfPages: a PDF drawn as white sheets, read only (the annual review's file
// beside the form, design handoff C4, 4 November 2026). pdf.js paints each
// page on a canvas: no toolbar, no pen, no download, nothing to change. The
// sheets fit the width they are given and redraw when it changes.

import { useEffect, useRef, useState } from 'react'

export function PdfPages({ url, title }: { url: string; title: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    const el = box.current
    if (!el) return
    let gone = false
    let task: { destroy(): Promise<void> } | null = null
    const draw = async () => {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      const loading = pdfjs.getDocument({ url, withCredentials: true })
      task = loading
      const doc = await loading.promise
      if (gone) return
      el.replaceChildren()
      const width = el.clientWidth
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        if (gone) return
        const base = page.getViewport({ scale: 1 })
        const scale = width / base.width
        const ratio = window.devicePixelRatio || 1
        const view = page.getViewport({ scale: scale * ratio })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(view.width)
        canvas.height = Math.floor(view.height)
        canvas.style.width = `${Math.floor(view.width / ratio)}px`
        canvas.style.height = `${Math.floor(view.height / ratio)}px`
        canvas.className = 'block bg-white shadow-[0_4px_14px_rgba(1,35,88,.10)]'
        canvas.setAttribute('aria-label', `${title}, page ${n} of ${doc.numPages}`)
        el.appendChild(canvas)
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: view }).promise
      }
      if (!gone) setState('ready')
    }
    draw().catch(() => { if (!gone) setState('failed') })
    return () => { gone = true; void task?.destroy() }
  }, [url, title])

  return (
    <div className="flex flex-col gap-3.5">
      {state === 'loading' && <p className="m-0 text-[13px] text-[#8593a4]">Opening the file…</p>}
      {state === 'failed' && <p className="m-0 text-[13px] text-[#c8323d]">The file could not be shown. Try the full screen button above.</p>}
      <div ref={box} className="flex flex-col gap-3.5" onContextMenu={e => e.preventDefault()} />
    </div>
  )
}
