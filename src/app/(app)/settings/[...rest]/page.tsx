// Old deep links under /settings (a notification once pointed at
// /settings/monday) land on Company settings.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'

export default async function SettingsMovedDeep() {
  redirect(await previewHref('/admin/settings'))
}
