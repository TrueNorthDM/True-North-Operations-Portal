'use client'

/**
 * DeletePageButton: destructive action on the page detail.
 *
 * Two-step confirmation:
 *   1. Click "Delete page" → modal opens with warning
 *   2. Read warning + click "Yes, delete" → action fires
 *
 * Why a modal (not inline confirm or just an undo toast)?
 *   - Deleting a page is irreversible from the UI (no soft-delete).
 *   - The modal forces a deliberate read of the consequences (Monday will
 *     recreate it on next Run Link).
 *   - Inline "click again to confirm" is too easy to misfire and the
 *     consequence isn't recoverable.
 */

import { useState, useTransition } from 'react'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useRouter } from 'next/navigation'
import { deletePage } from '@/app/actions'
import { hrefLinksSite } from '@/lib/nav/routes'

interface Props {
  pageId: string
  pageName: string
  siteCode: 'aaaf' | 'hfa'
}

export function DeletePageButton({ pageId, pageName, siteCode }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const res = await deletePage({ pageId, siteCode })
      if (!res.ok) {
        setError(res.error ?? 'Could not delete page.')
        return
      }
      router.push(withViewAs(hrefLinksSite(siteCode)))
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-[34px] h-[34px] rounded-[9px] border border-[#dc262644] text-[#dc2626] hover:bg-[#dc26260f] transition-colors"
        aria-label={`Delete page ${pageName}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-page-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600" aria-hidden="true">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="delete-page-title" className="text-xl font-(family-name:--font-display) font-extrabold text-tn-ink">
                  Delete this page?
                </h2>
                <p className="text-sm text-foreground mt-1 break-words">
                  <span className="font-bold text-tn-ink">{pageName}</span> will be removed from True North along with all its URLs and confirmations.
                </p>
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                  <p className="font-semibold mb-0.5">Heads up</p>
                  <p>The matching items in Monday are <strong>not</strong> deleted. If their Href Link is set to “Run Link” again, this page will be recreated.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="text-sm font-medium px-3 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {pending ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
