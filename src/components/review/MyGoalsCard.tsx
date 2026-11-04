// "My goals" on Home (annual review handoff, B2 and Home Final v2): the right
// column, under the Agenda, only for people whose goals were agreed in a
// review: how they stand, the next one due, and the 6-month check-in.

import Link from 'next/link'
import { BTN } from '@/lib/ui/buttons'
import { CARD, FIELD_LABEL } from '@/lib/ui/type'
import { fmtDay, fmtWhen } from '@/lib/review/format'
import type { GoalsView } from '@/lib/review/mine'
import { APR_COLORS } from '@/lib/review/colors'

export function MyGoalsCard({ v }: { v: GoalsView }) {
  const open = v.goals.filter(g => g.status !== 'done' && g.status !== 'dropped' && g.by)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const key = (by: string) => { const [m, y] = by.split(' '); return Number(y) * 12 + months.indexOf(m) }
  const next = [...open].sort((a, b) => key(a.by) - key(b.by))[0]
  return (
    <div style={APR_COLORS} className={`${CARD} px-5 py-4 flex flex-col gap-3`}>
      <span className={FIELD_LABEL}>My goals for {v.year}</span>
      <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{v.summary || 'No goals'}</span>
      {next && (
        <div className="rounded-[10px] bg-subtle px-3.5 py-2.5 flex flex-col gap-0.5">
          <span className="text-[11.5px] font-semibold text-muted">Next due · {next.by}</span>
          <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{next.what}</span>
        </div>
      )}
      <span className="text-[12.5px] text-muted">{v.checkin.finished ? '6-month check-in done.' : v.checkin.at ? `6-month check-in on ${fmtWhen(v.checkin.at)}` : `6-month check-in with ${v.manager.name || 'your manager'}${v.checkinsBy ? ` by ${fmtDay(v.checkinsBy)}` : ''}`}</span>
      <div><Link href="/human-resources?tab=goals" className={BTN.smallWhite}>Open My goals</Link></div>
    </div>
  )
}
