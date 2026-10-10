// Which pages of a site already have at least one URL: the pages adding a
// language flags for a new hreflang, and the count Settings warns about.
//
// Two plain reads, a page at a time (audit, 10 October 2026). It was one
// query with a "pages!inner" embed, which the server's proxy has refused since
// the move on 5 October: the error was ignored, so adding a language flagged
// nothing and Settings said no page would be flagged. And page_urls already
// holds more than the 1,000 rows one read returns.

import type { Db } from '@/lib/supabase/types'

const PAGE = 1000

export async function pagesWithUrls(db: Db, siteId: string): Promise<Set<string>> {
  const pageIds: string[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('pages').select('id').eq('site_id', siteId).order('id').range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not read the site's pages: ${error.message}`)
    pageIds.push(...((data ?? []) as { id: string }[]).map(p => p.id))
    if ((data ?? []).length < PAGE) break
  }

  const withUrls = new Set<string>()
  for (let i = 0; i < pageIds.length; i += 200) {
    const slice = pageIds.slice(i, i + 200)
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from('page_urls').select('page_id').in('page_id', slice)
        .order('page_id').order('language_code').range(from, from + PAGE - 1)
      if (error) throw new Error(`Could not read the page URLs: ${error.message}`)
      for (const r of (data ?? []) as { page_id: string }[]) withUrls.add(r.page_id)
      if ((data ?? []).length < PAGE) break
    }
  }
  return withUrls
}
