// My team: the signed-in person's own team, always at directory Level 1.
//
// Reached from the avatar menu, next to My profile. Unlike /directory, which
// renders whatever their access level allows, this is deliberately the same
// personal view for everyone including admins: the people on their teams, with
// only their own card openable. No gate, it only ever shows you your own team.

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { loadMyTeam } from '@/lib/directory/my-team'
import { loadAccess } from '@/lib/access/resolve'
import { directoryLevel } from '@/lib/access/surfaces'
import { RestrictedDirectory } from '@/components/admin/RestrictedDirectory'

export const dynamic = 'force-dynamic'

export default async function MyTeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Same rule the Directory follows: level 3 opens every teammate's card,
  // levels 1 and 2 only your own.
  const access = await loadAccess()
  const { people, profiles, selfId } = await loadMyTeam(supabase, user, directoryLevel(access.can))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Link href="/" className="font-semibold hover:text-tn-ink">Dashboard</Link>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-tn-ink">My Team</span>
      </div>

      <RestrictedDirectory people={people} teams={[]} showTeams={false} profiles={profiles} selfId={selfId} />
    </div>
  )
}
