/** Company settings > Human Resources, read for the section (components/review/HrSettings.tsx). */

import { driveAccount } from '@/lib/agenda/google-drive'
import { defaultYear, loadCurrentCycle, rdb, loadHrSettings, loadImports, loadRoster, nameIn, rosterParticipants } from './data'
import type { HrSettingsData } from '@/components/review/HrSettings'
import { fmtDay } from './format'

export async function loadHrSettingsData(): Promise<HrSettingsData> {
  const [settings, roster, cycle, acc] = await Promise.all([loadHrSettings(), loadRoster(), loadCurrentCycle(), driveAccount().catch(() => ({ ok: false as const, why: 'Drive could not be checked.' }))])
  const year = cycle && !cycle.started_at ? cycle.year : cycle && cycle.year >= defaultYear() ? cycle.year : defaultYear()
  const imports = await loadImports({ year: year - 1 })
  // The month a skipped person left, for "Left the company in June."
  const gone = [...new Set(imports.filter(i => i.match === 'skipped' && i.person_id).map(i => i.person_id as string))]
  const left = new Map<string, string>()
  if (gone.length) {
    const r = await rdb().from('people').select('id, left_on').in('id', gone)
    for (const p of (r.data ?? []) as { id: string; left_on: string | null }[]) if (p.left_on) left.set(p.id, p.left_on)
  }
  // The goals each imported file gave (migration 150), for HR to check.
  const ids = imports.filter(i => i.imported_at).map(i => i.id)
  const read = ids.length ? ((await rdb().from('review_goals').select('id, import_id, what, by_month').in('import_id', ids).order('position')).data ?? []) as { id: number; import_id: number; what: string; by_month: string | null }[] : []
  const parts = rosterParticipants(roster, settings)
  const active = [...roster.people.values()].filter(p => p.active).sort((a, b) => a.name.localeCompare(b.name))
  const same = cycle && cycle.year === year ? cycle : null
  const secondList = (): HrSettingsData['second'] => {
    const out: HrSettingsData['second'] = []
    for (const p of parts) {
      const o = settings.second[p.personId]
      if (!p.secondReviewerId && o !== false) continue
      out.push({ personId: p.personId, name: nameIn(roster, p.personId), first: nameIn(roster, p.reviewerId) || 'Nobody yet', firstArea: p.area,
        reviewer: p.secondReviewerId ? nameIn(roster, p.secondReviewerId) : null, area: p.secondArea, how: o === false ? 'none' : o ? 'hand' : 'rule' })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }
  return {
    year,
    roles: { vpId: settings.vpId, cisoId: settings.cisoId, hrId: settings.hrId },
    people: active.map(p => ({ value: p.id, label: p.name })),
    employees: parts.filter(p => !settings.extra.includes(p.personId)).length,
    extra: settings.extra.map(id => ({ id, name: nameIn(roster, id) })),
    datesLine: same?.started_at
      ? `The ${year} reviews started ${fmtDay(same.started_at.slice(0, 10))}; everything is due by ${fmtDay(same.approval_due)}, and the 6-month check-in comes ${fmtDay(same.checkins_by, true)}.`
      : `The ${year} reviews have not started. The VP of Operations is reminded on the second Monday of November.`,
    second: secondList(),
    started: same?.started_at ?? null,
    drive: { name: settings.driveFolderName, ready: acc.ok, why: acc.ok ? null : acc.why, account: acc.ok ? acc.email : null },
    imports: imports.map(i => ({ id: i.id, file: i.file_name, personId: i.person_id, person: i.person_id ? nameIn(roster, i.person_id) : null, match: i.match, imported: !!i.imported_at,
      leftOn: i.person_id ? left.get(i.person_id) ?? null : null,
      found: i.found ? { read: i.found.read, job: Object.values(i.found.job ?? {}).filter(Boolean).length } : null,
      goals: read.filter(g => g.import_id === i.id).map(g => ({ id: g.id, what: g.what, byMonth: g.by_month })) })),
  }
}
