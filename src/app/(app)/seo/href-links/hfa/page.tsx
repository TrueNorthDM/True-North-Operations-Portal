// HFA: page list (Server Component)

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { getSitePageData } from '@/lib/pages-data'
import { PageList } from '@/components/PageList'
import { WpLinks } from '@/components/WpLinks'
import { canAccessSite } from '@/lib/auth/access'
import { requireSurface } from '@/lib/access/resolve'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ROUTES } from '@/lib/nav/routes'

export default async function HfaPagesPage() {
  // Href Links is a tool in the rail's Tools panel (SEO Tools), not a rail
  // item, so it needs the area plus its own team grant.
  const access = await requireSurface('tools')
  if (!access.canTool('href-links')) redirect(await previewHref('/'))

  const { site, siteLanguages, rows, done } = await getSitePageData('hfa')

  // Access enforcement, admins & unrestricted sites pass; otherwise needs a grant.
  if (site && !(await canAccessSite(site.id))) redirect(await previewHref('/'))

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb parents={[ROUTES.hrefLinks]} now="HFA" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {/* Same heading treatment as AAAF (Nunito, 3xl, extrabold, mixed
                case), only the colour changes to HFA's brand orange. */}
            <h1 className="text-3xl font-extrabold text-hfa-primary font-(family-name:--font-aaaf-display)">
              {site?.name ?? 'Hope For Africa'}
            </h1>
            <p className="text-muted text-sm mt-1">hopefor.africa</p>
          </div>
          <div className="flex items-center gap-3">
            <WpLinks dev={site?.wp_dev_url as string | null} live={site?.wp_live_url as string | null} accent="hfa" />
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
            className="tn-bar-fill relative bg-hfa-primary h-2 rounded-full overflow-hidden"
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
        siteCode="hfa"
        accent="hfa"
      />
    </div>
  )
}
