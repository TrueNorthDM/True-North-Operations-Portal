'use client'

/**
 * A file the portal keeps (a receipt, a PDF someone sent, an imported review)
 * shown in a window over the page, never in a new tab (owner, 10 November
 * 2026). The file is read as the person (the same address the links used),
 * so the browser draws it from its own type: a photo as a picture, a PDF in
 * the browser's viewer, anything else (a HEIC photo) with a line saying to
 * download it. Several files (a request's receipts) step with the arrows.
 * Download saves the file under the server's name for it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '@/components/ui/useModal'
import { withViewAs } from '@/components/ViewAsKeeper'
import { CloseButton } from '@/components/clocky/entries/ui'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { MODAL_BACKDROP, MODAL_PANEL } from '@/lib/ui/modal'
import { nameFromDisposition } from '@/lib/drive/file-names'

export interface ViewFile {
  /** The portal address that serves it. */
  href: string
  /** What the window calls it: the receipt's purpose, or the file's name. */
  title: string
  /** The line under it: "Nov 9 · Other · $256.00". */
  sub?: string
  /** The file's name when the server gives none. */
  name: string
}

export function FileViewer({ files, start = 0, onClose }: { files: ViewFile[]; start?: number; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  // It opens over a drawer or a card that also closes on Escape: Escape here closes only this window.
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])
  const [at, setAt] = useState(Math.min(Math.max(start, 0), files.length - 1))
  const f = files[at]
  const many = files.length > 1
  // On the page's body, so a card or drawer it opens from never clips or shifts it.
  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} className={`fixed inset-0 z-[90] ${MODAL_BACKDROP} flex items-center justify-center p-3 md:p-6`}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={f.title} className={`w-full h-full max-w-[900px] max-h-[860px] ${MODAL_PANEL} flex flex-col overflow-hidden leading-[normal]`}>
        {/* Keyed by the file: each one reads its own and frees it on the way out. */}
        <FileBody key={f.href} file={f} many={many} at={at} count={files.length} onStep={d => setAt(i => (i + d + files.length) % files.length)} onClose={onClose} />
      </div>
    </div>,
    document.body,
  )
}

function FileBody({ file, many, at, count, onStep, onClose }: { file: ViewFile; many: boolean; at: number; count: number; onStep: (d: number) => void; onClose: () => void }) {
  const [shown, setShown] = useState<{ url: string; type: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    ;(async () => {
      try {
        const res = await fetch(withViewAs(file.href))
        if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setShown({ url: created, type: blob.type, name: nameFromDisposition(res.headers.get('content-disposition')) || file.name })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.message.length < 200 ? e.message : 'The file could not be opened. Try again in a moment.')
      }
    })()
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [file.href, file.name])

  const kind = !shown ? null : shown.type.startsWith('image/') && shown.type !== 'image/heic' && shown.type !== 'image/heif' ? 'image' : shown.type === 'application/pdf' ? 'pdf' : 'other'
  const arrow = 'w-9 h-9 flex-none rounded-[10px] border border-[var(--panel-border)] bg-white text-tn-ink flex items-center justify-center hover:border-tn-teal'
  return (
    <>
      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 px-[18px] py-3.5 border-b border-[var(--row-rule)]">
        <span className="w-[34px] h-[34px] rounded-[10px] bg-tn-teal-soft text-tn-teal flex items-center justify-center flex-none">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={CLIP} /></svg>
        </span>
        <div className="flex-1 min-w-0 basis-[calc(100%-46px)] md:basis-auto">
          <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink [overflow-wrap:anywhere]">{file.title}</div>
          <div className="text-[12px] text-muted [overflow-wrap:anywhere] tabular-nums lining-nums">{[file.sub, shown?.name].filter(Boolean).join(' · ')}</div>
        </div>
        {many && (
          <span className="flex items-center gap-2">
            <span className="text-[12.5px] font-bold text-muted whitespace-nowrap">{at + 1} of {count}</span>
            <button type="button" aria-label="Previous file" onClick={() => onStep(-1)} className={arrow}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" aria-label="Next file" onClick={() => onStep(1)} className={arrow}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </span>
        )}
        <CloseButton onClick={onClose} />
      </div>

      <div className="flex-1 min-h-0 bg-[#e9e6dd] flex items-center justify-center overflow-auto p-3 md:p-[22px]">
        {error ? (
          <p className="m-0 text-[13.5px] text-[#c8323d] font-semibold text-center max-w-[52ch] break-words">{error}</p>
        ) : !shown ? (
          <p className="m-0 text-[13px] text-muted">Opening the file…</p>
        ) : kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown.url} alt={file.title} className="max-w-full max-h-full object-contain bg-white shadow-[0_12px_30px_-14px_rgba(1,35,88,.4)]" />
        ) : kind === 'pdf' ? (
          <iframe src={shown.url} title={file.title} className="w-full h-full border-0 bg-white" />
        ) : (
          <p className="m-0 text-[13.5px] text-muted text-center max-w-[52ch] leading-[1.55]">This kind of file cannot be shown here. Download it to open it on your computer.</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2.5 px-[18px] py-3 border-t border-[var(--row-rule)]">
        <button type="button" onClick={onClose} className={BTN.white}>Close</button>
        {shown && (
          <a href={shown.url} download={shown.name} className={BTN.navy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
            Download
          </a>
        )}
      </div>
    </>
  )
}

/** The attachment symbol, for the buttons that open a file here. */
export const CLIP = 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'

/** A receipt's file in the viewer. */
export const receiptFile = (r: { id: number; file: string }, title: string, sub?: string): ViewFile =>
  ({ href: `/requests/reimbursements/receipt/${r.id}`, title, sub, name: r.file })

/** A button that opens one file in the window: for the places that only show a file (an invoice's own PDF, an imported review). */
export function FileButton({ file, className, title, children }: { file: ViewFile; className?: string; title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" title={title} onClick={() => setOpen(true)} className={className}>{children}</button>
      {open && <FileViewer files={[file]} onClose={() => setOpen(false)} />}
    </>
  )
}
