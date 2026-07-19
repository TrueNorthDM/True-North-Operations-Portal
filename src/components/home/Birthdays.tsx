// Birthdays — this month's birthdays: name, team and the day (no year). A single
// self-contained block so it can sit side by side with Work anniversaries.

import { Avatar } from '@/components/Avatar'
import { TEAM_COLOR } from '@/components/admin/people-types'
import { MONTHS, formatMonthDay, parseYMD, type CelebrationPerson } from '@/lib/hr/celebrations'

interface Bd extends CelebrationPerson { day: number }

export function Birthdays({ people }: { people: CelebrationPerson[] }) {
  const now = new Date()
  const cm = now.getMonth()

  const list: Bd[] = []
  for (const p of people) {
    const b = parseYMD(p.dob)
    if (b && b.m === cm) list.push({ ...p, day: b.d })
  }
  list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-tn-ink">Birthdays</h2>
        <span className="text-xs text-muted">{MONTHS[cm]}</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {list.length === 0 ? (
          <p className="text-[12.5px] text-muted italic">No birthdays this month.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map(b => (
              <div key={b.id} className="flex items-center gap-2.5">
                <Avatar name={b.name} avatarUrl={b.avatarUrl} size={32} color={TEAM_COLOR[b.teamKey]} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-tn-ink truncate">{b.name}</span>
                  {b.teamName && (
                    <span className="inline-block mt-0.5 max-w-full truncate font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-1.5 py-0.5" style={{ color: TEAM_COLOR[b.teamKey], background: `${TEAM_COLOR[b.teamKey]}1a` }}>{b.teamName}</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 shrink-0 font-(family-name:--font-display) font-extrabold text-[12px] text-[#b8790a] bg-[#e08a1e]/12 rounded-full pl-2 pr-2.5 py-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-8H4v8" /><path d="M4 16h16" /><path d="M2 21h20" /><path d="M7 8v3M12 8v3M17 8v3" /><path d="M7 4h.01M12 4h.01M17 4h.01" /></svg>
                  {formatMonthDay(b.dob)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
