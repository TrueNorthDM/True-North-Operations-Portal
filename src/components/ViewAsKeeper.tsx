'use client'

/**
 * ViewAsKeeper: keeps a View Stage preview impersonating as you navigate.
 *
 * The impersonation lives entirely in the URL (?_vs=<token>, relayed by the
 * proxy into the x-vs header). That is deliberate: View Stage renders several
 * levels side by side in iframes at once, so it cannot be held in a cookie,
 * one cookie could not represent three different impersonations.
 *
 * The cost was that any navigation inside a preview dropped the token, and the
 * result LOOKED right: Next reuses the already-rendered layout (correct avatar,
 * correct sidebar) and fetches only the new page segment, which then rendered
 * as the real admin. A preview that quietly shows your own data is worse than
 * one that refuses to navigate, so this carries the token along.
 *
 * Inert unless a token is present, so normal use is untouched. Modified clicks
 * (new tab, download) are left alone.
 */

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function ViewAsKeeper() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('_vs')
    if (!token) return

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || anchor.target === '_blank') return
      if (/^(https?:|mailto:|tel:|#)/i.test(href)) return

      // Against the page, not the origin: "?tab=work" stays on this page.
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin || url.searchParams.has('_vs')) return

      // Next's Link navigates from its href PROP, not the DOM attribute, so
      // rewriting the attribute would do nothing. Take the navigation over.
      url.searchParams.set('_vs', token as string)
      e.preventDefault()
      e.stopPropagation()
      router.push(url.pathname + url.search)
    }

    // Capture phase, so this runs before Link's own handler.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [router, pathname])

  return null
}

/** Appends the active preview token to a href, for router.push callers. */
export function withViewAs(href: string): string {
  if (typeof window === 'undefined') return href
  const token = new URLSearchParams(window.location.search).get('_vs')
  if (!token) return href
  const url = new URL(href, window.location.href)
  if (url.searchParams.has('_vs')) return href
  url.searchParams.set('_vs', token)
  return url.pathname + url.search
}
