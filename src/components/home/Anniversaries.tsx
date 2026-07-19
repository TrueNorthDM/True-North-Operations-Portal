// Anniversaries — work anniversaries across last / this / next month, each with
// the person's name, team, milestone badge and the date they joined. Renders
// nothing when the three-month window is empty.

import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import { yearColor } from '@/lib/tenure'
import { formatDate, TEAM_COLOR } from '@/components/admin/people-types'
import { monthWindow, parseYMD, type CelebrationPerson } from '@/lib/hr/celebrations'

interface Ann extends CelebrationPerson { years: number; day: number }

export function Anniversaries({ people }: { people: CelebrationPerson[] }) {
  const targets = monthWindow(new Date())
  const cols: Ann[][] = [[], [], []]
  for (const p of people) {
    const h = parseYMD(p.hireDate)
    if (!h) continue
    targets.forEach((t, i) => {
      if (h.m !== t.month) return
      const years = t.year - h.y
      if (years >= 1) cols[i].push({ ...p, years, day: h.d })
    })
  }
  cols.forEach(c => c.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name)))
  if (cols.every(c => c.length === 0)) return null

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-tn-ink">Work anniversaries</h2>
        <span className="text-xs text-muted">last, this &amp; next month</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {targets.map((t, i) => (
          <div key={i} className={`rounded-xl border p-4 ${t.current ? 'border-tn-teal/40 bg-tn-teal-soft' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{t.label}</span>
              {t.current && <span className="font-(family-name:--font-display) font-extrabold text-[9.5px] uppercase tracking-wide text-tn-teal bg-white rounded-full px-2 py-0.5">This month</span>}
            </div>
            {cols[i].length === 0 ? (
              <p className="text-[12.5px] text-muted italic">No anniversaries.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cols[i].map(a => (
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
        ))}
      </div>
    </section>
  )
}
