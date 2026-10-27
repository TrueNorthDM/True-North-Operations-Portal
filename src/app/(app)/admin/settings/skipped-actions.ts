'use server'

/**
 * Company settings > North Time rollout > Clocked in TSheets after switching:
 * the decision on each TSheets entry the import set aside (owner, 27 October
 * 2026). "Count it" writes the Time entry; "Discard it" writes nothing. Either
 * way who, when and the choice are kept on the set-aside row.
 *
 * Super Admins and Admins (cs-rollout-decide), for the person really signed in
 * and never in a View Stage preview (allowedTo). Everything is checked here,
 * whatever the page sent, and each decision goes to settings_change_log like
 * the other Company settings. Deciding twice does nothing and says so.
 *
 * The rules are in lib/timeclock/skipped-decisions.ts (pure, tested); the row
 * a counted entry becomes is the import's own (toEntry), opened.
 */

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { getRealPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Db } from '@/lib/supabase/types'
import type { Json } from '@/lib/types/database.generated'
import { loadMaps, toEntry } from '@/lib/timeclock/import'
import { audit, loadSubmissions, lockOn } from '@/lib/timeclock/clocky-store'
import { limitRefusal } from '@/lib/timeclock/allowance-limit'
import { lockedMessage } from '@/lib/timeclock/periods'
import { dateLabel } from '@/lib/timeclock/format'
import type { SourceTimesheet } from '@/lib/timeclock/source'
import {
  allowanceSeconds, checkRequest, countedRow, DECISION_OF, decidedText, IN_ENTRIES, judge, logLine, summary,
  type DecideInput, type Facts, type RowResult,
} from '@/lib/timeclock/skipped-decisions'

export type Decided =
  | { ok: true; toast: string; results: RowResult[] }
  | { ok: false; error: string }

const no = (error: string): Decided => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const ONLY = 'Only Super Admins and Admins decide these entries.'

type Row = {
  external_id: number; person_id: string; entry_date: string; raw: unknown; kind: string | null; ended_at: string | null
  deleted_in_tsheets_at: string | null; decided_at: string | null; decided_by: string | null; decision: string | null
}
type Me = { id: string; full_name: string }

/** Count or discard the entries with these TSheets ids: one entry or several selected, the same rules for each. */
export async function decideSkipped(input: DecideInput): Promise<Decided> {
  if (!(await allowedTo('cs-rollout-decide'))) return no(ONLY)
  const req = checkRequest(input)
  if (!req.ok) return no(req.error)
  const me = await getRealPerson()
  if (!me) return no('Your login is not linked to anyone in the Directory.')
  try {
    return await decide(createAdminClient(), req, { id: me.id, full_name: me.full_name })
  } catch (e) {
    console.error('[settings] tsheets decision:', e instanceof Error ? e.message : e)
    return no(NOT_SAVED)
  }
}

