// Organization: who reports to whom, across the whole company. Its own page
// since the navigation redesign (22 September 2026), in the People panel of the
// rail. The same OrgChart the Home page draws; everyone signed in can see it,
// as on the Home page, and the directory level decides how much of a card
// opens from there.

import Link from 'next/link'
import { OrgChart } from '@/components/OrgChart'
import { getOrgChart } from '@/lib/org/data'
import { loadAccess } from '@/lib/access/resolve'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Organization' }

export default async function OrganizationPage() {
  const [org, access] = await Promise.all([getOrgChart(), loadAccess()])
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Breadcrumb self="/organization" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">Organization</h1>
          <p className="text-[14px] text-muted mt-1 m-0">
            {`Who reports to whom, across the whole company.${org.total > 0 ? ` ${org.total} people.` : ''}`}
          </p>
        </div>
        {access.can('directory') && (
          <Link href="/directory" className={BTN.white}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            Open Directory
          </Link>
        )}
      </div>
      <section className="rounded-xl border border-slate-200 bg-white/60 p-4">
        <OrgChart roots={org.roots} />
      </section>
    </div>
  )
}
