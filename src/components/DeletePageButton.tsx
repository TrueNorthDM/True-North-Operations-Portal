'use client'

/**
 * DeletePageButton: deletes a page from the portal, after asking.
 *
 * The question goes through the portal's own confirmation (useConfirm) rather
 * than a dialog built here (audit, 10 October 2026): it names the page and
 * says what deleting does not do. Monday keeps the page's items, so Run Link
 * creates the page again. The server finds the page's site itself, so only
 * the page is sent.
 */

import { useState, useTransition } from 'react'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useRouter } from 'next/navigation'
import { deletePage } from '@/app/(app)/seo/href-links/actions'
import { hrefLinksSite } from '@/lib/nav/routes'
import { useConfirm } from '@/components/ui/useConfirm'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import type { SiteCode } from '@/lib/href-links/rules'

interface Props {
  pageId: string
  pageName: string
  /** Where to go once it is deleted: the site's list. */
  siteCode: SiteCode
}

export function DeletePageButton({ pageId, pageName, siteCode }: Props) {
  const [confirmDialog, confirm] = useConfirm()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function handleClick() {
    const yes = await confirm({
      title: 'Delete this page?',
      body: (
        <>
          <p className="m-0 break-words">
            <b className="text-tn-ink">{pageName}</b> is removed from the portal, with its links and confirmations.
          </p>
          <p className="mt-2 mb-0">
            Monday still has its items: setting Run Link on them creates the page again.
          </p>
        </>
      ),
      action: 'Delete page',
      danger: true,
    })
    if (!yes) return
    setError(null)
    startTransition(async () => {
      const res = await deletePage({ pageId })
      if (!res.ok) {
        setError(res.error ?? 'Not deleted. Try again in a moment.')
        return
      }
      router.push(withViewAs(hrefLinksSite(siteCode)))
    })
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button type="button" onClick={handleClick} disabled={pending} className={`${BTN.white} disabled:opacity-50`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
        {pending ? 'Deleting…' : 'Delete page'}
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
      {confirmDialog}
    </div>
  )
}
