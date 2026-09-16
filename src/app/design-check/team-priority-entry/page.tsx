// Design check: where team priority is reached from on My Work.
//
// The page as it is today with the two ways in marked, for a team leader and
// for a team member. The screens they open are in /design-check/team-priority.
// Development only; nothing on it is saved. ?only=1 or 2 shows one.

import { notFound } from 'next/navigation'
import { EntryDemo } from './EntryMockups'

export const dynamic = 'force-dynamic'

export default async function TeamPriorityEntryDesignCheck(
  { searchParams }: { searchParams: Promise<{ only?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { only } = await searchParams
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1320px] mx-auto space-y-8">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">My Work · Where team priority lives</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">Two ways in, only for team leaders and admins. Sample data.</p>
        </div>
        <EntryDemo only={only} />
      </div>
    </div>
  )
}
