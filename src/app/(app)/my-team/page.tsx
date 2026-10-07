// My team: the signed-in person's own team, always at directory Level 1.
//
// Reached from the avatar menu, next to My profile. Unlike /directory, which
// renders whatever their access level allows, this is deliberately the same
// personal view for everyone including admins: the people on their teams, with
// only their own card openable. Behind the My Team item like the My Work tab.

import { createClient } from '@/lib/supabase/server'
import { loadMyTeam } from '@/lib/directory/my-team'
import { requireSurface } from '@/lib/access/resolve'
import { myTeamLevel } from '@/lib/access/surfaces'
import { RestrictedDirectory } from '@/components/admin/RestrictedDirectory'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getSessionUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function MyTeamPage() {
  const access = await requireSurface('my-team')
  const supabase = await createClient()
  const user = await getSessionUser()
  // Same rule the Directory follows: level 3 opens every teammate's card,
  // levels 1 and 2 only your own.
  const { people, profiles, selfId } = await loadMyTeam(supabase, user, myTeamLevel(access.can))

  return (
    <div className="space-y-6">
      <Breadcrumb now="My Team" />

      <RestrictedDirectory people={people} teams={[]} showTeams={false} profiles={profiles} selfId={selfId} />
    </div>
  )
}
