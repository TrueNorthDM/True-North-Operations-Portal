// AAAF — page list (Server Component)

import { getSitePageData } from '@/lib/pages-data'
import { PageList } from '@/components/PageList'
import { WpLinks } from '@/components/WpLinks'
import { ActivityLog } from '@/components/ActivityLog'

export default async function AaafPagesPage() {
  const { site, siteLanguages, rows, done, activity } = await getSitePageData('aaaf')

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <span>AAAF</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold text-aaaf-ink font-(family-name:--font-aaaf-display)">
              {site?.name ?? 'Ask An Adventist Friend'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">askanadventistfriend.com</p>
          </div>
          <WpLinks dev={site?.wp_dev_url as string | null} live={site?.wp_live_url as string | null} accent="aaaf" />
        </div>
      </div>

      <ActivityLog rows={activity} />

      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-700">Overall progress</span>
            <a href="/aaaf/audit" className="text-xs font-medium text-aaaf-primary hover:text-aaaf-secondary">
              Run Link Audit →
            </a>
          </div>
          <span className="text-slate-500">{done} / {rows.length} pages complete</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-aaaf-primary h-2 rounded-full transition-all"
            style={{ width: rows.length > 0 ? `${(done / rows.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      <PageList
        rows={rows}
        languages={siteLanguages}
        siteCode="aaaf"
        accent="aaaf"
      />
    </div>
  )
}
