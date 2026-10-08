/**
 * The trail above a page heading: where you are, and the way back up.
 *
 * The parents are given as hrefs, never as words. A page cannot get the name of
 * another page wrong if it never types it, which is the whole reason this
 * exists: seventeen pages spelled their own trails and no two agreed on what
 * the home page or the tools hub was called.
 *
 * `now` is the only free text, because a leaf is usually the report, the client
 * or the person being looked at, and no table knows those in advance. A page
 * that IS one of the named places passes `self` instead and gets its own name
 * from the table too: the Directory said "People" while the rail said "People,
 * Teams and Permissions", and a page repeating a name the table already holds
 * is the same drift one level down.
 *
 * Every trail starts at Home. It is not in `parents` because leaving it to each
 * caller is exactly how three pages ended up starting somewhere else.
 */

import Link from 'next/link'
import { NAV_LABEL, type NavHref } from '@/lib/nav/labels'

/**
 * An ancestor that no table can name in advance, like the site a page belongs
 * to. link: false shows it as words only, for a place this viewer cannot open
 * (a trail must never lead to a page that refuses).
 */
interface DynamicParent { href: string; label: string; link?: boolean }

/**
 * The Admin step of a trail: a link for whoever opens Admin's landing page,
 * words only for someone who holds just this one admin page.
 */
export const adminCrumb = (canOpenAdmin: boolean): NavHref | DynamicParent =>
  canOpenAdmin ? '/admin' : { href: '/admin', label: NAV_LABEL['/admin'], link: false }

type Props = {
  /**
   * Ancestors between Home and this page, nearest the root first. An href on
   * its own is named from the table; a {href, label} pair is for the ones that
   * change per row, like a site code.
   */
  parents?: readonly (NavHref | DynamicParent)[]
} & (
  /** A leaf: the report, client or person being looked at, in its own words. */
  | { now: string; self?: never }
  /** A page that is one of the named places, and takes its name from the table. */
  | { self: NavHref; now?: never }
)

export function Breadcrumb({ parents = [], now, self }: Props) {
  const here = now ?? NAV_LABEL[self!]
  const trail: DynamicParent[] = [
    { href: '/', label: NAV_LABEL['/'] },
    ...parents.map(p => (typeof p === 'string' ? { href: p, label: NAV_LABEL[p] } : p)),
  ]

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted mb-1">
      {trail.map(c => (
        <span key={c.href} className="flex items-center gap-2">
          {c.link === false ? <span>{c.label}</span> : <Link href={c.href} className="hover:text-tn-ink transition-colors">{c.label}</Link>}
          <span className="text-slate-300">/</span>
        </span>
      ))}
      <span aria-current="page" className="text-foreground font-semibold">{here}</span>
    </nav>
  )
}
