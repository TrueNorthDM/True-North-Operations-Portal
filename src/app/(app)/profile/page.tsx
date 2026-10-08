// My profile (avatar menu): since 8 October 2026 the person's own page in the
// Directory, the same page everyone else opens, in its own view (edit
// Personal, see Work and Reports). Not a page of its own any more.

import { redirect } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { loadAccess } from '@/lib/access/resolve'
import { personHref } from '@/lib/directory/page-rights'

export const dynamic = 'force-dynamic'

export default async function MyProfile({ searchParams }: { searchParams: Promise<{ _vs?: string }> }) {
  const access = await loadAccess()
  // A View Stage preview keeps its marker, or the page would open as the real you.
  const vs = (await searchParams)._vs
  if (access.personId) redirect(personHref(access.personId) + (vs ? `?_vs=${encodeURIComponent(vs)}` : ''))
  return (
    <div className="space-y-4">
      <Breadcrumb now="My profile" />
      <div className="rounded-[12px] border border-amber-300/60 bg-amber-50 p-5 text-sm text-[#8a6d1a]">
        Your login is not linked to anybody in the Directory yet, so there is no page to show. Ask an admin to link your account.
      </div>
    </div>
  )
}
