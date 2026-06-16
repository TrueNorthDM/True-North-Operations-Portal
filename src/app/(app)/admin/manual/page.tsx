// Admin → System manual. Admin-only. Content lives in lib/manual/data.ts,
// maintained in the repo alongside the tracker and the tests.

import { redirect } from 'next/navigation'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { SystemManual } from '@/components/SystemManual'

export default async function ManualPage() {
  if (!(await isCurrentUserAdmin())) redirect('/')
  return <SystemManual />
}
