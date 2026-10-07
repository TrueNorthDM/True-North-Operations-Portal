// The company settings moved to Admin > Configuration > Company settings on
// 7 October 2026. This address keeps old links and bookmarks working until the
// personal Settings page takes it over.

import { redirect } from 'next/navigation'

export default function SettingsMoved() {
  redirect('/admin/settings')
}
