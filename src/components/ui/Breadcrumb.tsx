/**
 * The trail above a page heading: where you are, and the way back up.
 *
 * The parents are given as hrefs, never as words. A page cannot get the name of
 * another page wrong if it never types it, which is the whole reason this
 * exists: seventeen pages spelled their own trails and no two agreed on what
 * the home page or the tools hub was called.
 *
 * `now` is the only free text, because a leaf is usually the report, the client
 * or the person being looked at, and no table knows those in advance.
 *
 * Every trail starts at Home. It is not in `parents` because leaving it to each
 * caller is exactly how three pages ended up starting somewhere else.
 */

import Link from 'next/link'
import { NAV_LABEL, type NavHref } from '@/lib/nav/labels'

/** An ancestor that no table can name in advance, like the site a page belongs to. */
interface DynamicParent { href: string; label: string }

export function Breadcrumb(
  { parents = [], now }: {
    /**
     * Ancestors between Home and this page, nearest the root first. An href on
     * its own is named from the table; a {href, label} pair is for the ones
     * that change per row, like a site code.
     */
    parents?: readonly (NavHref | DynamicParent)[]
    /** This page, in its own words. Not a link: you are already here. */
    now: string
  },
) {
  const trail: DynamicParent[] = [
    { href: '/', label: NAV_LABEL['/'] },
    ...parents.map(p => (typeof p === 'string' ? { href: p, label: NAV_LABEL[p] } : p)),
  ]

  return (
    <div className="flex items-center gap-2 text-sm text-muted mb-1">
      {trail.map(c => (
        <span key={c.href} className="flex items-center gap-2">
          <Link href={c.href} className="hover:text-tn-ink transition-colors">{c.label}</Link>
          <span className="text-slate-300">/</span>
        </span>
      ))}
      <span className="text-foreground font-semibold">{now}</span>
    </div>
  )
}
