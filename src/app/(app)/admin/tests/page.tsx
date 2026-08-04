// Admin → Tests, manual test checklist for the whole system. Admin-only.
// Data lives in lib/tests/data.ts, maintained in the repo.

import { redirect } from 'next/navigation'
import { isSecurityAdmin } from '@/lib/auth/role'
import { TestChecklist } from '@/components/TestChecklist'

export default async function TestsPage() {
  if (!(await isSecurityAdmin())) redirect('/')
  return <TestChecklist />
}
