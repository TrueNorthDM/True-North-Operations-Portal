/**
 * The job catalogue (Clocky part 2, Job Catalogue.dc.html 11A, 11B, 11D):
 * the jobs people pick in Clocky, their fields and the clients, kept by the
 * portal. A Super Admin edits them in Company settings > Job catalogue;
 * everyone reads them on "Which job?".
 *
 * The tree shows the active jobs (two levels: folders and the jobs in them),
 * and the ones switched off here; the hundreds of retired QuickBooks Time
 * codes stay out of it.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { FieldName } from './entry-rules'
import { allRows, loadCatalog, type Catalog, type Job } from './clocky-context'

export interface CatalogueRow {
  id: number
  name: string
  path: string
  folder: boolean
  parentId: number | null
  depth: 0 | 1
  use: string
  billable: boolean
  active: boolean
  i7: boolean
  company: string
  project: string
}

export interface CatalogueField {
  key: FieldName
  id: string
  label: string
  hint: string
  options: { id: number; label: string; shown: boolean; used: number }[]
}

export interface CatalogueData {
  rows: CatalogueRow[]
  fields: CatalogueField[]
  clients: { name: string; folder: string; active: boolean }[]
}

const HINT: Record<FieldName, string> = {
  company: 'Who the work is for, on paper.',
  project: 'The project inside the company.',
  activity: 'What kind of work it was.',
  billable: 'Filled from the job; people can change it.',
  code: 'Asked only on 2 - i7 Marketing jobs.',
}

const shown = (j: Job) => j.kind === 'regular' && (j.active || j.editedInPortal)
const byOrder = (a: Job, b: Job) => (a.sortOrder ?? 1e9) - (b.sortOrder ?? 1e9) || a.name.localeCompare(b.name)

/** The tree as listed: each top-level folder or job in order, a folder's jobs under it. */
export function catalogueRows(catalog: Pick<Catalog, 'jobs'>): CatalogueRow[] {
  const all = [...catalog.jobs.values()]
  const row = (j: Job, depth: 0 | 1): CatalogueRow => ({
    id: j.id, name: j.name, path: j.path, folder: j.isFolder, parentId: j.parentId, depth, use: j.whenToUse ?? '',
    billable: j.billable, active: j.active, i7: j.isI7, company: j.defaultCompany ?? '', project: j.defaultProject ?? '',
  })
  const out: CatalogueRow[] = []
  for (const top of all.filter(j => j.parentId == null && shown(j)).sort(byOrder)) {
    out.push(row(top, 0))
    if (top.isFolder) for (const k of all.filter(j => j.parentId === top.id && shown(j)).sort(byOrder)) out.push(row(k, 1))
  }
  return out
}

export async function loadCatalogueData(): Promise<CatalogueData> {
  const c = createAdminClient()
  const catalog = await loadCatalog()
  const fieldIds = catalog.fields.map(f => Number(f.id))
  const [optRes, clientRes, ...useRes] = await Promise.all([
    c.from('tc_field_options').select('id, field_id, label, active, position').in('field_id', fieldIds).order('position').order('label').limit(5000),
    c.from('tr_clients').select('name, active, tsheets_jobcode_id, parent_id').is('parent_id', null).order('name'),
    ...fieldIds.map(id => c.rpc('tc_field_option_use', { p_field_id: id })),
  ])
  if (optRes.error) throw new Error(`The field options could not be read: ${optRes.error.message}`)
  if (clientRes.error) throw new Error(`The clients could not be read: ${clientRes.error.message}`)
  const used = new Map<string, number>()
  useRes.forEach((r, i) => {
    if (r.error) throw new Error(`The option counts could not be read: ${r.error.message}`)
    for (const u of (r.data ?? []) as { label: string; entries: number }[]) used.set(`${fieldIds[i]}:${u.label}`, Number(u.entries))
  })
  const byExternal = new Map<number, Job>()
  // Every row, a page at a time (PostgREST stops at 1,000), and a failed read throws.
  const ext = await allRows<{ id: number; external_id: number | null }>((a, b) => c.from('tc_jobcodes').select('id, external_id').not('external_id', 'is', null).order('id').range(a, b), 'Job codes could not be read')
  for (const r of ext) { const j = catalog.jobs.get(r.id); if (j && r.external_id != null) byExternal.set(Number(r.external_id), j) }

  return {
    rows: catalogueRows(catalog),
    fields: catalog.fields.map(f => ({
      key: f.key, id: f.id, label: f.label, hint: HINT[f.key],
      options: (optRes.data ?? []).filter(o => String(o.field_id) === f.id)
        .map(o => ({ id: o.id, label: o.label, shown: o.active, used: used.get(`${f.id}:${o.label}`) ?? 0 })),
    })),
    clients: (clientRes.data ?? []).map(r => ({ name: r.name, folder: r.tsheets_jobcode_id != null ? byExternal.get(Number(r.tsheets_jobcode_id))?.path ?? '' : '', active: r.active })),
  }
}

// ── "Which job?" (11D) ──────────────────────────────────────────────────────

export interface GuideGroup { folder: string; use: string; rows: { id: number; name: string; path: string; use: string; billable: boolean }[] }

/** Every job people can pick, by folder, with its line; top-level jobs together under "Other jobs". */
export function guideGroups(catalog: Pick<Catalog, 'jobs'>): GuideGroup[] {
  return groupsOf(catalogueRows(catalog))
}

/** The same, from the catalogue's rows. */
export function groupsOf(all: readonly CatalogueRow[]): GuideGroup[] {
  const rows = all.filter(r => r.active)
  const groups: GuideGroup[] = []
  let other: GuideGroup | null = null
  for (const r of rows) {
    if (r.depth === 0 && r.folder) { groups.push({ folder: r.name, use: r.use, rows: [] }); continue }
    const item = { id: r.id, name: r.name, path: r.path, use: r.use, billable: r.billable }
    if (r.depth === 1) { groups.at(-1)?.rows.push(item); continue }
    if (!other) { other = { folder: 'Other jobs', use: 'Client jobs with no folder.', rows: [] }; groups.push(other) }
    other.rows.push(item)
  }
  return groups.filter(g => g.rows.length)
}
