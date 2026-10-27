// Job Catalogue.dc.html's sample, for frames 11A, 11B, 11Cl and 11D: its
// tree, its "When to use" lines and defaults, its fields and its counts.

import { WHEN } from '../clocky-clock/sample'
import { groupsOf, type CatalogueData, type CatalogueRow, type GuideGroup } from '@/lib/timeclock/job-catalogue'
import type { FieldName } from '@/lib/timeclock/entry-rules'
import { STRUCTURE } from '@/lib/timeclock/structure-2026'

const TREE0: { f?: string; j?: string; kids?: string[] }[] = [
  { f: '1 - True North', kids: ['Administrative', 'Content', 'Management', 'Marketing', 'Meetings', 'Project Management', 'SEO', 'Web Dev'] },
  { f: '2 - i7 Marketing', kids: ['Administrative', 'Content', 'Management', 'Marketing', 'Meetings', 'Project Management', 'SEO', 'Strategy Sprint', 'Web Dev'] },
  { j: 'A.org Job' }, { j: 'Adventist Messengers/HFA' }, { j: 'DDI' }, { j: 'GNA' }, { j: 'Rwanda-Incidental' },
]
const DEF_COMPANY: Record<string, string> = { '1 - True North': 'True North', '2 - i7 Marketing': 'True North', 'A.org Job': 'A.org', 'Adventist Messengers/HFA': 'COE', DDI: 'DDI', GNA: 'GNA/COEI', 'Rwanda-Incidental': 'True North' }
const DEF_PROJECT: Record<string, string> = { '1 - True North': 'In-House', '2 - i7 Marketing': 'In-House', 'A.org Job': 'NAD', 'Adventist Messengers/HFA': 'NAD', DDI: 'In-House', GNA: 'GYC', 'Rwanda-Incidental': 'Rwanda' }
const FIELDS: [FieldName, string, string, string[]][] = [
  ['company', '1 Company', 'Who the work is for, on paper.', ['True North', 'COE', 'GNA/COEI', 'A.org', 'DDI', 'i7']],
  ['project', '2 Project', 'The project inside the company.', ['AAAF', 'Africa', 'ASI', 'Called!', 'GP church', 'GP School', 'GYC', 'In-House', 'Internship', "Messiah's Mansion", 'NAD', 'not listed--ask Dave', 'Rwanda']],
  ['activity', '3 Activity', 'What kind of work it was.', ['WebDev', 'Translation', 'Social Media', 'General admin', 'Meeting: Status', 'Content: Writing', 'Content: Editing', 'SEO: Routine', 'Design', 'Video editing', 'Project management']],
  ['billable', '4 Billable', 'Filled from the job; people can change it.', ['Yes', 'No']],
  ['code', 'i7 Code', 'Asked only on 2 - i7 Marketing jobs.', ['i7-ADMIN', 'i7-MKTG', 'i7-WEBDVT', 'i7-SEO', 'i7-CONT', 'i7-SOC', 'i7-PM', 'i7-STRAT', 'i7-VIDEO', 'i7-DESIGN', 'i7-MEET', 'i7-EMAIL', 'BE-MKTG', 'BE-ADMIN', 'BE-WEBDVT', 'BE-SEO', 'WM-ADMIN', 'WM-MKTG', 'WM-WEBDVT', 'MME-WEBDVT', 'MME-MKTG', 'MME-ADMIN']],
]

/** The 2026 structure as structure-2026.ts has it, ids from 1000. */
function rows2026(): CatalogueRow[] {
  const out: CatalogueRow[] = []
  let id = 1000
  for (const c of STRUCTURE) {
    const cid = ++id
    const base = { use: '', billable: c.billable, active: true, i7: false, company: '', project: '', structure: 2 as const }
    out.push({ ...base, id: cid, name: c.name, path: c.name, folder: true, parentId: null, depth: 0, level: 'client' })
    for (const d of c.divisions) {
      const did = ++id
      out.push({ ...base, id: did, name: d.name, path: `${c.name} › ${d.name}`, folder: true, parentId: cid, depth: 1, level: 'division' })
      for (const p of d.projects) out.push({ ...base, id: ++id, name: p.name, path: `${c.name} › ${d.name} › ${p.name}`, folder: false, parentId: did, depth: 2, level: 'project' })
    }
    for (const p of c.projects) out.push({ ...base, id: ++id, name: p.name, path: `${c.name} › ${p.name}`, folder: false, parentId: cid, depth: 1, level: 'project' })
  }
  return out
}

function rows(): CatalogueRow[] {
  const out: CatalogueRow[] = []
  let id = 0
  for (const t of TREE0) {
    const top = t.f ?? t.j!
    const w = WHEN[top]
    const topId = ++id
    out.push({ id: topId, name: top, path: top, folder: !!t.f, parentId: null, depth: 0, structure: 1, level: null, use: w?.[0] ?? '', billable: w?.[1] === 'yes', active: true, i7: top.startsWith('2 - i7'), company: DEF_COMPANY[top] ?? '', project: DEF_PROJECT[top] ?? '' })
    for (const k of t.kids ?? []) {
      const path = `${top} › ${k}`, wk = WHEN[path]
      out.push({ id: ++id, name: k, path, folder: false, parentId: topId, depth: 1, structure: 1, level: null, use: wk?.[0] ?? '', billable: wk?.[1] === 'yes', active: true, i7: top.startsWith('2 - i7'), company: DEF_COMPANY[top] ?? '', project: DEF_PROJECT[top] ?? '' })
    }
  }
  return out
}

export function catalogueFrame(): CatalogueData {
  let optId = 0
  return {
    rows: rows(),
    rows2026: rows2026(),
    switchDate: '2026-11-01',
    frozen: false,
    fields: FIELDS.map(([key, label, hint, options], fi) => ({
      key, structure: 1, id: String(fi + 1), label, hint,
      // The prototype's "Used in" numbers.
      options: options.map((o, i) => ({ id: ++optId, label: o, shown: o !== 'MME-ADMIN', used: key === 'billable' ? (o === 'Yes' ? 4120 : 2210) : Math.max(0, 640 - i * 47 - o.length * 3) })),
    })),
    clients: [['True North', '1 - True North'], ['i7 Marketing', '2 - i7 Marketing'], ['Adventist.org', 'A.org Job'], ['Adventist Messengers / Hope for Africa', 'Adventist Messengers/HFA'], ['DDI', 'DDI'], ['GNA', 'GNA'], ['Rwanda', 'Rwanda-Incidental']]
      .map(([name, folder]) => ({ name, folder, active: true })),
  }
}

/** 11A opens "2 - i7 Marketing › Content". */
export const catalogueStartId = (): number => rows().find(r => r.path === '2 - i7 Marketing › Content')!.id

export const guideFrame = (): { groups: GuideGroup[]; codes: string[] } => ({
  groups: groupsOf(rows()),
  codes: FIELDS.find(f => f[0] === 'code')![3].filter(c => c !== 'MME-ADMIN'),
})
