import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

// Directory moved out from under Admin to a top-level /directory page. Keep this
// redirect so any old /admin/directory links still land in the right place.
export default async function LegacyDirectoryRedirect() {
  redirect(await previewHref('/directory'))
}
