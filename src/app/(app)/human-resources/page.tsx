// Human Resources — for now, the anniversary badge gallery: every service
// milestone (quarterly through the first year, then 1–20 years) with the people
// who currently hold it. Privileged only.

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTier } from '@/lib/auth/role'
import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import { tenureSince, milestoneOf, formatTenure, yearColor, type Milestone } from '@/lib/tenure'

export const dynamic = 'force-dynamic'

interface Holder { id: string; name: string; avatarUrl: string | null; tenure: string }

function BadgeCard({ milestone, label, accent, holders }: { milestone: Milestone; label: string; accent: string; holders: Holder[] }) {
  return (
    <div className="flex flex-col items-center rounded-[16px] border border-slate-200 bg-white p-4 text-center shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <TenureBadge milestone={milestone} size={64} />
      <div className="mt-2.5 font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{label}</div>
      <div className="text-[11px] text-muted mb-3">{holders.length} {holders.length === 1 ? 'person' : 'people'}</div>
      {holders.length === 0 ? (
        <span className="text-[12px] text-muted italic mt-1">No one yet</span>
      ) : (
        <div className="w-full flex flex-col gap-1.5 border-t border-slate-100 pt-3">
          {holders.map(h => (
            <div key={h.id} className="flex items-center gap-2 text-left">
              <Avatar name={h.name} avatarUrl={h.avatarUrl} size={26} color={accent} />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-tn-ink truncate">{h.name}</span>
                <span className="block text-[10.5px] text-muted truncate">{h.tenure}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function HumanResourcesPage() {
  if (!(await getCurrentTier()).isPrivileged) redirect('/')

  const supabase = await createClient()
  let res = await supabase.from('people').select('id, full_name, hire_date, status, avatar_url')
  if (res.error) res = (await supabase.from('people').select('id, full_name, hire_date, status')) as typeof res
  const people = res.data ?? []

  const now = new Date()
  const quarterHolders: Record<number, Holder[]> = { 1: [], 2: [], 3: [] }
  const yearHolders = new Map<number, Holder[]>()
  let maxYear = 20
  let underThree = 0

  for (const p of people) {
    if (p.status !== 'active' || !p.hire_date) continue
    const t = tenureSince(p.hire_date, now)
    const ms = milestoneOf(t)
    const holder: Holder = { id: p.id, name: p.full_name, avatarUrl: p.avatar_url ?? null, tenure: formatTenure(t) }
    if (ms.kind === 'quarter') quarterHolders[ms.value].push(holder)
    else if (ms.kind === 'year') {
      const arr = yearHolders.get(ms.value) ?? []
      arr.push(holder)
      yearHolders.set(ms.value, arr)
      if (ms.value > maxYear) maxYear = ms.value
    } else underThree++
  }
  for (const arr of [...Object.values(quarterHolders), ...yearHolders.values()]) arr.sort((a, b) => a.name.localeCompare(b.name))

  const years = Array.from({ length: maxYear }, (_, i) => i + 1)
  const gridCls = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]'

  return (
    <div className="space-y-9">
      <div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">Human Resources</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          Anniversary badges — every service milestone and who currently holds it. Colours reuse the team palette; badges are earned from 3 months, then every year.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2.5 mb-3.5">
          <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">First year</h2>
          <span className="text-[12.5px] text-muted">quarterly milestones</span>
        </div>
        <div className={gridCls}>
          {[1, 2, 3].map(q => (
            <BadgeCard key={`q${q}`} milestone={{ kind: 'quarter', value: q }} label={`${q * 3} months`} accent="#1E7D7F" holders={quarterHolders[q]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mb-3.5">Years of service</h2>
        <div className={gridCls}>
          {years.map(y => (
            <BadgeCard key={`y${y}`} milestone={{ kind: 'year', value: y, color: yearColor(y) }} label={`${y} ${y === 1 ? 'year' : 'years'}`} accent={yearColor(y)} holders={yearHolders.get(y) ?? []} />
          ))}
        </div>
      </section>

      {underThree > 0 && (
        <p className="text-[12.5px] text-muted">
          {underThree} active {underThree === 1 ? 'person has' : 'people have'} been here under 3 months — no badge yet.
        </p>
      )}
    </div>
  )
}
