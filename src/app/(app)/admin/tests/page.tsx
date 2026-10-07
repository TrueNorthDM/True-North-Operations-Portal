// Admin → Tests, manual test checklist for the whole system. Admin-only.
// Data lives in lib/tests/data.ts, maintained in the repo.

import { requireSurface } from '@/lib/access/resolve'
import { TestChecklist } from '@/components/TestChecklist'

export default async function TestsPage() {
  await requireSurface('tests')
  return <TestChecklist />
}
