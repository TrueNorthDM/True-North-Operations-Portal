import Link from 'next/link'
import { fetchTeamBoard } from '@/lib/monday/team-board'
import { TeamBoardView } from '@/components/admin/TeamBoardView'

// Live mirror of the True North Team Monday board — pulled on each load.
export const dynamic = 'force-dynamic'

export default async function TrueNorthTeamPage() {
  const board = await fetchTeamBoard()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="max-w-[680px]">
          <div className="flex items-center gap-2 text-sm text-muted mb-1.5">
            <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
            <span>/</span>
            <Link href="/admin" className="hover:text-tn-ink transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-foreground font-semibold">True North Team</span>
          </div>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">True North Team</h1>
          <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
            The whole team, mirrored live from the Monday board — same groups, columns and status as the board itself.
          </p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-2 text-[12px] font-(family-name:--font-display) font-bold text-muted bg-white border border-slate-200 rounded-full px-3.5 py-2">
          <span className="w-2 h-2 rounded-full bg-[#00c875]" />
          {board.ok ? `Live from Monday · ${board.itemCount} ${board.itemCount === 1 ? 'person' : 'people'}` : 'Live from Monday'}
        </div>
      </div>

      <TeamBoardView board={board} />
    </div>
  )
}
