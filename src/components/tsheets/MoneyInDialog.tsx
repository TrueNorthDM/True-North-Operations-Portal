'use client'

/**
 * The money that arrived this month, typed in from the report it feeds.
 *
 * Two things on one screen because they are one act from the report's side:
 * money arriving for a project in a month. Donations are given, restricted to a
 * project or not; prepaid hours are bought, and only Grants Pass Church and
 * School buy them.
 *
 * Opened from the report rather than living on a page of its own, for the same
 * reason hand-entered hours are: you are looking at a month, you put a figure
 * into it, and the number above updates. A detour, not a destination.
 *
 * Every field at once, saved together. There are seven of them at most and they
 * arrive as one batch off a bank statement, so a save per field would be six
 * more clicks and six more chances to leave half of it done.
 */

import { Fragment, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDonation, savePurchase } from '@/lib/timeclock/money-in-actions'
import { UNRESTRICTED, type MoneyInMonth } from '@/lib/timeclock/money-in-data'

const FIELD = 'w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2 text-[13.5px] text-tn-ink font-semibold placeholder:font-normal text-right tabular-nums'
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5'

function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function MoneyInDialog(
  { data, projects }: {
    data: MoneyInMonth
    /** label, name and whether it buys hours, in the report's own order. */
    projects: readonly { label: string; name: string; prepaid: boolean }[]
  },
) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [gifts, setGifts] = useState(data.donations)
  const [buys, setBuys] = useState(data.purchases)

  // Reopening after a save has to show what was saved, not what was typed
  // before it. The month can change underneath this too, from the picker above.
  const [seen, setSeen] = useState(data)
  if (seen !== data) { setSeen(data); setGifts(data.donations); setBuys(data.purchases) }

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

  function save() {
    setError(null)
    start(async () => {
      // Sequentially, and stopping at the first refusal. A batch that half
      // applies leaves somebody guessing which half, and there are seven rows
      // at most so nothing is gained by firing them together.
      for (const p of projects) {
        const r = await saveDonation({ project: p.label, month: data.month, amount: gifts[p.label] ?? '' })
        if (!r.ok) { setError(r.error ?? 'Could not save.'); return }
      }
      const fund = await saveDonation({ project: null, month: data.month, amount: gifts[UNRESTRICTED] ?? '' })
      if (!fund.ok) { setError(fund.error ?? 'Could not save.'); return }

      for (const p of projects.filter(p => p.prepaid)) {
        const b = buys[p.label] ?? { hours: '', amount: '' }
        const r = await savePurchase({ project: p.label, month: data.month, hours: b.hours, amount: b.amount })
        if (!r.ok) { setError(r.error ?? 'Could not save.'); return }
      }

      setOpen(false)
      router.refresh()
    })
  }

  const setGift = (k: string, v: string) => setGifts(g => ({ ...g, [k]: v }))
  const setBuy = (k: string, part: 'hours' | 'amount', v: string) =>
    setBuys(b => ({ ...b, [k]: { ...(b[k] ?? { hours: '', amount: '' }), [part]: v } }))

  return (
    <>
      {/* Leftmost of three, navy with a white mark: on the i7 toolbar the gold
          belongs to Export at the far end, not to the button that opens a form. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2.5 bg-tn-primary text-white rounded-[10px] px-[18px] py-[11px] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-transform hover:-translate-y-px"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span className="text-[#ffffff]">Money in</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Money in"
            className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl px-6 pt-5 pb-6 my-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4">
              <div>
                <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">
                  Money in, {monthName(data.month)}
                </h2>
                <p className="mt-1 text-[13px] text-muted leading-relaxed m-0">
                  Donations and hours bought in advance. Leave a field empty to say nothing came in;
                  a blank stays blank on the report rather than reading as zero.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 w-8 h-8 rounded-full text-muted hover:bg-[var(--row-hover)] hover:text-tn-ink transition-colors flex items-center justify-center"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0 pb-2">Donations</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {projects.map(p => (
                <label key={p.label} className="block">
                  <span className={LABEL}>{p.name}</span>
                  <input
                    inputMode="decimal" placeholder="0.00" className={FIELD}
                    value={gifts[p.label] ?? ''} onChange={e => setGift(p.label, e.target.value)}
                  />
                </label>
              ))}
            </div>

            {/* Across the full width and behind a rule, because it is not a
                fifth project: "otherwise the donation goes under unrestricted
                and used for all projects". Sitting it in the grid beside the
                four would say it was one of them. */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <label className="block sm:w-1/2 sm:pr-2">
                <span className={LABEL}>Unrestricted <span className="normal-case font-normal tracking-normal text-muted">no project</span></span>
                <input
                  inputMode="decimal" placeholder="0.00" className={FIELD}
                  value={gifts[UNRESTRICTED] ?? ''} onChange={e => setGift(UNRESTRICTED, e.target.value)}
                />
              </label>
            </div>

            <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.1em] text-muted m-0 pt-6 pb-1">
              Hours bought in advance
            </p>
            <p className="text-[12.5px] text-muted leading-relaxed m-0 pb-3">
              Church and School only, at $90 an hour. The amount invoiced is optional and is kept
              beside the hours it bought so the two can be checked against each other.
            </p>

            {/* A row per project rather than two nested grids. The labels are
                different lengths, so putting one over each field staggered the
                boxes: "Grants Pass Church, hours" wrapped to two lines while
                "Invoiced" did not. Naming the columns once fixes both the
                alignment and the repetition. */}
            <div className="grid grid-cols-[1fr_minmax(0,7rem)_minmax(0,7rem)] gap-x-3 gap-y-2 items-center">
              <span />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted text-right pr-1">Hours</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted text-right pr-1">Invoiced</span>

              {projects.filter(p => p.prepaid).map(p => (
                <Fragment key={p.label}>
                  <span className="text-[13.5px] font-semibold text-tn-ink">{p.name}</span>
                  <input
                    inputMode="decimal" placeholder="0.00" className={FIELD} aria-label={`${p.name}, hours bought`}
                    value={buys[p.label]?.hours ?? ''} onChange={e => setBuy(p.label, 'hours', e.target.value)}
                  />
                  <input
                    inputMode="decimal" placeholder="0.00" className={FIELD} aria-label={`${p.name}, amount invoiced`}
                    value={buys[p.label]?.amount ?? ''} onChange={e => setBuy(p.label, 'amount', e.target.value)}
                  />
                </Fragment>
              ))}
            </div>

            {error && (
              <p className="mt-4 mb-0 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-5">
              <button
                type="button" onClick={() => setOpen(false)} disabled={busy}
                className="text-[13px] font-bold px-4 py-2.5 rounded-[10px] text-muted hover:text-tn-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button" onClick={save} disabled={busy}
                className="inline-flex items-center gap-2 text-[13px] font-bold px-5 py-2.5 rounded-[10px] bg-tn-primary text-white hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
