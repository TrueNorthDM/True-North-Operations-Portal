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
import { activityNeedsNotes, fieldsOfStructure, structureOn, type FieldName, type Structure } from './entry-rules'
import { localDate } from './format'
import { allRows, loadCatalog, type Catalog, type Job } from './clocky-context'
import { ACTIVITIES } from './structure-2026'

export interface CatalogueRow {
  id: number
  name: string
  path: string
  folder: boolean
  parentId: number | null
  /** 0 a top folder or job; 1 inside it; 2 a 2026 project inside a division. */
  depth: 0 | 1 | 2
  structure: Structure
  level: 'client' | 'division' | 'project' | null
  use: string
  billable: boolean
  active: boolean
  i7: boolean
  company: string
  project: string
}

export interface CatalogueField {
  key: FieldName
  structure: Structure
  id: string
  label: string
  hint: string
  options: { id: number; label: string; shown: boolean; used: number }[]
}

/** A 2026 Activity, as "Which job?" and the catalogue list it: shared by every project. */
export interface ActivityRow { family: string; name: string; covers: string; notesRequired: boolean }

/** The 2026 Activities from the Activity field's options, with their family and what each covers. */
export function activityRows(catalog: Pick<Catalog, 'fields'>): ActivityRow[] {
  const field = fieldsOfStructure(catalog.fields, 2).find(f => f.key === 'activity')
  const covers = new Map(ACTIVITIES.map(a => [a.name.toLowerCase(), a.covers]))
  return (field?.options ?? []).map(name => ({
    name, family: field?.families?.[name] ?? '', covers: covers.get(name.toLowerCase()) ?? '', notesRequired: activityNeedsNotes(name),
  }))
}

export interface CatalogueData {
  /** The TSheets job tree. */
  rows: CatalogueRow[]
  /** The 2026 structure: clients, divisions, projects. */
  rows2026?: CatalogueRow[]
  /** The 2026 Activities, listed under the projects as on "Which job?". */
  activities2026?: ActivityRow[]
  /** The TSheets top folders, with the 2026 client each reports under (migration 131). */
  folders1?: { id: number; name: string; clientId: number | null }[]
  /** The day the 2026 structure starts, or null. */
  switchDate?: string | null
  /** From the switch date the TSheets tree is frozen: switched off, never renamed or moved (the history keeps its names). */
  frozen?: boolean
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

/**
 * The tree as listed: each top-level folder or job in order, a folder's jobs
 * under it. The TSheets tree has two levels; the 2026 structure three
 * (Client › Division › Project, True North Internal's projects right under it).
 */
export function catalogueRows(catalog: Pick<Catalog, 'jobs'>, structure: Structure = 1): CatalogueRow[] {
  const all = [...catalog.jobs.values()].filter(j => (j.structure ?? 1) === structure)
  const row = (j: Job, depth: 0 | 1 | 2): CatalogueRow => ({
    id: j.id, name: j.name, path: j.path, folder: j.isFolder, parentId: j.parentId, depth, structure, level: j.level ?? null, use: j.whenToUse ?? '',
    billable: j.billable, active: j.active, i7: j.isI7, company: j.defaultCompany ?? '', project: j.defaultProject ?? '',
  })
  const out: CatalogueRow[] = []
  const under = (id: number) => all.filter(j => j.parentId === id && shown(j)).sort(byOrder)
  for (const top of all.filter(j => j.parentId == null && shown(j)).sort(byOrder)) {
    out.push(row(top, 0))
    if (!top.isFolder) continue
    for (const k of under(top.id)) {
      out.push(row(k, 1))
      if (structure === 2 && k.isFolder) for (const p of under(k.id)) out.push(row(p, 2))
    }
  }
  return out
}

export async function loadCatalogueData(): Promise<CatalogueData> {
  const c = createAdminClient()
  const catalog = await loadCatalog()
  const fieldIds = catalog.fields.map(f => Number(f.id))
  type Opt = { id: number; field_id: number; label: string; active: boolean; position: number }
  const [opts, clientRes, ...useRes] = await Promise.all([
    // Every option, a page at a time: PostgREST stops at 1,000 whatever the limit asked (audit, 27 October 2026).
    allRows<Opt>((a, b) => c.from('tc_field_options').select('id, field_id, label, active, position').in('field_id', fieldIds).order('position').order('label').order('id').range(a, b), 'The field options could not be read'),
    c.from('tr_clients').select('name, active, tsheets_jobcode_id, parent_id').is('parent_id', null).order('name'),
    ...fieldIds.map(id => c.rpc('tc_field_option_use', { p_field_id: id })),
  ])
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

  const today = localDate(new Date(), 'America/New_York')
  return {
    rows: catalogueRows(catalog),
    rows2026: catalogueRows(catalog, 2),
    activities2026: activityRows(catalog),
    // The folders the TSheets tree shows, and any already linked.
    folders1: [...catalog.jobs.values()].filter(j => j.structure === 1 && j.parentId == null && j.kind === 'regular' && (j.active || j.editedInPortal || j.client2026Id != null))
      .sort((a, b) => a.name.localeCompare(b.name)).map(j => ({ id: j.id, name: j.name, clientId: j.client2026Id })),
    switchDate: catalog.switchDate,
    frozen: structureOn(today, catalog.switchDate) === 2,
    fields: catalog.fields.map(f => ({
      key: f.key, structure: f.structure, id: f.id, label: f.label,
      hint: f.structure === 2 ? 'The kind of work, in families. Client, Division and Project are the job.' : HINT[f.key],
      options: opts.filter(o => String(o.field_id) === f.id)
        .map(o => ({ id: o.id, label: o.label, shown: o.active, used: used.get(`${f.id}:${o.label}`) ?? 0 })),
    })),
    clients: (clientRes.data ?? []).map(r => ({ name: r.name, folder: r.tsheets_jobcode_id != null ? byExternal.get(Number(r.tsheets_jobcode_id))?.path ?? '' : '', active: r.active })),
  }
}

// ── "Which job?" (11D) ──────────────────────────────────────────────────────

export interface GuideGroup { folder: string; use: string; rows: { id: number; name: string; path: string; use: string; billable: boolean }[] }

/** Every job people can pick, by folder, with its line; top-level jobs together under "Other jobs". */
export function guideGroups(catalog: Pick<Catalog, 'jobs' | 'switchDate'>, day = localDate(new Date(), 'America/New_York')): GuideGroup[] {
  return groupsOf(catalogueRows(catalog, structureOn(day, catalog.switchDate)))
}

/** The same, from the catalogue's rows. */
export function groupsOf(all: readonly CatalogueRow[]): GuideGroup[] {
  const rows = all.filter(r => r.active)
  const groups: GuideGroup[] = []
  let other: GuideGroup | null = null
  for (const r of rows) {
    // A folder starts a group: a TSheets client, or a 2026 client or division ("COE Group › Africa").
    if (r.folder) { groups.push({ folder: r.depth === 0 ? r.name : r.path, use: r.use, rows: [] }); continue }
    const item = { id: r.id, name: r.name, path: r.path, use: r.use, billable: r.billable }
    if (r.depth > 0) { groups.at(-1)?.rows.push(item); continue }
    if (!other) { other = { folder: 'Other jobs', use: 'Client jobs with no folder.', rows: [] }; groups.push(other) }
    other.rows.push(item)
  }
  return groups.filter(g => g.rows.length)
}
