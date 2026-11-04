'use client'

// The Href Links guide's pictures: the real page list and page screen of a
// site, fed the manual's made-up pages (lib/manual/samples/href-links.ts).
// Nothing saves and nothing reaches Monday; the picture around them
// (GuideParts) makes them inert anyway.

import { PageList } from '@/components/PageList'
import { PageDetail } from '@/components/PageDetail'
import { HREF_DOMAIN, HREF_LANGUAGES, hrefPage, hrefRows } from '@/lib/manual/samples/href-links'

export function HrefPageListPicture() {
  return <PageList rows={hrefRows} languages={HREF_LANGUAGES} siteCode="aaaf" accent="aaaf" />
}

export function HrefPageDetailPicture() {
  return (
    <PageDetail
      pageId={hrefPage.pageId}
      siteCode="aaaf"
      pageName={hrefPage.pageName}
      languages={HREF_LANGUAGES}
      domain={HREF_DOMAIN}
      savedUrls={hrefPage.savedUrls}
      confirmations={hrefPage.confirmations}
      accent="aaaf"
    />
  )
}
