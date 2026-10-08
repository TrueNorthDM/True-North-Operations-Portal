// Human Resources, for now, the anniversary badge gallery: every service
// milestone (quarterly through the first year, then 1–20 years) with the people
// who currently hold it. The access item Human Resources. A name opens that
// person's page when the viewer may open it (lib/directory/page-rights.ts).

import { createAdminClient } from '@/lib/supabase/admin'
import { tenureSince, milestoneOf, formatTenureShort, yearColor } from '@/lib/tenure'
import { HrGallery, type HrHolder, type HrSection } from '@/components/hr/HrGallery'
import { requireSurface } from '@/lib/access/resolve'
import { teamKeyFromName } from '@/lib/directory/people-types'
import { colourOf, teamColoursFrom } from '@/lib/directory/team-colour'
import { loadLedMemberIds } from '@/lib/directory/person-page-data'
import { pageHrefs } from '@/lib/directory/page-rights'

export const dynamic = 'force-dynamic'

export default async function HumanResourcesPage() {
  const access = await requireSurface('human-resources')
  // The badges need a name, a photo, a team colour and a start date: nothing
  // else is read. Whose page a name opens is the page's own rule.
  const db = createAdminClient()
  const [{ data: rows }, { data: teamRows }, { data: memberships }, led] = await Promise.all([
    db.from('people').select('id, full_name, avatar_url, status, hire_date'),
    db.from('teams').select('id, name, color'),
    db.from('team_members').select('person_id, team_id, is_primary'),
    loadLedMemberIds(db, access.personId),
  ])
  const hrefFor = pageHrefs(access.can, access.personId, led)
  const teams = (teamRows ?? []) as { id: string; name: string; color: string | null }[]
  const palette = teamColoursFrom(teams)
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const primaryTeam = new Map<string, string>()
  for (const m of (memberships ?? []) as { person_id: string; team_id: string; is_primary: boolean | null }[]) {
    if (m.is_primary || !primaryTeam.has(m.person_id)) primaryTeam.set(m.person_id, teamName.get(m.team_id) ?? '')
  }
  const people = ((rows ?? []) as { id: string; full_name: string; avatar_url: string | null; status: string | null; hire_date: string | null }[]).map(p => {
    const team = primaryTeam.get(p.id) || null
    return {
      id: p.id, full_name: p.full_name, avatarUrl: p.avatar_url, status: p.status === 'inactive' ? 'inactive' : 'active',
      hireDate: p.hire_date, teamName: team, teamKey: teamKeyFromName(team ?? undefined), color: colourOf(palette, team),
    }
  })

  const now = new Date()
  const quarterHolders: Record<number, HrHolder[]> = { 1: [], 2: [], 3: [] }
  const yearHolders = new Map<number, HrHolder[]>()
  let maxYear = 20
  let underThree = 0

  for (const p of people) {
    if (p.status !== 'active' || !p.hireDate) continue
    const t = tenureSince(p.hireDate, now)
    const ms = milestoneOf(t)
    const h: HrHolder = { id: p.id, name: p.full_name, avatarUrl: p.avatarUrl, teamName: p.teamName, teamKey: p.teamKey, color: p.color, tenure: formatTenureShort(t), href: hrefFor(p.id) }
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
          Anniversary badges, every service milestone and who currently holds it. A name opens that person&apos;s page.
        </p>
      </div>

      <HrGallery quarters={quarters} years={years} />

      {underThree > 0 && (
        <p className="text-[12.5px] text-muted">
          {underThree} active {underThree === 1 ? 'person has' : 'people have'} been here under 3 months, no badge yet.
        </p>
      )}
    </div>
  )
}
