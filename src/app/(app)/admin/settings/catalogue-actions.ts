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
 *
 * The 2026 structure (Client › Division › Project) lives in the same table as
 * structure 2. From the switch date the TSheets tree is frozen: a job or an
 * option can be switched off, never renamed or moved, because old entries
 * show their job's and option's current name (owner, 26 October 2026).
 */

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { getRealPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { structureOn } from '@/lib/timeclock/entry-rules'
import { localDate } from '@/lib/timeclock/format'

type Done = { ok: true; toast: string; id?: number } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const now = () => new Date().toISOString()

const FROZEN = 'The TSheets jobs are frozen since the switch date: you can switch one off, but not rename or move it, so the history keeps its names.'

/** The TSheets tree is frozen from the switch date (tc_settings.structure_switch_date). */
async function frozen(): Promise<boolean> {
  const { data, error } = await createAdminClient().from('tc_settings').select('structure_switch_date').eq('singleton_id', 1).maybeSingle()
  // Unread is not "not frozen": a rename would rewrite how the history reads.
  if (error) throw new Error(error.message)
  return structureOn(localDate(new Date(), 'America/New_York'), data?.structure_switch_date ?? null) === 2
}

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
  const { data: row } = await c.from('tc_jobcodes').select('id, folder, kind, parent_id, structure, name, active').eq('id', input.id).maybeSingle()
  if (!row || row.kind !== 'regular') return no('That job is not in the catalogue.')
  const v2 = row.structure === 2
  if (!v2) {
    let isFrozen: boolean
    try { isFrozen = await frozen() } catch (e) { console.error('[catalogue]', e); return no(NOT_SAVED) }
    if (isFrozen) {
      if (name !== row.name || (!row.folder && input.parentId !== row.parent_id)) return no(FROZEN)
      if (!!input.active === row.active) return { ok: true, toast: 'Nothing to change.' }
      const { error } = await c.from('tc_jobcodes').update({ active: !!input.active, edited_in_portal_at: now() }).eq('id', input.id)
      if (error) { console.error('[catalogue]', error.message); return no(NOT_SAVED) }
      await log(`${input.active ? 'Switched on' : 'Switched off'} "${name}"`)
      refresh()
      return { ok: true, toast: input.active ? `"${name}" can be picked again.` : `"${name}" is switched off. Old entries keep it.` }
    }
  }
  let parentId = row.parent_id
  if (!row.folder && input.parentId !== row.parent_id) {
    if (input.parentId != null) {
      const { data: p } = await c.from('tc_jobcodes').select('id, parent_id, folder, structure').eq('id', input.parentId).maybeSingle()
      // A TSheets job goes in a top folder; a 2026 project in a division (or a client with no divisions).
      if (!p || p.id === row.id || (v2 ? p.structure !== 2 || !p.folder : p.parent_id != null || p.structure === 2)) {
        return no(v2 ? 'Pick one of the divisions or clients.' : 'Pick one of the folders, or the top level.')
      }
    } else if (v2) return no('A project goes in a division or a client.')
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

/**
 * A new folder. In the 2026 structure: a client at the top, or a division in
 * the client given. A new TSheets folder only before the switch date.
 */
export async function addFolder(input: { structure?: 1 | 2; parentId?: number | null } = {}): Promise<Done> {
  const g = await guard(); if (g) return g
  const c = createAdminClient()
  if (input.structure === 2) {
    let billable = true
    if (input.parentId != null) {
      const { data: p } = await c.from('tc_jobcodes').select('id, structure, level, billable').eq('id', input.parentId).maybeSingle()
      if (!p || p.structure !== 2 || p.level !== 'client') return no('A division goes in a client.')
      billable = p.billable
    }
    const level = input.parentId != null ? 'division' : 'client'
    const { data, error } = await c.from('tc_jobcodes').insert({
      name: level === 'client' ? 'New client' : 'New division', kind: 'regular', folder: true, active: true, billable, structure: 2, level,
      parent_id: input.parentId ?? null, sort_order: await nextOrder(input.parentId ?? null), edited_in_portal_at: now(),
    }).select('id').single()
    if (error) { console.error('[catalogue]', error.message); return no(/tc_jobcodes_v2_place/.test(error.message) ? `There is already a "${level === 'client' ? 'New client' : 'New division'}" here: rename it first.` : NOT_SAVED) }
    await log(`Added a ${level} to the 2026 structure`)
    refresh()
    return { ok: true, toast: level === 'client' ? 'Client added. Name it, then add its divisions or projects.' : 'Division added. Name it, then add its projects.', id: data.id }
  }
  try { if (await frozen()) return no(FROZEN) } catch (e) { console.error('[catalogue]', e); return no(NOT_SAVED) }
  const { data, error } = await c.from('tc_jobcodes').insert({
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
  let v2 = false
  if (input.parentId != null) {
    const { data: p } = await c.from('tc_jobcodes').select('id, parent_id, billable, structure, folder').eq('id', input.parentId).maybeSingle()
    v2 = p?.structure === 2
    if (!p || (v2 ? !p.folder : p.parent_id != null)) return no('Pick one of the folders, or the top level.')
    billable = p.billable
  }
  if (!v2) { try { if (await frozen()) return no(FROZEN) } catch (e) { console.error('[catalogue]', e); return no(NOT_SAVED) } }
  const { data, error } = await c.from('tc_jobcodes').insert({
    name: v2 ? 'New project' : 'New job', kind: 'regular', parent_id: input.parentId, active: true, billable, sort_order: await nextOrder(input.parentId), edited_in_portal_at: now(),
    ...(v2 ? { structure: 2, level: 'project' } : {}),
  }).select('id').single()
  if (error) { console.error('[catalogue]', error.message); return no(/tc_jobcodes_v2_place/.test(error.message) ? 'There is already a "New project" here: rename it first.' : NOT_SAVED) }
  await log(v2 ? 'Added a project to the 2026 structure' : 'Added a job')
  refresh()
  return { ok: true, toast: v2 ? 'Project added. Name it and say when to use it.' : 'Job added. Name it and say when to use it.', id: data.id }
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
  // Renaming rewrites the old entries' word: never for a TSheets field once it is frozen.
  const { data: opt } = await createAdminClient().from('tc_field_options').select('field_id, tc_fields(structure)').eq('id', input.optionId).maybeSingle()
  const structure = (opt?.tc_fields as { structure?: number } | null)?.structure ?? 1
  if (structure === 1) { try { if (await frozen()) return no(FROZEN.replace('The TSheets jobs are', 'The TSheets options are').replace('one off', 'one off (hide it)')) } catch (e) { console.error('[catalogue]', e); return no(NOT_SAVED) } }
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
