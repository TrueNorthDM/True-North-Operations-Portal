/**
 * One Href Links page (server component), shared by both sites' detail
 * routes. The route files keep their own access check and render this.
 *
 * Audit, 10 October 2026: per-site grants apply here too; the page is read
 * together with its site, so a page of the other site is not found under this
 * one's address; a failed read says so in the page.
 */

import { notFound, redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { loadSite, loadSitePage, mayOpenSite } from '@/lib/href-links/data'
import type { SiteCode } from '@/lib/href-links/rules'
import { PageDetail } from '@/components/PageDetail'
import { SITE_BRAND } from './site-brand'
import { HrefLinksReadError } from './ReadError'
import { attempt } from './load'

export async function SitePageDetail({ code, id }: { code: SiteCode; id: string }) {
  const brand = SITE_BRAND[code]

  const site = await attempt('the site', () => loadSite(code))
  if (!site.ok) return <HrefLinksReadError now={brand.label} />
  const allowed = await attempt('the site access', () => mayOpenSite(site.value.id))
  if (!allowed.ok) return <HrefLinksReadError now={brand.label} />
  // Outside any try: redirect and notFound work by throwing.
  if (!allowed.value) redirect(await previewHref('/'))

  const page = await attempt('the page', () => loadSitePage(site.value, id))
  if (!page.ok) return <HrefLinksReadError now={brand.label} />
  if (!page.value) notFound()
  const p = page.value

  return (
    <PageDetail
      pageId={p.id}
      siteCode={code}
      pageName={p.name}
      languages={site.value.languages}
      domain={site.value.domain}
      savedUrls={p.savedUrls}
      confirmations={p.confirmations}
      accent={code}
      needsUpdate={p.needsUpdate}
      confirmedDoneAt={p.confirmedDoneAt}
      notRelevant={p.notRelevant ?? false}
      done={p.done}
    />
  )
}
