/**
 * Reads what people pick in TSheets from the portal's own copy (the import
 * brings it in) and counts hours per value since a day, for
 * translation-coverage.ts. Read only. This version needs nothing but the
 * tables the portal already has (tc_jobcodes, tc_fields, tc_entries).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadEntryFieldKeys } from './manual-fields'
import type { CoverageField, Used } from './translation-coverage'

const PAGE = 1000

/** Every row of a query, 1,000 at a time (PostgREST stops at 1,000 without saying so); a failed page stops the check. */
async function allPages<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(`${what}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

export async function loadUsed(since: string): Promise<Used[]> {
  const c = createAdminClient()
  const keys = await loadEntryFieldKeys(c)
  const byId = new Map<string, CoverageField>()
  if (keys.company) byId.set(keys.company, '1 Company')
  if (keys.project) byId.set(keys.project, '2 Project')
  if (keys.activity) byId.set(keys.activity, '3 Activity')
  if (keys.code) byId.set(keys.code, '1 - i7 Code')
  const { data: tasks, error } = await c.from('tc_fields').select('id').ilike('name', 'tasks').limit(1).maybeSingle()
  if (error) throw new Error(`The Tasks field could not be read: ${error.message}`)
  if (tasks) byId.set(String((tasks as { id: number }).id), 'Tasks')

  // Each job's top-level name: "1 - True North" for "1 - True North > Content".
  const jobs = await allPages<{ id: number; name: string; parent_id: number | null }>(
    (a, b) => c.from('tc_jobcodes').select('id, name, parent_id').order('id').range(a, b), 'Job codes could not be read')
  const byJob = new Map(jobs.map(j => [j.id, j]))
  const topOf = (id: number): string => {
    let cur = byJob.get(id)
    for (let i = 0; i < 20 && cur?.parent_id != null && byJob.has(cur.parent_id); i++) cur = byJob.get(cur.parent_id)
    return cur?.name ?? '(no job)'
  }

  type Row = { jobcode_id: number | null; fields: Record<string, string> | null; duration_seconds: number; entry_date: string }
  const rows = await allPages<Row>((a, b) => c.from('tc_entries').select('jobcode_id, fields, duration_seconds, entry_date')
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
    add('Job', r.jobcode_id != null ? topOf(r.jobcode_id) : '(no job)', r.duration_seconds, r.entry_date)
    for (const [id, v] of Object.entries(r.fields ?? {})) {
      const f = byId.get(id)
      if (f) add(f, String(v), r.duration_seconds, r.entry_date)
    }
  }
  return [...acc.values()]
}
