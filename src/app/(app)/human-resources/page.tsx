// Human Resources — for now, the anniversary badge gallery: every service
// milestone (quarterly through the first year, then 1–20 years) with the people
// who currently hold it. Privileged only. Clicking a person opens their card.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentTier } from '@/lib/auth/role'
import { Avatar } from '@/components/Avatar'
import { TenureBadge } from '@/components/TenureBadge'
import { tenureSince, milestoneOf, formatTenure, yearColor, type Milestone } from '@/lib/tenure'
import { loadCelebrationPeople } from '@/lib/hr/celebrations'
import { TEAM_COLOR, type TeamKey } from '@/components/admin/people-types'

export const dynamic = 'force-dynamic'

interface Holder { id: string; name: string; avatarUrl: string | null; tenure: string; teamName: string | null; teamKey: TeamKey }

function BadgeCard({ milestone, label, holders }: { milestone: Milestone; label: string; holders: Holder[] }) {
  return (
    <div className="flex flex-col items-center rounded-[16px] border border-slate-200 bg-white p-4 text-center shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <TenureBadge milestone={milestone} size={64} />
      <div className="mt-2.5 font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{label}</div>
      <div className="text-[11px] text-muted mb-3">{holders.length} {holders.length === 1 ? 'person' : 'people'}</div>
      {holders.length === 0 ? (
        <span className="text-[12px] text-muted italic mt-1">No one yet</span>
      ) : (
        <div className="w-full flex flex-col gap-0.5 border-t border-slate-100 pt-3 text-left">
          {holders.map(h => (
            <Link key={h.id} href={`/directory?open=${h.id}`} className="flex items-center gap-2.5 rounded-[9px] -mx-1 px-1 py-1 transition-colors hover:bg-subtle group">
              <Avatar name={h.name} avatarUrl={h.avatarUrl} size={28} color={TEAM_COLOR[h.teamKey]} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-tn-ink truncate group-hover:text-tn-teal transition-colors">{h.name}</span>
                {h.teamName && (
                  <span className="inline-block mt-0.5 max-w-full truncate font-(family-name:--font-display) font-extrabold text-[8.5px] tracking-wide uppercase rounded-full px-1.5 py-0.5" style={{ color: TEAM_COLOR[h.teamKey], background: `${TEAM_COLOR[h.teamKey]}1a` }}>{h.teamName}</span>
                )}
              </span>
              <span className="shrink-0 text-right text-[10.5px] text-muted leading-tight max-w-[110px]">{h.tenure}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function HumanResourcesPage() {
  if (!(await getCurrentTier()).isPrivileged) redirect('/')

  const people = await loadCelebrationPeople()
  const now = new Date()
  const quarterHolders: Record<number, Holder[]> = { 1: [], 2: [], 3: [] }
  const yearHolders = new Map<number, Holder[]>()
  let maxYear = 20
  let underThree = 0

  for (const p of people) {
    if (!p.hireDate) continue
    const t = tenureSince(p.hireDate, now)
    const ms = milestoneOf(t)
    const holder: Holder = { id: p.id, name: p.name, avatarUrl: p.avatarUrl, tenure: formatTenure(t), teamName: p.teamName, teamKey: p.teamKey }
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

  return (
    <div className="space-y-9">
      <div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">Human Resources</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          Anniversary badges — every service milestone and who currently holds it. Click a name to open their card.
        </p>
      </div>

      <section>
        <div className="flex items-center gap-2.5 mb-3.5">
          <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">First year</h2>
          <span className="text-[12.5px] text-muted">quarterly milestones</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(q => (
            <BadgeCard key={`q${q}`} milestone={{ kind: 'quarter', value: q }} label={`${q * 3} months`} holders={quarterHolders[q]} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink mb-3.5">Years of service</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {years.map(y => (
            <BadgeCard key={`y${y}`} milestone={{ kind: 'year', value: y, color: yearColor(y) }} label={`${y} ${y === 1 ? 'year' : 'years'}`} holders={yearHolders.get(y) ?? []} />
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
