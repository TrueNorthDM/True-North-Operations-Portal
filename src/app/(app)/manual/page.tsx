// The System manual's address: its first guide. The old tabs' links land on
// their new pages (?tab=runs was How it runs).

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { pageHref, readingOrder } from '@/lib/manual/registry'

export default async function ManualIndex({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(await previewHref(tab === 'runs' ? '/manual/behind/how-it-runs' : pageHref(readingOrder('guides', false)[0])))
}
