// Design check: team priority on My Work, as decided on 16 September 2026.
//
// One order per team, set by its team leader or by an admin; everyone on the
// team sees their steps in it. Three screens: the leader setting it, a team
// member reading it, and what an admin can do. Development only, like every
// design check, and nothing on it is saved. ?only=1, 2 or 3 shows one screen.

import { notFound } from 'next/navigation'
import { TeamPriorityDemo } from './TeamPriorityMockups'

export const dynamic = 'force-dynamic'

export default async function TeamPriorityDesignCheck(
  { searchParams }: { searchParams: Promise<{ only?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { only } = await searchParams
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1180px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">My Work · Team priority</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            Each team has one priority order. Its team leader sets it, an admin can set any team&apos;s, and everyone on the team sees their own steps in it. Sample data; nothing here is saved.
          </p>
        </div>
        <TeamPriorityDemo only={only} />
      </div>
    </div>
  )
}
