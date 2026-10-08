// Team management moved inline into the unified Directory (Teams tab).
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function TeamDetailRedirect() {
  redirect(await previewHref('/directory'))
}
