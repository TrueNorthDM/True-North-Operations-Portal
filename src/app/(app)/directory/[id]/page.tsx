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

  return (
    <div className="space-y-4">
      {/* One page, one trail: the same from the Directory and from My profile. */}
      <Breadcrumb parents={access.can('directory') ? ['/directory'] : []} now={data.name} />
      <PersonPage
        data={data}
        tab={resolvePageTab(tab, data.rights)}
        // Removing someone: "Add people" on the Directory, from their Work tab.
        canRemove={!data.rights.own && data.rights.workEdit && access.can('d-edit')}
      />
    </div>
  )
}
