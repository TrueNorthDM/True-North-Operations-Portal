'use client'

/**
 * Build a PDF, show it, and only then offer it.
 *
 * The portal used to download one straight from the click. These carry a
 * client's budget, per-person costs and the hourly rates behind them, and a file
 * that lands in Downloads is checked after it has left, if at all. The first
 * look should happen while it can still be discarded.
 *
 * It also answers a question the old flow left open. Generation runs headless
 * Chromium and takes seconds; a click that does nothing visible for that long is
 * indistinguishable from one that failed.
 *
 * The rule is the portal's, not this screen's: every PDF, here and in whatever
 * is added later, goes through this.
 */

import { useEffect, useState } from 'react'

export interface PdfRequest {
  /** Where to fetch it from. */
  url: string
  /** Shown in the dialog header, e.g. "Client report, September 2026". */
  title: string
  /** Used if the response carries no filename. */
  fallbackName: string
}

/**
 * Keyed by the URL, so asking for a second PDF mounts a fresh dialog instead of
 * clearing the first one's state by hand. Resetting inside the effect would run
 * a render's worth of the previous PDF before the new one took over, and would
 * be a setState in an effect, which is the cascade this codebase avoids.
 */
export function PdfPreview({ request, onClose }: { request: PdfRequest | null; onClose: () => void }) {
  if (!request) return null
  return <PdfDialog key={request.url} request={request} onClose={onClose} />
}

function PdfDialog({ request, onClose }: { request: PdfRequest; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let created: string | null = null

    ;(async () => {
      try {
        const res = await fetch(request.url)
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        const cd = res.headers.get('Content-Disposition') ?? ''
        // The filename the server chose, which carries the month and the report
        // kind. Falling back to a generic one would lose both.
        const match = /filename\*?=(?:UTF-8''|")?([^";]+)/.exec(cd)
        created = URL.createObjectURL(blob)
        setName(match ? decodeURIComponent(match[1]) : request.fallbackName)
        setBlobUrl(created)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not build the PDF.')
      }
    })()

    return () => {
      cancelled = true
      // Revoked on the way out rather than after the download: the same object
      // URL is what the preview is still showing.
      if (created) URL.revokeObjectURL(created)
    }
  }, [request])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 bg-slate-900/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        className="w-full max-w-5xl h-full max-h-[88vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink m-0 truncate">
              {request.title}
            </h2>
            <p className="text-[12.5px] text-muted m-0 truncate">
              {error ? 'Could not be built' : blobUrl ? name : 'Building the PDF…'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full text-muted hover:bg-[var(--row-hover)] hover:text-tn-ink transition-colors flex items-center justify-center"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 bg-subtle">
          {error ? (
            <div className="h-full flex items-center justify-center p-8">
              <p className="text-[13.5px] text-[var(--bdg-red-fg)] text-center max-w-[52ch] m-0 break-words">{error}</p>
            </div>
          ) : blobUrl ? (
            <iframe src={blobUrl} title={request.title} className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <svg className="animate-spin w-6 h-6 text-tn-teal" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="text-[13px] text-muted m-0">Building the PDF. This takes a few seconds.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="font-(family-name:--font-display) font-extrabold text-[13px] text-foreground bg-transparent border border-slate-200 rounded-[10px] px-[18px] py-[11px] transition-colors hover:border-slate-300 hover:text-tn-ink"
          >
            Close
          </button>
          {/* Only once there is something to download. A button that cannot do
              its job yet is worse than one that is not there. */}
          {blobUrl && (
            <a
              href={blobUrl}
              download={name}
              className="inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform hover:-translate-y-px"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              <span className="text-[#ffffff]">Download</span>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
