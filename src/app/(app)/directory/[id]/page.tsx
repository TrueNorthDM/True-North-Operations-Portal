// A person's page (8 October 2026): /directory/<id>, opened from the Directory,
// My Team, Human Resources and, for the person themselves, My profile. Who
// opens it and which tabs they see is lib/directory/page-rights.ts; what is
// read for them is lib/directory/person-page-data.ts.

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PersonPage } from '@/components/person/PersonPage'
import { loadAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLedMemberIds, loadPersonPage } from '@/lib/directory/person-page-data'
import { resolvePageTab } from '@/lib/directory/page-rights'
import { loadPersonTimesheet } from './timesheet'
import { loadPersonPay } from './pay'
import { savePayTerms } from './pay-actions'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PersonRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  if (!UUID.test(id)) notFound()
  // The access the portal renders with, a View Stage preview included: the
  // preview shows the page as that level would see it. Saving checks the
  // person really signed in (actions.ts).
  const access = await loadAccess()
  const db = createAdminClient()
  const data = await loadPersonPage(db, id, access, await loadLedMemberIds(db, access.personId))
  // Closed and missing look the same, so a closed page says nothing about who exists.
  if (!data) notFound()
  const { tab } = await searchParams
  // The Work tab's Timesheet section (Clocky, 16 October 2026): read only with
  // the Work tab, changed with Edit work by whoever may change the periods.
  const sheet = data.work ? await loadPersonTimesheet(id, data.rights.workEdit && access.can('cs-periods-edit')) : null
  // Approvals (no money) and Pay and hours (money: the person, Super Admins, Admins, Finance) on the Work tab.
  const pay = data.work ? await loadPersonPay(id, access) : null

  return (
    <div className="space-y-4">
      {/* One page, one trail: the same from the Directory and from My profile. */}
      <Breadcrumb parents={access.can('directory') ? ['/directory'] : []} now={data.name} />
      <PersonPage
        data={data}
        tab={resolvePageTab(tab, data.rights)}
        // Removing someone: "Add people" on the Directory, from their Work tab.
        canRemove={!data.rights.own && data.rights.workEdit && access.can('d-edit')}
        timesheet={sheet && { ...sheet, links: { rates: access.can('directory') && access.can('d-rates'), settings: access.can('cs-periods') } }}
        pay={pay && { ...pay, save: savePayTerms.bind(null, id) }}
      />
    </div>
  )
}
