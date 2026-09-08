'use client'

/**
 * The round navy "i", and what it has to say.
 *
 * Notes about how a report is built are read once and then never again, but
 * they have to be somewhere: the questions they answer ("why is this cell
 * blank", "is this what left the bank") arrive months apart and always from
 * somebody new. Left at the foot of the page they are a wall under every
 * screenshot; behind the button they are one click from the number that
 * prompted the question.
 *
 * A dialog rather than a page, unlike the i7 guide. These are footnotes to what
 * is on screen, and sending somebody to another route to read a footnote loses
 * the month, the tab and the scroll position they were looking at.
 */

import { useEffect, useState } from 'react'

export function InfoDialog(
  { title, label = 'How this report works', children }: {
    title: string
    /** Tooltip on the button, and the dialog's accessible name. */
    label?: string
    children: React.ReactNode
  },
) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className="shrink-0 w-9 h-9 rounded-full bg-tn-primary text-white flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-0.5"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-slate-900/45 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
              <h2 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink m-0">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-full text-muted hover:bg-[var(--row-hover)] hover:text-tn-ink transition-colors flex items-center justify-center"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Spacing declared on the children rather than with space-y: the
                paragraphs handed in carry m-0, which lands later in the cascade
                and cancels it. */}
            <div className="px-6 py-5 text-sm leading-relaxed [&>p+p]:mt-3">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}
