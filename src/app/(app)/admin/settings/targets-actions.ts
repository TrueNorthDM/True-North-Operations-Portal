'use server'

/**
 * Server Actions for Settings > Publishing targets: the weekly targets and the
 * publishers list.
 *
 * Every write needs Publishing targets (cs-targets) on Admin > Access levels,
 * checked for the person really signed in (allowedTo: a verified session, and
 * never during a View Stage preview), and then goes through the privileged
 * client, so the tick decides and not the database role.
 *
 * Since 10 October 2026 (audit, module 10):
 *   - a target is a whole number, for a language the board's site publishes,
 *     on a publishing board: free text made a misspelt language read 0 forever;
 *   - a change applies from the current week (New York) and past weeks keep the
 *     target they had (publishing_set_target, migration 106);
 *   - a removal is logged under the person who removed it
 *     (publishing_remove_target), not the target's last editor;
 *   - the publishers list lives here instead of in the code.
 *
 * Since 15 October 2026 a board's rhythm is set here too: every week, or every
 * two weeks from the Monday of the week it is changed (publishing-cycles.ts).
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowedTo } from '@/lib/access/resolve'
import { revalidatePath } from 'next/cache'
import { ROUTES } from '@/lib/nav/routes'
import { BOARDS, PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { weekStartDay } from '@/lib/boards/publishing-rules'
import { boardLanguages } from '@/lib/boards/targets-data'

/** Where targets are edited, and where they are read. */
const refresh = () => { revalidatePath('/admin/settings'); revalidatePath(ROUTES.publishing); revalidatePath('/') }

type Result = { ok: boolean; error?: string }

const NOT_SAVED = 'Not saved. Try again in a moment.'

/** The detail goes to the server log; the person gets a sentence. */
function notSaved(error: { message: string }): Result {
  console.error('[publishing targets]', error.message)
  return { ok: false, error: NOT_SAVED }
}

async function actor(): Promise<{ ok: false; error: string } | { ok: true; email: string }> {
  if (!(await allowedTo('cs-targets'))) return { ok: false, error: 'Publishing targets is not open to your access.' }
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  return { ok: true, email: user.email ?? 'unknown' }
}

function wholeTarget(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null
}

const BAD_TARGET = 'A target is a whole number of pages a week, 0 or more.'

/** A board's rhythm as the change history records it. */
interface RhythmLog { board_short: string; target_cycle_weeks: 1 | 2; target_cycle_start: string | null }

export async function saveTargetValue(input: { id: string; targetValue: number }): Promise<Result> {
  const who = await actor()
  if (!who.ok) return who
  const value = wholeTarget(input.targetValue)
  if (value === null) return { ok: false, error: BAD_TARGET }

  const db = createAdminClient()
  const { data: row, error } = await db.from('publishing_targets')
    .select('board_id, board_short, language').eq('id', input.id).maybeSingle()
  if (error) return notSaved(error)
  if (!row) return { ok: false, error: 'That target is gone. Reload the page.' }
  const t = row as { board_id: string; board_short: string | null; language: string }

  const { error: setErr } = await db.rpc('publishing_set_target', {
    p_board: t.board_id, p_short: t.board_short ?? BOARDS[t.board_id]?.short ?? '', p_language: t.language,
    p_value: value, p_actor: who.email, p_week: weekStartDay(new Date()),
  })
  if (setErr) return notSaved(setErr)
  refresh()
  return { ok: true }
}

export async function addTarget(input: { boardId: string; language: string; targetValue: number }): Promise<Result> {
  const who = await actor()
  if (!who.ok) return who
  if (!PUBLISHING_BOARD_IDS.includes(input.boardId)) return { ok: false, error: 'That is not a publishing board.' }
  const value = wholeTarget(input.targetValue)
  if (value === null) return { ok: false, error: BAD_TARGET }

  // A language the board's site publishes, spelt as the site spells it.
  let languages: string[]
  try {
    languages = (await boardLanguages()).get(input.boardId) ?? []
  } catch (e) {
    return notSaved(e as Error)
  }
  const language = languages.find(l => l.toLowerCase() === String(input.language ?? '').trim().toLowerCase())
  if (!language) return { ok: false, error: 'Choose one of the languages this site publishes.' }

  const db = createAdminClient()
  const { data: existing, error } = await db.from('publishing_targets').select('id')
    .eq('board_id', input.boardId).eq('language', language).eq('period_type', 'weekly').maybeSingle()
  if (error) return notSaved(error)
  if (existing) return { ok: false, error: `A weekly target for ${language} already exists on this board.` }

  const { error: setErr } = await db.rpc('publishing_set_target', {
    p_board: input.boardId, p_short: BOARDS[input.boardId].short, p_language: language,
    p_value: value, p_actor: who.email, p_week: weekStartDay(new Date()),
  })
  if (setErr) return notSaved(setErr)
  refresh()
  return { ok: true }
}

