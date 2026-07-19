// AAAF: page list (Server Component)

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSitePageData } from '@/lib/pages-data'
import { PageList } from '@/components/PageList'
import { WpLinks } from '@/components/WpLinks'
import { canAccessSite } from '@/lib/auth/access'

export default async function AaafPagesPage() {
  const { site, siteLanguages, rows, done } = await getSitePageData('aaaf')

  // Access enforcement, admins & unrestricted sites pass; otherwise needs a grant.
  if (site && !(await canAccessSite(site.id))) redirect('/')

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="hover:text-tn-ink transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-foreground">AAAF</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold text-aaaf-primary font-(family-name:--font-aaaf-display)">
              {site?.name ?? 'Ask An Adventist Friend'}
            </h1>
            <p className="text-muted text-sm mt-1">askanadventistfriend.com</p>
          </div>
          <div className="flex items-center gap-3">
            <WpLinks dev={site?.wp_dev_url as string | null} live={site?.wp_live_url as string | null} accent="aaaf" />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="font-bold text-tn-ink">Overall progress</span>
          <span className="text-muted">{done} / {rows.length} pages complete</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div
            className="tn-bar-fill relative bg-aaaf-primary h-2 rounded-full overflow-hidden"
            style={{ width: rows.length > 0 ? `${(done / rows.length) * 100}%` : '0%' }}
          >
            <div
              className="tn-bar-sheen absolute inset-y-0 left-0 w-[45%]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)' }}
              aria-hidden="true"
            />
          </div>
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