async function decide(c: Db, req: Extract<ReturnType<typeof checkRequest>, { ok: true }>, me: Me): Promise<Decided> {
  const { data, error } = await c.from('tc_import_skipped')
    .select('external_id, person_id, entry_date, raw, kind, ended_at, deleted_in_tsheets_at, decided_at, decided_by, decision')
    .in('external_id', req.ids)
  if (error) throw new Error(`tc_import_skipped read: ${error.message}`)
  const rows = new Map(((data ?? []) as Row[]).map(r => [r.external_id, r]))
  const all = [...rows.values()]
  const names = await nameMap(c, [...new Set(all.flatMap(r => [r.person_id, r.decided_by].filter((x): x is string => !!x)))])

  const counting = req.choice === 'count'
  const open = all.filter(r => !r.decided_at)
  // What counting needs, read once: the import's maps, the kinds of the jobs involved, and the people's sent periods.
  const maps = counting && open.length ? await loadMaps(c) : null
  const kinds = maps ? await kindsOf(c, open.map(r => maps.jobcodeByExternal.get((r.raw as SourceTimesheet)?.jobcode_id)).filter((x): x is number => x != null)) : new Map<number, string>()
  const subs = maps ? await loadSubmissions(c, [...new Set(open.map(r => r.person_id))]) : new Map()

  const results: RowResult[] = []
  let changed = false
  for (const id of req.ids) {
    const row = rows.get(id)
    const put = (outcome: RowResult['outcome'], text: string) => results.push({ id, outcome, text })
    const who = row ? names.get(row.person_id) ?? 'Someone' : 'Someone'
    const now = new Date()
    const at = now.toISOString()

    const facts: Facts = {
      choice: req.choice, found: !!row,
      decidedLine: row?.decided_at ? decidedText(row.decision, row.decided_by ? names.get(row.decided_by) ?? null : null, dateLabel(row.decided_at.slice(0, 10))) : null,
      deletedInTsheets: !!row?.deleted_in_tsheets_at,
      running: !!row && row.kind === 'clock' && row.ended_at === null,
      unmatched: false, inEntries: false, lockedText: null, overText: null,
      reason: req.reason, pastAllowance: req.pastAllowance,
    }
    // The import's own row for it, by its own mapping.
    const entry = row && maps && !row.decided_at ? toEntry(row.raw as SourceTimesheet, maps, kinds) : null
    if (row && maps && !row.decided_at && !facts.deletedInTsheets && !facts.running) {
      facts.unmatched = !entry || entry.person_id !== row.person_id
      if (entry && !facts.unmatched) {
        // The same Time entry may be there already: imported before the date was set, or counted by an earlier click.
        const there = await c.from('tc_entries').select('id').eq('external_id', id).limit(1)
        if (there.error) throw new Error(`tc_entries read: ${there.error.message}`)
        facts.inEntries = (there.data ?? []).length > 0
        const lock = lockOn([entry.entry_date], subs.get(row.person_id) ?? [])
        facts.lockedText = lock ? `For ${who}, ${lockedMessage(lock)}` : null
        if (!facts.inEntries && !facts.lockedText) {
          facts.overText = await limitRefusal(row.person_id, { add: [{ day: entry.entry_date, seconds: allowanceSeconds(entry) }] }, now, who)
        }
      }
    }

    const v = judge(facts)
    if (v.kind !== 'ok') { put(v.kind, v.text); continue }

    // Claimed first, so a second click, or another person's at the same time, finds it decided:
    // the update matches an undecided row only.
    const claim = await c.from('tc_import_skipped')
      .update({ decided_at: at, decided_by: me.id, decision: DECISION_OF[req.choice], decision_reason: req.reason })
      .eq('external_id', id).is('decided_at', null).select('external_id')
    if (claim.error) throw new Error(`tc_import_skipped claim: ${claim.error.message}`)
    if (!(claim.data ?? []).length) { put('already', 'Already decided. Nothing changed.'); continue }

    if (counting) {
      const release = async () => {
        const { error: e } = await c.from('tc_import_skipped').update({ decided_at: null, decided_by: null, decision: null, decision_reason: null, counted_entry_id: null }).eq('external_id', id)
        if (e) console.error('[settings] tsheets decision not released:', e.message)
      }
      let ins
      try {
        ins = await c.from('tc_entries').insert(countedRow(entry!, at)).select('id').single()
      } catch (e) {
        await release()
        throw e
      }
      if (ins.error) {
        await release()
        // Written by someone else between the check and now: the unique TSheets id says so.
        if (ins.error.code === '23505') { put('refused', IN_ENTRIES); continue }
        throw new Error(`tc_entries insert: ${ins.error.message}`)
      }
      const entryId = (ins.data as { id: number }).id
      const link = await c.from('tc_import_skipped').update({ counted_entry_id: entryId }).eq('external_id', id)
      if (link.error) console.error('[settings] counted entry not linked:', link.error.message)
      await audit(c, [{
        entryId, action: 'imported', by: me.id,
        after: { source: 'tsheets', tsheets_id: id, date: entry!.entry_date, seconds: entry!.duration_seconds, past_allowance: !!facts.overText } as Json,
        reason: req.reason ?? 'Counted from TSheets after the North Time start date',
      }])
    }
    await logChange(c, logLine(who, dateLabel(row!.entry_date), id, req.choice, req.reason), me)
    changed = true
    put('done', counting ? 'Counted.' : 'Discarded.')
  }

  if (changed) {
    revalidatePath('/admin/settings/tsheets-after-switch')
    revalidatePath('/admin/settings')
    if (counting) revalidatePath('/clocky-hours')
  }
  return { ok: true, toast: summary(req.choice, results), results }
}

async function logChange(c: Db, action: string, me: Me): Promise<void> {
  const { error } = await c.from('settings_change_log').insert({ setting: 'north_time_tsheets_entry', action, actor_person_id: me.id, actor_name: me.full_name, actor_email: null })
  if (error) console.error('[settings] the decision was not logged:', error.message)
}

/** Job id -> kind for these jobs (toEntry reads it to tell time off from work). */
async function kindsOf(c: Db, ids: readonly number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map()
  const { data, error } = await c.from('tc_jobcodes').select('id, kind').in('id', unique)
  if (error) throw new Error(`tc_jobcodes read: ${error.message}`)
  return new Map(((data ?? []) as { id: number; kind: string }[]).map(r => [r.id, r.kind]))
}

async function nameMap(c: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { data, error } = await c.from('people').select('id, full_name').in('id', ids as string[])
  if (error) throw new Error(`people read: ${error.message}`)
  return new Map(((data ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
}
