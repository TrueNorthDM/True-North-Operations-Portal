/**
 * One Href Links site's list page (server component), shared by both sites:
 * the header, the progress, the page list and the site's recent activity from
 * Monday. The route files keep their own access check and render this.
 *
 * Audit, 10 October 2026:
 *   - both sites are open to everyone with Href Links: the tool's team
 *     setting on Access levels decides, never a per-site list (decided by
 *     Arnaldo, 13 October 2026)
 *   - progress counts `done`, the one rule (lib/href-links/rules.ts)
 *   - the site's Monday activity sits below the list, so a Run Link that
 *     failed is seen (decided the same day)
 *   - a failed read says so in the page instead of crashing or showing an
 *     empty list
 */

import { getSitePageData, loadSite } from '@/lib/href-links/data'
import { siteHost, type SiteCode } from '@/lib/href-links/rules'
import { PageList } from '@/components/PageList'
import { WpLinks } from '@/components/WpLinks'
import { ActivityLog } from '@/components/ActivityLog'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ROUTES } from '@/lib/nav/routes'
import { SITE_BRAND } from './site-brand'
import { HrefLinksReadError } from './ReadError'
import { attempt } from './load'

export async function SiteListPage({ code }: { code: SiteCode }) {
  const brand = SITE_BRAND[code]

  const site = await attempt('the site', () => loadSite(code))
  if (!site.ok) return <HrefLinksReadError now={brand.label} />

  const data = await attempt('the pages', () => getSitePageData(code))
  if (!data.ok) return <HrefLinksReadError now={brand.label} />
  const { site: s, rows, done, activity } = data.value
  const host = siteHost(s.domain)?.replace(/^www\./, '')
  const pct = rows.length > 0 ? Math.round((done / rows.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb parents={[ROUTES.hrefLinks]} now={brand.label} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className={`text-3xl font-extrabold ${brand.heading}`}>{s.name || brand.fallbackName}</h1>
            {host && <p className="text-muted text-sm mt-1">{host}</p>}
          </div>
          <div className="flex items-center gap-3">
            <WpLinks dev={s.wp_dev_url} live={s.wp_live_url} accent={code} />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 p-5">
        <div className="flex items-center justify-between text-sm mb-3">
          <span id={`${code}-progress`} className="font-bold text-tn-ink">Overall progress</span>
          <span className="text-muted">{done} / {rows.length} pages complete</span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={`${code}-progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"
        >
          <div
            className={`tn-bar-fill relative ${brand.bar} h-2 rounded-full overflow-hidden`}
            style={{ width: `${rows.length > 0 ? (done / rows.length) * 100 : 0}%` }}
          >
            <div
              className="tn-bar-sheen absolute inset-y-0 left-0 w-[45%]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)' }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <PageList rows={rows} languages={s.languages} siteCode={code} accent={code} />

      <ActivityLog rows={activity} />
    </div>
  )
}
