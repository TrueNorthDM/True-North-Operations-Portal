'use client'

// Screen 4.3: the export menu.
//
// CSV needs no question asked, so it stays a plain link. PDF has one, and the
// menu answers the other thing people want to know before clicking: what is
// actually in the file. "This tab, this scope, this period" is there because
// an export that quietly gives you the default view is worse than no export.

import { useEffect, useRef, useState } from 'react'
import { PdfPreview, type PdfRequest } from '@/components/ui/PdfPreview'
import { withViewAs } from '@/components/ViewAsKeeper'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

const ORIENTATION =
  'flex-1 text-center text-[12px] font-bold py-2 rounded-lg border transition-colors'

function DownloadIcon({ tone = 'white' }: { tone?: keyof typeof BTN_ICON }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON[tone]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

const BUTTON = BTN.white

export function ExportMenu({ csvHref, pdfHref }: { csvHref: string; pdfHref: string }) {
  const [open, setOpen] = useState(false)
  const [landscape, setLandscape] = useState(true)
  const [pdf, setPdf] = useState<PdfRequest | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // Clicking anywhere else closes it. Without this the menu stays open behind
  // the next thing the person does, which reads as the page having frozen.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  // Both files keep a View Stage preview (?_vs): without it they were built
  // as the person signed in, not as the level being previewed.
  const sep = pdfHref.includes('?') ? '&' : '?'
  const href = `${pdfHref}${sep}orientation=${landscape ? 'landscape' : 'portrait'}`

  return (
    <div className="flex items-center gap-2.5">
      {/* The preview token is read at the click, not in render, so the server
          and the browser draw the same link. */}
      <a className={BUTTON} href={csvHref} onClick={e => { e.currentTarget.href = withViewAs(csvHref) }}>
        <DownloadIcon />CSV
      </a>

      <div className="relative" ref={box}>
        <button type="button" className={BUTTON} onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <DownloadIcon />PDF
        </button>

        {open ? (
          <div className="absolute right-0 top-full mt-1.5 z-30 w-[232px] bg-white border border-[var(--panel-border)] rounded-[11px] shadow-[0_20px_44px_-18px_rgba(1,35,88,.5)] px-3 py-2.5">
            <p className="text-[12.5px] text-foreground m-0 mb-2 leading-[1.5]">
              This tab, this scope, this period.
            </p>
            <div className="flex gap-2 mb-2.5">
              {([false, true] as const).map(l => (
                <button
                  key={String(l)}
                  type="button"
                  onClick={() => setLandscape(l)}
                  className={`${ORIENTATION} ${l === landscape
                    ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.07)]'
                    : 'border-[var(--panel-border)] text-foreground'}`}
                >
                  {l ? 'Landscape' : 'Portrait'}
                </button>
              ))}
            </div>
            {/* Built and shown before it is offered, the portal's rule for
                every PDF. The orientation chosen above is part of the request,
                so the preview is the document that would be saved. */}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setPdf({ url: withViewAs(href), title: `Report, ${landscape ? 'landscape' : 'portrait'}`, fallbackName: 'report.pdf' })
              }}
              className={`${BTN.navy} w-full justify-center`}
            >
              <DownloadIcon tone="navy" />
              Build the PDF
            </button>
          </div>
        ) : null}
      </div>
      <PdfPreview request={pdf} onClose={() => setPdf(null)} />
    </div>
  )
}
