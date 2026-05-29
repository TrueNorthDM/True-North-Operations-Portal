// HFA — page list (Server Component)
// Same shape as AAAF but with the Cluster column visible.

import { createClient } from '@/lib/supabase/server'
import { PageList, type PageListRow } from '@/components/PageList'
import { renderHreflangHtml } from '@/lib/hreflang'
import { WpLinks } from '@/components/WpLinks'

export default async function HfaPagesPage() {
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, languages, wp_dev_url, wp_live_url')
    .eq('code', 'hfa')
    .single()

  const { data: pages } = await supabase
    .from('pages')
    .select('id, name, cluster, needs_hreflang_update, monday_status, monday_lang_status, confirmed_done_at, page_urls(language_code, url), confirmations(language_code, confirmed_on_live)')
    .eq('site_id', site?.id ?? '')

  const siteLanguages: string[] = site?.languages ?? ['en', 'sw']

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
    const allHaveUrls = siteLanguages.every(l => urls.includes(l))
    const hreflangHtml = allHaveUrls
      ? renderHreflangHtml(urlsArr.filter(u => siteLanguages.includes(u.language_code)))
      : undefined
    return {
      id: p.id,
      name: p.name,
      cluster: p.cluster,
      langStatus,
      mondayLangStatus: (p.monday_lang_status ?? {}) as Record<string, boolean>,
      mondayStatus: (p.monday_status ?? 'pending') as 'pending' | 'in_progress' | 'done',
      needsUpdate: p.needs_hreflang_update,
      hreflangHtml,
      confirmedDoneAt: p.confirmed_done_at,
    }
  })

  const done = rows.filter(r => siteLanguages.every(l => r.langStatus[l]?.confirmed)).length

  return (
    <div className="space-y-6">
      {/* Header — pages are auto-synced from Monday.com, no manual add. */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <span>HFA</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold text-hfa-ink font-(family-name:--font-hfa-display) tracking-wide uppercase">
              {site?.name ?? 'Hope For Africa'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">hopefor.africa</p>
          </div>
          <WpLinks dev={site?.wp_dev_url as string | null} live={site?.wp_live_url as string | null} accent="hfa" />
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="font-medium text-slate-700">Overall progress</span>
          <span className="text-slate-500">{done} / {rows.length} pages complete</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-hfa-primary h-2 rounded-full transition-all"
            style={{ width: rows.length > 0 ? `${(done / rows.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <PageList
        rows={rows}
        languages={siteLanguages}
        siteCode="hfa"
        accent="hfa"
      />
    </div>
  )
}
