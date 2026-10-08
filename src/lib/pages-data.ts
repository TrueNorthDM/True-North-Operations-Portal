/**
 * Shared data-fetching helper for the AAAF and HFA page list views.
 *
 * Both /aaaf and /hfa Server Components do identical Supabase queries and
 * row-mapping. Extracting here removes the duplication while keeping the
 * page components responsible only for their site-specific layout/branding.
 */

import { createClient } from '@/lib/supabase/server'
import { getRecentActivity } from '@/lib/get-activity'
import type { PageListRow } from '@/components/PageList'
import type { ActivityRow } from '@/components/ActivityLog'

const DEFAULT_LANGUAGES: Record<'aaaf' | 'hfa', string[]> = {
  aaaf: ['en', 'pt', 'es', 'sw'],
  hfa: ['en', 'sw'],
}

interface SitePageData {
  site: {
    id: string
    name: string
    languages: string[]
    wp_dev_url: string | null
    wp_live_url: string | null
    monday_board_id: string | null
  } | null
  siteLanguages: string[]
  rows: PageListRow[]
  done: number
  activity: ActivityRow[]
}

export async function getSitePageData(siteCode: 'aaaf' | 'hfa'): Promise<SitePageData> {
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, languages, wp_dev_url, wp_live_url, monday_board_id')
    .eq('code', siteCode)
    .single()

  const siteLanguages: string[] = site?.languages ?? DEFAULT_LANGUAGES[siteCode]

  const { data: pages } = await supabase
    .from('pages')
    .select('id, name, needs_hreflang_update, confirmed_done_at, not_relevant, page_urls(language_code, url), confirmations(language_code, confirmed_on_live)')
    .eq('site_id', site?.id ?? '')

  const rows: PageListRow[] = (pages ?? []).map(p => {
    const urlsArr = p.page_urls as { language_code: string; url: string }[]
    const urls = urlsArr.map(u => u.language_code)
    const confirmed = new Set(
      (p.confirmations as { language_code: string; confirmed_on_live: boolean }[])
        .filter(c => c.confirmed_on_live)
        .map(c => c.language_code),
    )
    const langStatus: PageListRow['langStatus'] = {}
    for (const lang of siteLanguages) {
      langStatus[lang] = { hasUrl: urls.includes(lang), confirmed: confirmed.has(lang) }
    }
    return {
      id: p.id,
      name: p.name,
      langStatus,
      needsUpdate: p.needs_hreflang_update ?? undefined,
      confirmedDoneAt: p.confirmed_done_at,
      notRelevant: p.not_relevant ?? false,
    }
  })

  // "Done" includes pages marked Not relevant, they're intentionally out of
  // scope and shouldn't drag the completion percentage down.
  const done = rows.filter(
    r => r.notRelevant || siteLanguages.every(l => r.langStatus[l]?.confirmed),
  ).length

  const activity = await getRecentActivity(supabase, (site?.monday_board_id as string | null) ?? null)

  return { site, siteLanguages, rows, done, activity }
}
