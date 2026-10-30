'use server'

/**
 * Company settings > North Time rollout (owner, 27 October 2026): the two
 * waves' start dates and moving a person to the other wave. Super Admins only
 * (cs-rollout-edit), for the person really signed in and never in a View
 * Stage preview (allowedTo). Checked here, whatever the form sent, and each
 * change goes to settings_change_log like the other Company settings.
 */

import { revalidatePath } from 'next/cache'
import { allowedTo, isSuperAdmin } from '@/lib/access/resolve'
import { getRealPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkDates, type Wave } from '@/lib/timeclock/waves'
import { loadWaveDates } from '@/lib/timeclock/waves-data'

type Done = { ok: true; toast: string } | { ok: false; error: string }
const no = (error: string): Done => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const ONLY = 'Only Super Admins change the North Time rollout.'
const refresh = () => { revalidatePath('/admin/settings'); revalidatePath('/clocky-hours') }

async function logChange(setting: string, action: string): Promise<void> {
  const me = await getRealPerson()
  const { error } = await createAdminClient().from('settings_change_log').insert({ setting, action, actor_person_id: me?.id ?? null, actor_name: me?.full_name ?? null, actor_email: null })
  if (error) console.error('[settings] the change was not logged:', error.message)
}

/** The two start dates, each a day or empty; wave 2 never before wave 1. */
export async function saveRolloutDates(input: { wave1: string; wave2: string }): Promise<Done> {
  if (!(await allowedTo('cs-rollout-edit'))) return no(ONLY)
  const checked = checkDates({ 1: input?.wave1, 2: input?.wave2 })
  if (!checked.ok) return no(checked.error)
  const c = createAdminClient()
  const me = await getRealPerson()
  let before
  try { before = await loadWaveDates(c) } catch (e) { console.error('[settings] rollout:', e instanceof Error ? e.message : e); return no(NOT_SAVED) }
  const now = new Date().toISOString()
  const { error } = await c.from('tc_rollout_waves').upsert([1, 2].map(w => ({
    wave: w, starts_on: checked.dates[w as Wave], updated_at: now, updated_by: me?.id ?? null,
  })), { onConflict: 'wave' })
  if (error) { console.error('[settings] rollout:', error.message); return no(NOT_SAVED) }
  for (const w of [1, 2] as const) {
    if (before[w] !== checked.dates[w]) await logChange(`north_time_wave_${w}`, checked.dates[w] ? `set to ${checked.dates[w]}` : 'cleared')
  }
  refresh()
  return { ok: true, toast: 'Saved. The clock and the import follow the new dates from now.' }
}

/** Move a person to a wave by hand, or back to the wave their level gives them (wave: null). */
export async function moveToWave(input: { personId: string; wave: Wave | null }): Promise<Done> {
  if (!(await allowedTo('cs-rollout-edit'))) return no(ONLY)
  const personId = String(input?.personId ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(personId)) return no('That person is not in the Directory.')
  const wave = input?.wave === 1 || input?.wave === 2 ? input.wave : input?.wave === null ? null : undefined
  if (wave === undefined) return no('Pick wave 1 or wave 2.')
  const c = createAdminClient()
  const { data: p, error: pErr } = await c.from('people').select('id, full_name').eq('id', personId).maybeSingle()
  if (pErr) { console.error('[settings] rollout:', pErr.message); return no(NOT_SAVED) }
  if (!p) return no('That person is not in the Directory.')
  const me = await getRealPerson()
  const { error } = wave === null
    ? await c.from('tc_rollout_people').delete().eq('person_id', personId)
    : await c.from('tc_rollout_people').upsert({ person_id: personId, wave, set_by: me?.id ?? null, set_at: new Date().toISOString() }, { onConflict: 'person_id' })
  if (error) { console.error('[settings] rollout:', error.message); return no(NOT_SAVED) }
  await logChange('north_time_wave_person', wave === null ? `${p.full_name}: back to the wave of their level` : `${p.full_name}: moved to wave ${wave}`)
  refresh()
  return { ok: true, toast: wave === null ? `${p.full_name} follows their level again.` : `${p.full_name} is in wave ${wave} now.` }
}

/**
 * North Time open or closed (owner, 29 October 2026, migration 132): only a
 * Super Admin, really signed in. While closed nobody records hours in North
 * Time and its scheduled jobs do nothing (north-time-lock.ts).
 */
/** The new Agenda with Google Calendar (migration 134): only a Super Admin opens or closes it. */
export async function setAgendaGoogleOpen(input: { open: boolean }): Promise<Done> {
  if (!(await isSuperAdmin())) return no('Only a Super Admin opens or closes the new Agenda.')
  if (typeof input?.open !== 'boolean') return no(NOT_SAVED)
  const open = input.open
  const { error } = await createAdminClient().from('app_settings').update({ agenda_google_open: open }).eq('singleton_id', 1)
  if (error) { console.error('[settings] agenda google open:', error.message); return no(NOT_SAVED) }
  await logChange('agenda_google_open', open ? 'opened' : 'closed')
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  revalidatePath('/agenda')
  return { ok: true, toast: open ? 'The new Agenda is open for everyone.' : 'The new Agenda is closed: everyone has the Agenda as it was.' }
}

export async function setNorthTimeOpen(input: { open: boolean }): Promise<Done> {
  if (!(await isSuperAdmin())) return no('Only a Super Admin opens or closes North Time.')
  if (typeof input?.open !== 'boolean') return no(NOT_SAVED)
  const open = input.open
  const { error } = await createAdminClient().from('app_settings').update({ north_time_open: open }).eq('singleton_id', 1)
  if (error) { console.error('[settings] north time open:', error.message); return no(NOT_SAVED) }
  await logChange('north_time_open', open ? 'opened' : 'closed')
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  revalidatePath('/clocky-hours')
  return { ok: true, toast: open ? 'North Time is open: people can record their hours.' : 'North Time is closed: nobody records hours in it.' }
}
