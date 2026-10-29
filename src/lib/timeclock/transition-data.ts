/**
 * The transition report's data (North Time > Transition): every TSheets entry
 * (tc_entries, source 'tsheets') dated in the period, never before the switch
 * date, read by transition-check.ts. With no switch date there is nothing to
 * read: the page says so.
 *
 * Reading only, with the privileged client (Clocky's tables are the server's
 * alone). Not a "use server" file: app/(app)/clocky-hours/transition/page.tsx
 * asks it after its own access check.
 */

import { allRows, db, loadCatalog, loadDirectory, must } from './clocky-context'
import { buildTransition, periodOf, type CheckEntry, type CheckJob, type TransitionView } from './transition-check'

export interface TransitionQuery { from?: string | null; to?: string | null; person?: string | null; problems?: boolean }

export type TransitionData =
  | { switchDate: null }
  | ({ switchDate: string; from: string; to: string | null; personId: string | null; onlyProblems: boolean; activityField: string | null } & TransitionView)

export async function loadTransition(q: TransitionQuery): Promise<TransitionData> {
  const catalog = await loadCatalog()
  if (!catalog.switchDate) return { switchDate: null }
  const { from, to } = periodOf(catalog.switchDate, q.from, q.to)
  const c = db()
  const [dir, fieldRes, rows] = await Promise.all([
    loadDirectory(),
    c.from('tc_fields').select('id, name'),
    allRows<{ id: number; external_id: number | null; person_id: string; entry_date: string; duration_seconds: number; jobcode_id: number | null; fields: Record<string, string> | null; notes: string | null }>(
      (a, b) => {
        let s = c.from('tc_entries').select('id, external_id, person_id, entry_date, duration_seconds, jobcode_id, fields, notes')
          .eq('source', 'tsheets').gte('entry_date', from)
        if (to) s = s.lte('entry_date', to)
        return s.order('id').range(a, b)
      }, 'The TSheets entries could not be read'),
  ])
  const fields = (must(fieldRes, 'The fields could not be read') ?? []) as { id: number; name: string }[]

  const jobs = new Map<number, CheckJob>()
  for (const j of catalog.jobs.values()) {
    jobs.set(j.id, { id: j.id, name: j.name, path: j.path, parentId: j.parentId, kind: j.kind, billable: j.billable, isFolder: j.isFolder, structure: j.structure, level: j.level, client2026: j.client2026, topName: j.topName })
  }
  const entries: CheckEntry[] = rows.map(r => ({
    id: r.id, externalId: r.external_id, personId: r.person_id, date: r.entry_date, seconds: r.duration_seconds ?? 0,
    jobcodeId: r.jobcode_id, fields: r.fields ?? {}, notes: r.notes,
  }))
  const activityFieldId = catalog.keys2026.activity
  const personId = q.person && entries.some(e => e.personId === q.person) ? q.person : null
  const onlyProblems = !!q.problems
  const view = buildTransition(entries, {
    jobs,
    fieldLabels: new Map(fields.map(f => [String(f.id), f.name])),
    activityFieldId,
    oldKeys: { ...catalog.keys, tasks: catalog.tasksKey },
    nameOf: id => dir.nameOf(id),
  }, { from, to, personId, onlyProblems })

  return {
    switchDate: catalog.switchDate, from, to, personId, onlyProblems,
    activityField: activityFieldId ? fields.find(f => String(f.id) === activityFieldId)?.name ?? null : null,
    ...view,
  }
}
