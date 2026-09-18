// Design check: team priority in three levels (workspace, board, item).
//
// A mockup for the request of 18 September 2026, on the SEO team's real shape.
// Development only, like every design check; nothing on it is saved.
// ?level=board or ?level=item opens on that level.

import { notFound } from 'next/navigation'
import { LevelsMockup } from './LevelsMockup'

export const dynamic = 'force-dynamic'

export default async function TeamPriorityLevelsDesignCheck(
  { searchParams }: { searchParams: Promise<{ level?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { level } = await searchParams
  const initialLevel = level === 'board' || level === 'item' ? level : 'workspace'
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1180px] mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Team priority in three levels</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            The SEO team as it is today: 820 open steps, 6 workspaces, 22 boards. Pick a level, move things with the arrows, and look at Item to see the list the team would get. Nothing is saved.
          </p>
        </div>
        <LevelsMockup initialLevel={initialLevel} />
      </div>
    </div>
  )
}
