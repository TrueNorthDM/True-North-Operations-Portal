// Anniversaries — work anniversaries across last / this / next month, each with
// the milestone badge and time of service. Server component: loads its own data
// and renders nothing when the three-month window is empty.

import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import { tenureSince, formatTenure, yearColor } from '@/lib/tenure'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface Ann { id: string; name: string; avatarUrl: string | null; years: number; tenure: string; day: number }

export async function Anniversaries() {
  const supabase = await createClient()
  let res = await supabase.from('people').select('id, full_name, hire_date, status, avatar_url')
  if (res.error) res = (await supabase.from('people').select('id, full_name, hire_date, status')) as typeof res
  const people = res.data ?? []

  const now = new Date()
  const targets = [-1, 0, 1].map(off => {
    const d = new Date(now.getFullYear(), now.getMonth() + off, 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTHS[d.getMonth()], current: off === 0 }
  })

  const cols: Ann[][] = [[], [], []]
  for (const p of people) {
    if (p.status !== 'active' || !p.hire_date) continue
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.hire_date)
    if (!m) continue
    const hy = +m[1], hmo = +m[2] - 1, hd = +m[3]
    targets.forEach((t, i) => {
      if (hmo !== t.month) return
      const years = t.year - hy
      if (years < 1) return // a real anniversary only
      cols[i].push({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url ?? null, years, tenure: formatTenure(tenureSince(p.hire_date, now)), day: hd })
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
                    <Avatar name={a.name} avatarUrl={a.avatarUrl} size={30} color={yearColor(a.years)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-tn-ink truncate">{a.name}</span>
                      <span className="block text-[11px] text-muted truncate">{a.tenure}</span>
                    </span>
                    <TenureBadge milestone={{ kind: 'year', value: a.years, color: yearColor(a.years) }} size={38} />
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
