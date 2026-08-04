// Admin → System manual. Admin-only. Content lives in lib/manual/data.ts,
// maintained in the repo alongside the tracker and the tests.

import { redirect } from 'next/navigation'
import { isSecurityAdmin } from '@/lib/auth/role'
import { SystemManual } from '@/components/SystemManual'

export default async function ManualPage() {
  if (!(await isSecurityAdmin())) redirect('/')
  return <SystemManual />
}
