// The Budget Usage Report settings moved into the general Settings page.
// Keep this route as a redirect so old links / bookmarks still work.

import { redirect } from 'next/navigation'

export default function TimeReportSettingsRedirect() {
  redirect('/settings')
}
