/**
 * Rebuilding QuickBooks Time (TSheets) in the 2026 structure on the switch
 * date (owner, 26 October 2026), so whoever still clocks there records Client,
 * Division, Project and the 2026 Activity, and the import brings each entry in
 * one to one. Claude runs it once, on that day.
 *
 * In order (QuickBooks Time allows at most 6 active custom fields, and all 6
 * are taken by the old ones):
 *   1. archive the old custom fields (Company, Project, Activity, Billable,
 *      i7 Code, Tasks): old entries keep their values;
 *   2. create the 2026 structure as jobs, client first, then divisions, then
 *      projects, each with its billable flag, assigned to everyone;
 *   3. create the "Activity" field (a list, required, shown on every job) and
 *      its 26 values;
 *   4. archive the old jobs (time off jobs stay);
 *   5. write each new TSheets id onto the portal's own row, so the import
 *      matches them instead of creating copies (the portal's rows are marked
 *      edited, which the import leaves alone).
 *
 * Nothing is written to QuickBooks Time unless TSHEETS_WRITE=on AND the
 * caller asks for a live run; otherwise it only says what it would do.
 */

import type { Db } from '@/lib/supabase/types'

const BASE = 'https://rest.tsheets.com/api/v1'
/** QuickBooks Time takes at most 50 items per create or update. */
const BATCH = 50

export interface PortalJob { id: number; parent_id: number | null; name: string; level: string | null; billable: boolean; external_id: number | null; structure: number; kind: string; active: boolean; sort_order: number | null }
export interface PortalField { id: number; external_id: number | null; name: string; active: boolean; structure: number }
export interface PortalOption { id: number; field_id: number; label: string; external_id: number | null; active: boolean }

export interface RebuildPlan {
  archiveFields: PortalField[]
  /** The 2026 jobs in creation order: every parent before its children. */
  createJobs: PortalJob[]
  activityField: PortalField | null
  createItems: PortalOption[]
  archiveJobs: PortalJob[]
  problems: string[]
}

/** What the rebuild would do, from the portal's rows. Pure. */
export function planRebuild(jobs: readonly PortalJob[], fields: readonly PortalField[], options: readonly PortalOption[]): RebuildPlan {
  const problems: string[] = []
  const v2 = jobs.filter(j => j.structure === 2 && j.active)
  const byId = new Map(v2.map(j => [j.id, j]))
  const depth = (j: PortalJob): number => {
    let d = 0
    for (let cur = j; cur.parent_id != null && byId.has(cur.parent_id) && d < 5; cur = byId.get(cur.parent_id)!) d++
    return d
  }
  const order = (a: PortalJob, b: PortalJob) => depth(a) - depth(b) || (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9) || a.id - b.id
  const createJobs = v2.filter(j => j.external_id == null).sort(order)
  for (const j of v2) if (j.parent_id != null && !byId.has(j.parent_id)) problems.push(`"${j.name}" sits under a job that is not in the 2026 structure.`)

  const archiveFields = fields.filter(f => f.structure === 1 && f.active && f.external_id != null)
  const activityField = fields.find(f => f.structure === 2 && f.active) ?? null
  if (!activityField) problems.push('The 2026 Activity field is missing in the portal.')
  const createItems = activityField ? options.filter(o => o.field_id === activityField.id && o.active && o.external_id == null) : []
  const stillActive = fields.filter(f => f.active && f.external_id != null).length - archiveFields.length
  if (stillActive + (activityField?.external_id == null ? 1 : 0) > 6) problems.push('QuickBooks Time allows 6 active custom fields: archive more before adding Activity.')

  // Old work jobs only: time off (pto, unpaid) stays as it is.
  const archiveJobs = jobs.filter(j => j.structure === 1 && j.active && j.kind === 'regular' && j.external_id != null)
  return { archiveFields, createJobs, activityField, createItems, archiveJobs, problems }
}

/** The plan in words, for the dry run and the log. */
export function planText(p: RebuildPlan): string[] {
  return [
    `Archive ${p.archiveFields.length} old custom fields: ${p.archiveFields.map(f => f.name).join(', ') || 'none'}.`,
    `Create ${p.createJobs.length} jobs (clients, divisions, projects), each assigned to everyone.`,
    p.activityField ? `${p.activityField.external_id == null ? 'Create' : 'Keep'} the "${p.activityField.name}" field and create ${p.createItems.length} values.` : 'No 2026 Activity field.',
    `Archive ${p.archiveJobs.length} old work jobs (time off stays).`,
    ...p.problems.map(x => `Problem: ${x}`),
  ]
}

type Write = (method: 'POST' | 'PUT', path: string, data: Record<string, unknown>[]) => Promise<Record<string, { id?: number; _status_code?: number; _status_message?: string }>>

/** One batched write to QuickBooks Time; the results come back keyed "1", "2"... in the order sent. */
function writer(token: string): Write {
  return async (method, path, data) => {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }), cache: 'no-store', signal: AbortSignal.timeout(30_000),
    })
    const json = await res.json().catch(() => null) as { results?: Record<string, Record<string, { id?: number; _status_code?: number; _status_message?: string }>>; error?: { message: string } } | null
    if (!res.ok || !json || json.error) throw new Error(`QuickBooks Time ${method} ${path}: ${json?.error?.message ?? `HTTP ${res.status}`}`)
    const key = path.replace(/^\//, '')
    return json.results?.[key] ?? {}
  }
}

