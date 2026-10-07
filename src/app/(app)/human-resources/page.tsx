// Human Resources, for now, the anniversary badge gallery: every service
// milestone (quarterly through the first year, then 1–20 years) with the people
// who currently hold it. The access item Human Resources. Clicking a person opens their card
// in place (no navigation).

import { createClient } from '@/lib/supabase/server'
import { tenureSince, milestoneOf, formatTenureShort, yearColor } from '@/lib/tenure'
import { loadDirectoryPeopleView } from '@/lib/directory/people-view'
import { HrGallery, type HrHolder, type HrSection } from '@/components/hr/HrGallery'
import { requireSurface } from '@/lib/access/resolve'
import { cardRights } from '@/lib/directory/people-types'

export const dynamic = 'force-dynamic'

export default async function HumanResourcesPage() {
  const access = await requireSurface('human-resources')
  // The badges are this page; the cards behind the names are "Open anyone's
  // card" (d-cards), and what each card carries follows the Directory's items.
  const opensCards = access.can('d-cards')
  const rights = cardRights(access.can)

  const supabase = await createClient()
  const { people, teamOptions } = await loadDirectoryPeopleView(supabase, rights)

  const now = new Date()
  const quarterHolders: Record<number, HrHolder[]> = { 1: [], 2: [], 3: [] }
  const yearHolders = new Map<number, HrHolder[]>()
  let maxYear = 20
  let underThree = 0

  for (const p of people) {
    if (p.status !== 'active' || !p.hireDate) continue
    const t = tenureSince(p.hireDate, now)
    const ms = milestoneOf(t)
    const h: HrHolder = { id: p.id, name: p.full_name, avatarUrl: p.avatarUrl, teamName: p.teamName, teamKey: p.teamKey, color: p.color, tenure: formatTenureShort(t) }
    if (ms.kind === 'quarter') quarterHolders[ms.value].push(h)
    else if (ms.kind === 'year') {
      const arr = yearHolders.get(ms.value) ?? []
      arr.push(h)
      yearHolders.set(ms.value, arr)
      if (ms.value > maxYear) maxYear = ms.value
    } else underThree++
  }
  for (const arr of [...Object.values(quarterHolders), ...yearHolders.values()]) arr.sort((a, b) => a.name.localeCompare(b.name))

  const quarters: HrSection[] = [1, 2, 3].map(q => ({ key: `q${q}`, milestone: { kind: 'quarter', value: q }, label: `${q * 3} months`, holders: quarterHolders[q] }))
  const years: HrSection[] = Array.from({ length: maxYear }, (_, i) => i + 1).map(y => ({
    key: `y${y}`,
    milestone: { kind: 'year', value: y, color: yearColor(y) },
    label: `${y} ${y === 1 ? 'year' : 'years'}`,
    holders: yearHolders.get(y) ?? [],
  }))

  return (
    <div className="space-y-9">
      <div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">Human Resources</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          Anniversary badges, every service milestone and who currently holds it. Click a name to open their card.
        </p>
      </div>

      <HrGallery quarters={quarters} years={years} people={opensCards ? people : []} teamOptions={teamOptions} rights={opensCards ? rights : null} />

      {underThree > 0 && (
        <p className="text-[12.5px] text-muted">
          {underThree} active {underThree === 1 ? 'person has' : 'people have'} been here under 3 months, no badge yet.
        </p>
      )}
    </div>
  )
}
