// Admin → System manual. Security admins only: the "How it runs" tab names the
// server, its accounts and where the keys live. Two tabs (ManualHeader):
// "The portal" (lib/manual/data.ts, SystemManual) and "How it runs" (HowItRuns).

import { redirect } from 'next/navigation'
import { isSecurityAdmin } from '@/lib/auth/role'
import { SystemManual } from '@/components/SystemManual'
import { HowItRuns } from '@/components/manual/HowItRuns'
import { ManualHeader, type ManualTab } from '@/components/manual/ManualHeader'

export default async function ManualPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await isSecurityAdmin())) redirect('/')
  const { tab } = await searchParams
  const active: ManualTab = tab === 'runs' ? 'runs' : 'portal'
  return (
    <div className="space-y-6">
      <ManualHeader active={active} />
      {active === 'runs' ? <HowItRuns /> : <SystemManual />}
    </div>
  )
}
