// The System manual moved out of Admin to /manual, on the rail for everyone
// (owner, 4 November 2026). Old links and bookmarks land there.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function OldManualPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(await previewHref(tab === 'runs' ? '/manual?tab=runs' : '/manual'))
}
