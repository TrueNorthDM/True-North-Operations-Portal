// The Budget Usage Report settings moved into Company settings (Admin).
// Keep this route as a redirect so old links / bookmarks still work.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function TimeReportSettingsRedirect() {
  redirect(await previewHref('/admin/settings#clients'))
}