/** Sends in batches of 50 and returns the new ids in the order sent; any item refused stops the run. */
async function inBatches<T>(write: Write, method: 'POST' | 'PUT', path: string, items: readonly T[], body: (x: T) => Record<string, unknown>): Promise<number[]> {
  const ids: number[] = []
  for (let i = 0; i < items.length; i += BATCH) {
    const part = items.slice(i, i + BATCH)
    const res = await write(method, path, part.map(body))
    part.forEach((_, k) => {
      const r = res[String(k + 1)]
      if (!r || (r._status_code && r._status_code >= 300)) throw new Error(`QuickBooks Time refused item ${i + k + 1} of ${path}: ${r?._status_message ?? 'no answer'}`)
      ids.push(Number(r.id))
    })
  }
  return ids
}

/**
 * Whether the token's QuickBooks Time user may create and archive jobs and
 * custom fields (an admin, or manage_jobcodes for the jobs). Read only: it asks
 * who the token belongs to and changes nothing.
 */
export async function writeAccess(token: string): Promise<{ ok: boolean; line: string }> {
  try {
    const res = await fetch(`${BASE}/current_user`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(30_000) })
    const json = await res.json().catch(() => null) as { results?: { users?: Record<string, { first_name?: string; last_name?: string; permissions?: Record<string, boolean> }> } } | null
    const user = json?.results?.users ? Object.values(json.results.users)[0] : undefined
    if (!res.ok || !user) return { ok: false, line: `Write access: unknown (QuickBooks Time answered HTTP ${res.status}).` }
    const p = user.permissions ?? {}
    const who = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'the token\'s user'
    const ok = !!p.admin
    return { ok, line: `Write access: ${ok ? 'yes' : 'NO'}, the token belongs to ${who} (admin: ${p.admin ? 'yes' : 'no'}, manage jobs: ${p.manage_jobcodes ? 'yes' : 'no'}).${ok ? '' : ' Custom fields need an admin: use an admin\'s token.'}` }
  } catch (e) {
    return { ok: false, line: `Write access: unknown (${e instanceof Error ? e.message : String(e)}).` }
  }
}

export interface RebuildResult { live: boolean; lines: string[] }

/**
 * The rebuild. A dry run unless `live` and TSHEETS_WRITE=on. A live run that
 * stops halfway can run again: what already carries a TSheets id is skipped.
 */
export async function runRebuild(c: Db, token: string, opts: { live: boolean; write?: Write }): Promise<RebuildResult> {
  const [j, f, o] = await Promise.all([
    c.from('tc_jobcodes').select('id, parent_id, name, level, billable, external_id, structure, kind, active, sort_order').limit(5000),
    c.from('tc_fields').select('id, external_id, name, active, structure'),
    c.from('tc_field_options').select('id, field_id, label, external_id, active').limit(10000),
  ])
  const failed = [j, f, o].find(r => r.error)?.error
  if (failed) throw new Error(`The portal's job codes could not be read: ${failed.message}`)
  const plan = planRebuild((j.data ?? []) as PortalJob[], (f.data ?? []) as PortalField[], (o.data ?? []) as PortalOption[])
  const lines = planText(plan)
  const live = opts.live && process.env.TSHEETS_WRITE === 'on'
  if (!live || plan.problems.length) return { live: false, lines: [live ? 'Stopped: fix the problems first.' : 'Dry run: nothing was sent to QuickBooks Time.', ...lines] }
  const write = opts.write ?? writer(token)
  const now = () => new Date().toISOString()

  // 1. The old fields, archived (6 active at most).
  await inBatches(write, 'PUT', '/customfields', plan.archiveFields, x => ({ id: x.external_id, active: false }))

  // 2. The 2026 jobs, parents first; each new id goes on the portal's row at once.
  const extOf = new Map((j.data ?? []).filter(r => r.external_id != null).map(r => [r.id, Number(r.external_id)]))
  for (const job of plan.createJobs) {
    const parent = job.parent_id != null ? extOf.get(job.parent_id) : 0
    if (parent === undefined) throw new Error(`"${job.name}" has no TSheets parent yet.`)
    const [id] = await inBatches(write, 'POST', '/jobcodes', [job], x => ({ name: x.name, parent_id: parent, type: 'regular', billable: x.billable, assigned_to_all: true, active: true }))
    extOf.set(job.id, id)
    const { error } = await c.from('tc_jobcodes').update({ external_id: id, edited_in_portal_at: now() }).eq('id', job.id)
    if (error) throw new Error(`"${job.name}" was created in QuickBooks Time (id ${id}) but its id was not saved: ${error.message}`)
  }

  // 3. The Activity field and its values.
  const field = plan.activityField!
  let fieldExt = field.external_id
  if (fieldExt == null) {
    ;[fieldExt] = await inBatches(write, 'POST', '/customfields', [field], x => ({ name: x.name, type: 'managed-list', applies_to: 'timesheet', required: true, active: true, show_to_all: true }))
    const { error } = await c.from('tc_fields').update({ external_id: fieldExt }).eq('id', field.id)
    if (error) throw new Error(`The Activity field was created (id ${fieldExt}) but its id was not saved: ${error.message}`)
  }
  const itemIds = await inBatches(write, 'POST', '/customfielditems', plan.createItems, x => ({ customfield_id: fieldExt, name: x.label, active: true }))
  for (const [k, item] of plan.createItems.entries()) {
    const { error } = await c.from('tc_field_options').update({ external_id: itemIds[k], edited_in_portal_at: now() }).eq('id', item.id)
    if (error) throw new Error(`"${item.label}" was created (id ${itemIds[k]}) but its id was not saved: ${error.message}`)
  }

  // 4. The old work jobs, archived last: nobody is left without a job to pick.
  await inBatches(write, 'PUT', '/jobcodes', plan.archiveJobs, x => ({ id: x.external_id, active: false }))
  return { live: true, lines: ['Done.', ...lines] }
}
