// Anniversaries: this month's work anniversaries: name, team, milestone badge
// and the date they joined. A single self-contained block (title + card) so it
// can sit side by side with Birthdays on the Home page.

import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import { yearColor } from '@/lib/tenure'
import { formatDate, TEAM_COLOR } from '@/components/admin/people-types'
import { MONTHS, parseYMD, type CelebrationPerson } from '@/lib/hr/celebrations'

interface Ann extends CelebrationPerson { years: number; day: number }

export function Anniversaries({ people }: { people: CelebrationPerson[] }) {
  const now = new Date()
  const cm = now.getMonth()
  const cy = now.getFullYear()

  const list: Ann[] = []
  for (const p of people) {
    const h = parseYMD(p.hireDate)
    if (!h || h.m !== cm) continue
    const years = cy - h.y
    if (years >= 1) list.push({ ...p, years, day: h.d })
  }
  list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-tn-ink">Work anniversaries</h2>
        <span className="text-xs text-muted">{MONTHS[cm]}</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {list.length === 0 ? (
          <p className="text-[12.5px] text-muted italic">No anniversaries this month.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map(a => (
              <div key={a.id} className="flex items-center gap-2.5">
                <Avatar name={a.name} avatarUrl={a.avatarUrl} size={32} color={TEAM_COLOR[a.teamKey]} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-tn-ink truncate">{a.name}</span>
                  <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                    {a.teamName && (
                      <span className="shrink-0 max-w-[120px] truncate font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-1.5 py-0.5" style={{ color: TEAM_COLOR[a.teamKey], background: `${TEAM_COLOR[a.teamKey]}1a` }}>{a.teamName}</span>
                    )}
                    <span className="text-[11px] text-muted truncate">Joined {formatDate(a.hireDate)}</span>
                  </span>
                </span>
                <TenureBadge milestone={{ kind: 'year', value: a.years, color: yearColor(a.years) }} size={40} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
