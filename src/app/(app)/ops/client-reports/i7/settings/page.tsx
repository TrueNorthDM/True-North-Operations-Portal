// The Budget Usage Report settings moved into Company settings (Admin).
// Keep this route as a redirect so old links / bookmarks still work.

import { redirect } from 'next/navigation'

export default function TimeReportSettingsRedirect() {
  redirect('/admin/settings#clients')
}
