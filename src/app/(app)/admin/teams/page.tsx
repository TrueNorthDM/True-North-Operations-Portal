// People, Teams, and Access were merged into the unified Directory.
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function TeamsRedirect() {
  redirect(await previewHref('/directory'))
}
