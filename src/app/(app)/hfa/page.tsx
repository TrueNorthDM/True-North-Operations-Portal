// HFA — page list (Server Component)

import { redirect } from 'next/navigation'
import { getSitePageData } from '@/lib/pages-data'
import { PageList } from '@/components/PageList'
import { WpLinks } from '@/components/WpLinks'
import { ActivityLog } from '@/components/ActivityLog'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { canAccessSite } from '@/lib/auth/access'

export default async function HfaPagesPage() {
  const [{ site, siteLanguages, rows, done, activity }, isAdmin] = await Promise.all([
    getSitePageData('hfa'),
    isCurrentUserAdmin(),
  ])

  // Access enforcement — admins & unrestricted sites pass; otherwise needs a grant.
  if (site && !(await canAccessSite(site.id))) redirect('/')

  return (
    <div className="space-y-6">
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
          <div className="flex items-center gap-3">
            {isAdmin && (
              <a href="/admin/directory" className="text-xs font-medium text-slate-500 hover:text-slate-800 whitespace-nowrap">
                Manage access
              </a>
            )}
            <WpLinks dev={site?.wp_dev_url as string | null} live={site?.wp_live_url as string | null} accent="hfa" />
          </div>
        </div>
      </div>

      <ActivityLog rows={activity} />

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
