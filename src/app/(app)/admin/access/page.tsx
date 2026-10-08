// People, Teams, and Access were merged into the unified Directory.
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function AccessRedirect() {
  redirect(await previewHref('/directory'))
}
