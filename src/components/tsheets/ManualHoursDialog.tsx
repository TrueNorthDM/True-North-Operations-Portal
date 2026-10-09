'use client'

/**
 * The hand-entry form, opened from the report it feeds.
 *
 * It lived at the foot of the page, then on a page of its own once one form had
 * to serve every client. Neither put it where the hand reaches for it: the other
 * things you do TO a report, exporting it and sharing it, sit in the row above
 * the table, and adding an hour is one of those.
 *
 * A dialog rather than a route because it is a detour, not a destination. You
 * are looking at a month, you add an hour to it, and the number above updates.
 * Sending you to another page and back loses the month you were reading.
 */

import { useRef, useState } from 'react'
import { useModal } from '@/components/ui/useModal'
import { ManualHours, type ManualOptions, type ManualRow } from './ManualHours'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

export function ManualHoursDialog(
  { rows, options, month, blurb, tone = 'primary' }: {
    rows: ManualRow[]; options: ManualOptions; month: string; blurb: string
    /**
     * Which half of the pair this is. A toolbar carries one navy button and the
     * rest in white; on the i7 report this is the navy one, and on Project
     * Hours & Others "Money in" takes that place and this answers it.
     */
    tone?: 'primary' | 'secondary'
  },
) {
  const [open, setOpen] = useState(false)

  // Escape closes it, and the page behind stops scrolling while it is up.
  // Focus in and back, Tab kept inside, Escape, no scrolling behind (useModal).
  const box = useRef<HTMLDivElement>(null)
  useModal(open, box, () => setOpen(false))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={tone === 'primary' ? BTN.navy : BTN.white}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={tone === 'primary' ? BTN_ICON.navy : BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Add hours
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            ref={box}
            role="dialog"
            aria-modal="true"
            aria-label="Add hours by hand"
            className="w-full max-w-4xl rounded-2xl bg-white border border-slate-200 shadow-xl px-6 pt-5 pb-6 my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">
                Hours added by hand
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-full text-muted hover:bg-[var(--row-hover)] hover:text-tn-ink transition-colors flex items-center justify-center"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <ManualHours rows={rows} options={options} month={month} blurb={blurb} />
          </div>
        </div>
      )}
    </>
  )
}
