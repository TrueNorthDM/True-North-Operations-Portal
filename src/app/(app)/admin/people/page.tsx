// People, Teams, and Access were merged into the unified Directory.
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function PeopleRedirect() {
  redirect(await previewHref('/directory'))
}
