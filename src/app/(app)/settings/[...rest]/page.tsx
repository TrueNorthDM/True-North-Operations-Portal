// Old deep links under /settings (a notification once pointed at
// /settings/monday) land on Company settings.

import { redirect } from 'next/navigation'

export default function SettingsMovedDeep() {
  redirect('/admin/settings')
}
