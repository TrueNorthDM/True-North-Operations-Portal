// Boards Review, Targets editor (Phase B4 staging route).
//
// Server Component: reads the user's role + targets + recent audit, then hands
// off to the client editor. Admins edit; viewers see read-only. RLS on
// publishing_targets / audit_log enforces the same on the database side.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSurface } from '@/lib/access/resolve'
import { getCurrentProfile } from '@/lib/auth/role'
import { TargetsEditor } from '@/components/boards/TargetsEditor'
import { BoardsTabs } from '@/components/boards/BoardsTabs'

export default async function TargetsPage() {
  // Same pair as the card that leads here: the area from the access level, the
  // tool from the team. /boards-beta was guarded but this child was not.
  const access = await requireSurface('tools')
  if (!access.canTool('workload')) redirect('/work-tools')

  const profile = await getCurrentProfile()
  const isAdmin = profile?.role === 'admin'

  const supabase = await createClient()
  const { data: targets } = await supabase
    .from('publishing_targets')
    .select('*')
    .eq('period_type', 'weekly')
    .order('board_short', { ascending: true })
    .order('language', { ascending: true })

  // RLS returns [] for non-admins, so this is safe to always query.
  const { data: audit } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Boards Review</h1>
        <p className="mt-1 text-sm text-slate-500">
          Publishing targets <span className="text-slate-400">(beta, native rewrite)</span>
        </p>
      </div>

      <BoardsTabs />

      <TargetsEditor targets={targets ?? []} isAdmin={isAdmin} audit={audit ?? []} />
    </div>
  )
}