export async function deleteTarget(input: { id: string }): Promise<Result> {
  const who = await actor()
  if (!who.ok) return who
  const { data, error } = await createAdminClient().rpc('publishing_remove_target', {
    p_id: input.id, p_actor: who.email, p_week: weekStartDay(new Date()),
  })
  if (error) return notSaved(error)
  if (data !== true) return { ok: false, error: 'That target is gone. Reload the page.' }
  refresh()
  return { ok: true }
}

/** Monday shows names this way: one to eighty letters, spaces, dots, hyphens, apostrophes. */
const NAME = /^[\p{L}][\p{L}\p{M} .'-]{0,79}$/u

export async function addPublisher(input: { name: string }): Promise<Result> {
  const who = await actor()
  if (!who.ok) return who
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  if (!NAME.test(name)) return { ok: false, error: 'Write the full name as Monday shows it.' }
  const { error } = await createAdminClient().from('publishing_publishers').insert({ name, added_by: who.email })
  if (error?.code === '23505') return { ok: false, error: `${name} is already a publisher.` }
  if (error) return notSaved(error)
  refresh()
  return { ok: true }
}

export async function removePublisher(input: { name: string }): Promise<Result> {
  const who = await actor()
  if (!who.ok) return who
  const { data, error } = await createAdminClient().from('publishing_publishers')
    .delete().eq('name', String(input.name ?? '')).select('name')
  if (error) return notSaved(error)
  if (!data?.length) return { ok: false, error: 'That publisher is gone. Reload the page.' }
  console.log(`[publishing targets] ${who.email} removed publisher ${input.name}`)
  refresh()
  return { ok: true }
}

/**
 * Every week, or every two weeks. Two weeks start on the Monday (New York) of
 * the week the change is made; back to every week clears the start. The
 * targets keep their numbers, which from then on mean pages per cycle (or per
 * week again).
 *
 * The rhythm lives on the board's sites row, which has no change trigger of
 * its own, so the change is written to the same change history the targets
 * use (audit_log) by hand, under the person who made it, and to the log.
 */
export async function saveTargetRhythm(input: { boardId: string; weeks: number }): Promise<Result> {
  const who = await actor()
  if (!who.ok) return who
  if (!PUBLISHING_BOARD_IDS.includes(input.boardId)) return { ok: false, error: 'That is not a publishing board.' }
  if (input.weeks !== 1 && input.weeks !== 2) return { ok: false, error: 'Choose every week or every 2 weeks.' }
  const weeks: 1 | 2 = input.weeks

  const db = createAdminClient()
  const { data: site, error } = await db.from('sites')
    .select('id, target_cycle_weeks, target_cycle_start').eq('monday_board_id', input.boardId).maybeSingle()
  if (error) return notSaved(error)
  if (!site) return { ok: false, error: 'This board has no site in Settings, so its rhythm cannot be kept.' }
  const s = site as { id: string; target_cycle_weeks: number | null; target_cycle_start: string | null }
  const was: 1 | 2 = s.target_cycle_weeks === 2 && s.target_cycle_start ? 2 : 1
  if (was === weeks) return { ok: true }

  const short = BOARDS[input.boardId].short
  const start = weeks === 2 ? weekStartDay(new Date()) : null
  const { error: setErr } = await db.from('sites')
    .update({ target_cycle_weeks: weeks, target_cycle_start: start }).eq('id', s.id)
  if (setErr) return notSaved(setErr)

  const before: RhythmLog = { board_short: short, target_cycle_weeks: was, target_cycle_start: s.target_cycle_start }
  const after: RhythmLog = { board_short: short, target_cycle_weeks: weeks, target_cycle_start: start }
  console.log(`[publishing targets] ${who.email} set ${short} to every ${weeks === 2 ? `2 weeks from ${start}` : 'week'}`)
  const { error: logErr } = await db.from('audit_log').insert({
    user_email: who.email, action: 'update', entity_id: s.id, before: { ...before }, after: { ...after },
  })
  // The rhythm is saved; a history row that did not go in is the log's to say.
  if (logErr) console.error('[publishing targets] the rhythm change was not added to the change history:', logErr.message)
  refresh()
  return { ok: true }
}
