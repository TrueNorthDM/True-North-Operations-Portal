/**
 * Reads what people pick in TSheets from the portal's own copy (the import
 * brings it in every 4 hours) and counts hours per value since a day, for
 * translation-coverage.ts. Read only; entries of the 2026 structure are left out.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { allRows, loadCatalog } from './clocky-context'
import type { CoverageField, Used } from './translation-coverage'

export async function loadUsed(since: string): Promise<Used[]> {
  const c = createAdminClient()
  const catalog = await loadCatalog()
  // Field id -> the coverage field it is (the TSheets structure only).
  const byId = new Map<string, CoverageField>()
  const k = catalog.keys
  if (k.company) byId.set(k.company, '1 Company')
  if (k.project) byId.set(k.project, '2 Project')
  if (k.activity) byId.set(k.activity, '3 Activity')
  if (k.code) byId.set(k.code, '1 - i7 Code')
  const { data: tasks, error } = await c.from('tc_fields').select('id').ilike('name', 'tasks').eq('structure', 1).limit(1).maybeSingle()
  if (error) throw new Error(`The Tasks field could not be read: ${error.message}`)
  if (tasks) byId.set(String((tasks as { id: number }).id), 'Tasks')

  type Row = { jobcode_id: number | null; fields: Record<string, string> | null; duration_seconds: number; entry_date: string }
  const rows = await allRows<Row>((a, b) => c.from('tc_entries').select('jobcode_id, fields, duration_seconds, entry_date')
    .gte('entry_date', since).neq('kind', 'absence').order('id').range(a, b), 'Entries could not be read')

  const acc = new Map<string, Used>()
  const add = (field: CoverageField, value: string, seconds: number, day: string) => {
    const v = value.trim()
    if (!v) return
    const key = `${field}|${v}`
    const cur = acc.get(key) ?? { field, value: v, hours: 0, entries: 0, lastDay: '' }
    cur.hours += seconds / 3600
    cur.entries += 1
    if (day > cur.lastDay) cur.lastDay = day
    acc.set(key, cur)
  }
  for (const r of rows) {
    const job = r.jobcode_id != null ? catalog.jobs.get(r.jobcode_id) : undefined
    // Only what TSheets still has on the old structure.
    if (job?.structure === 2) continue
    const top = job ? catalog.jobs.get(job.folderId ?? job.id) : undefined
    add('Job', top?.name ?? '(no job)', r.duration_seconds, r.entry_date)
    for (const [id, v] of Object.entries(r.fields ?? {})) {
      const f = byId.get(id)
      if (f) add(f, String(v), r.duration_seconds, r.entry_date)
    }
  }
  return [...acc.values()]
}
