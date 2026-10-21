'use server'

/**
 * Company settings > Job catalogue (Clocky part 2, Job Catalogue.dc.html 11A,
 * 11B): Super Admins only (cs-jobs-edit). Every change marks the row as kept
 * by the portal (edited_in_portal_at), so QuickBooks Time's import no longer
 * overwrites it, and goes in the settings change log.
 *
 *   saveJob        name, folder, active, billable by default, default Company
 *                  and Project, "When to use"
 *   addFolder      a new folder at the end of the list
 *   addJob         a new job in the folder picked (or at the top level)
 *   reorderJobs    the order of a folder's jobs, or of the top level
 *   setOptionShown hide or show an option (never deleted)
 *   renameOption   the option and the old entries with it
 *   addOption      a new option at the end of a field
 */

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { getRealPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

type Done = { ok: true; toast: string; id?: number } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const now = () => new Date().toISOString()

async function guard(): Promise<Done | null> {
  return (await allowedTo('cs-jobs-edit')) ? null : no('Only Super Admins change the job catalogue.')
}
function refresh() {
  revalidatePath('/admin/settings')
  revalidatePath('/clocky-hours', 'layout')
}
async function log(action: string): Promise<void> {
  const me = await getRealPerson()
  const { error } = await createAdminClient().from('settings_change_log').insert({ setting: 'job_catalogue', action, actor_person_id: me?.id ?? null, actor_name: me?.full_name ?? null, actor_email: null })
  if (error) console.error('[catalogue] the change was not logged:', error.message)
}

export async function saveJob(input: { id: number; name: string; parentId: number | null; active: boolean; billable: boolean; company: string; project: string; use: string }): Promise<Done> {
  const g = await guard(); if (g) return g
  const c = createAdminClient()
  const name = String(input.name ?? '').trim()
  if (!name) return no('Give it a name.')
  if (name.length > 120) return no('The name is too long.')
  const use = String(input.use ?? '').trim()
  if (use.length > 400) return no('Keep "When to use" to one plain line.')
  const { data: row } = await c.from('tc_jobcodes').select('id, folder, kind, parent_id').eq('id', input.id).maybeSingle()
  if (!row || row.kind !== 'regular') return no('That job is not in the catalogue.')
  let parentId = row.parent_id
  if (!row.folder && input.parentId !== row.parent_id) {
    if (input.parentId != null) {
      const { data: p } = await c.from('tc_jobcodes').select('id, parent_id').eq('id', input.parentId).maybeSingle()
      if (!p || p.parent_id != null || p.id === row.id) return no('Pick one of the folders, or the top level.')
    }
    parentId = input.parentId
  }
  const { error } = await c.from('tc_jobcodes').update({
    name, parent_id: parentId, active: !!input.active, billable: !!input.billable,
    default_company: String(input.company ?? '').trim() || null, default_project: String(input.project ?? '').trim() || null,
    when_to_use: use || null, edited_in_portal_at: now(),
  }).eq('id', input.id)
  if (error) { console.error('[catalogue]', error.message); return no(NOT_SAVED) }
  await log(`Saved ${row.folder ? 'folder' : 'job'} "${name}"`)
  refresh()
  return { ok: true, toast: 'Saved. The clock panel shows the new line right away.' }
}

async function nextOrder(parentId: number | null): Promise<number> {
  const q = createAdminClient().from('tc_jobcodes').select('sort_order').eq('kind', 'regular').not('sort_order', 'is', null).order('sort_order', { ascending: false }).limit(1)
  const { data } = parentId == null ? await q.is('parent_id', null) : await q.eq('parent_id', parentId)
  return (data?.[0]?.sort_order ?? 0) + 1
}

export async function addFolder(): Promise<Done> {
  const g = await guard(); if (g) return g
  const { data, error } = await createAdminClient().from('tc_jobcodes').insert({
    name: 'New folder', kind: 'regular', folder: true, active: true, billable: false, sort_order: await nextOrder(null), edited_in_portal_at: now(),
  }).select('id').single()
  if (error) { console.error('[catalogue]', error.message); return no(NOT_SAVED) }
  await log('Added a folder')
  refresh()
  return { ok: true, toast: 'Folder added. Name it, then add its jobs.', id: data.id }
}

export async function addJob(input: { parentId: number | null }): Promise<Done> {
  const g = await guard(); if (g) return g
  const c = createAdminClient()
  let billable = false
  if (input.parentId != null) {
    const { data: p } = await c.from('tc_jobcodes').select('id, parent_id, billable').eq('id', input.parentId).maybeSingle()
    if (!p || p.parent_id != null) return no('Pick one of the folders, or the top level.')
    billable = p.billable
  }
  const { data, error } = await c.from('tc_jobcodes').insert({
    name: 'New job', kind: 'regular', parent_id: input.parentId, active: true, billable, sort_order: await nextOrder(input.parentId), edited_in_portal_at: now(),
  }).select('id').single()
  if (error) { console.error('[catalogue]', error.message); return no(NOT_SAVED) }
  await log('Added a job')
  refresh()
  return { ok: true, toast: 'Job added. Name it and say when to use it.', id: data.id }
}

/** The new order of one folder's jobs, or of the top level: every id, in order. */
export async function reorderJobs(input: { parentId: number | null; ids: number[] }): Promise<Done> {
  const g = await guard(); if (g) return g
  const c = createAdminClient()
  const ids = [...new Set((input.ids ?? []).map(Number))]
  const q = c.from('tc_jobcodes').select('id').in('id', ids)
  const { data } = input.parentId == null ? await q.is('parent_id', null) : await q.eq('parent_id', input.parentId)
  if ((data ?? []).length !== ids.length) return no('Only jobs in the same folder can be put in order.')
  for (const [i, id] of ids.entries()) {
    const { error } = await c.from('tc_jobcodes').update({ sort_order: i + 1, edited_in_portal_at: now() }).eq('id', id)
    if (error) { console.error('[catalogue]', error.message); return no(NOT_SAVED) }
  }
  await log('Changed the order of the jobs')
  refresh()
  return { ok: true, toast: 'Order saved. The clock panel lists jobs in this order.' }
}

export async function setOptionShown(input: { optionId: number; shown: boolean }): Promise<Done> {
  const g = await guard(); if (g) return g
  const { data, error } = await createAdminClient().from('tc_field_options').update({ active: !!input.shown, edited_in_portal_at: now() }).eq('id', input.optionId).select('label').maybeSingle()
  if (error || !data) { console.error('[catalogue]', error?.message); return no(NOT_SAVED) }
  await log(`${input.shown ? 'Showed' : 'Hid'} the option "${data.label}"`)
  refresh()
  return { ok: true, toast: input.shown ? `"${data.label}" shows in the pickers again.` : `"${data.label}" is hidden. Old entries keep it.` }
}

export async function renameOption(input: { optionId: number; label: string }): Promise<Done> {
  const g = await guard(); if (g) return g
  const label = String(input.label ?? '').trim()
  if (!label) return no('Write the new name.')
  if (label.length > 120) return no('The name is too long.')
  const { error } = await createAdminClient().rpc('tc_rename_field_option', { p_option_id: input.optionId, p_label: label })
  if (error) return no(/label taken/.test(error.message) ? `There is already an option called "${label}".` : NOT_SAVED)
  await log(`Renamed an option to "${label}"`)
  refresh()
  return { ok: true, toast: `Renamed. Old entries now read "${label}".` }
}

export async function addOption(input: { fieldId: number; label: string }): Promise<Done> {
  const g = await guard(); if (g) return g
  const c = createAdminClient()
  const label = String(input.label ?? '').trim()
  if (!label) return no('Write the new option.')
  if (label.length > 120) return no('The name is too long.')
  const { data: existing } = await c.from('tc_field_options').select('label, position').eq('field_id', input.fieldId).limit(5000)
  if ((existing ?? []).some(o => o.label.toLowerCase() === label.toLowerCase())) return no(`There is already an option called "${label}".`)
  const position = Math.max(-1, ...(existing ?? []).map(o => o.position)) + 1
  const { error } = await c.from('tc_field_options').insert({ field_id: input.fieldId, label, position, active: true, edited_in_portal_at: now() })
  if (error) { console.error('[catalogue]', error.message); return no(NOT_SAVED) }
  await log(`Added the option "${label}"`)
  refresh()
  return { ok: true, toast: `Added "${label}". It shows in the pickers now.` }
}
