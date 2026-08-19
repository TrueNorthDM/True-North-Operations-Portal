// Monday accounts → people.
//
// Ordered by how much work is riding on each answer, so the account holding
// four hundred assignments is the first thing on the screen and the one with
// two is at the bottom where it belongs.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadLinkBoard } from '@/lib/monday/worklist/links'
import { MondayLinksClient } from '@/components/monday/MondayLinksClient'

export const metadata = { title: 'Monday accounts' }
export const dynamic = 'force-dynamic'

export default async function MondayLinksPage() {
  if (!(await isSecurityAdmin())) redirect('/')

  const supabase = createAdminClient()
  const [board, { data: peopleRows }] = await Promise.all([
    loadLinkBoard(supabase),
    supabase.from('people').select('id, full_name, status').order('full_name'),
  ])

  const people = ((peopleRows ?? []) as { id: string; full_name: string; status: string }[])
    .map(p => ({ value: p.id, label: p.status === 'inactive' ? `${p.full_name} (inactive)` : p.full_name }))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="font-semibold hover:text-tn-ink transition-colors">Dashboard</Link>
          <span className="text-slate-300">/</span>
          <Link href="/admin" className="font-semibold hover:text-tn-ink transition-colors">Admin</Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-tn-ink">Monday accounts</span>
        </div>
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Monday accounts</h1>
        <p className="text-muted mt-1.5 leading-relaxed">
          Every assignment in My Work carries a Monday account. Until that account is attached to somebody in
          the Directory, their work still shows but falls outside every team filter. Two answers finish the
          job: say who it is, or say it is somebody outside True North.
        </p>
      </div>

      <MondayLinksClient board={board} people={people} />
    </div>
  )
}
