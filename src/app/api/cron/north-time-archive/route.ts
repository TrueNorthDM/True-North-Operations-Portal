/**
 * GET /api/cron/north-time-archive, archiving each person's TSheets account on
 * their North Time start date (owner, 27 October 2026).
 *
 * Every TSheets account linked to the person (tc_user_links) is archived once
 * the person's own calendar day reaches their start date (their wave, Company
 * settings > North Time rollout), and recorded in tc_tsheets_archives so it is
 * archived once. A day missed is caught up the next run.
 *
 * It writes to TSheets only with TSHEETS_ARCHIVE_USERS=on, and on the staging
 * copy (which reads the same TSheets account) only with
 * TSHEETS_ARCHIVE_ON_STAGING=on as well. Otherwise, the default, it is a dry
 * run: it logs and answers what it would archive, and changes nothing.
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { CLOSED_SKIP, northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_STAGING } from '@/lib/environment'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { localDate } from '@/lib/timeclock/format'
import { archiveEnabled, dueForArchive } from '@/lib/timeclock/waves'
import { loadStartDates } from '@/lib/timeclock/waves-data'
import { archiveTsheetsUser } from '@/lib/tsheets/archive'
import { missingTable } from '@/lib/supabase/errors'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // The crontab's bearer secret, compared in constant time (lib/auth/cron-auth.ts).
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // North Time closed (migration 132): its scheduled jobs do nothing.
  if (!(await northTimeOpen())) return NextResponse.json(CLOSED_SKIP)
  const live = archiveEnabled(process.env.TSHEETS_ARCHIVE_USERS, IS_STAGING, process.env.TSHEETS_ARCHIVE_ON_STAGING)
  const c = createAdminClient()
  const now = new Date()

  try {
    const starts = await loadStartDates(c)
    if (!starts.size) return NextResponse.json({ skipped: 'No North Time start date is set.' })

    const ids = [...starts.keys()]
    const [links, done, dir] = await Promise.all([
      c.from('tc_user_links').select('tsheets_user_id, person_id').in('person_id', ids),
      c.from('tc_tsheets_archives').select('tsheets_user_id').not('archived_at', 'is', null).limit(5000),
      loadDirectory(),
    ])
    if (links.error) throw new Error(`TSheets accounts could not be read: ${links.error.message}`)
    if (done.error && !missingTable(done.error)) throw new Error(`The archived accounts could not be read: ${done.error.message}`)
    const archived = new Set(((done.data ?? []) as { tsheets_user_id: number }[]).map(r => Number(r.tsheets_user_id)))

    const due = dueForArchive(((links.data ?? []) as { tsheets_user_id: number; person_id: string }[]).map(l => ({
      personId: l.person_id,
      tsheetsUserId: Number(l.tsheets_user_id),
      startsOn: starts.get(l.person_id) ?? null,
      today: localDate(now, dir.zoneOf(l.person_id)),
      name: dir.nameOf(l.person_id),
    })), archived)

    if (!live) {
      for (const d of due) console.log(`[north-time archive] dry run: would archive TSheets user ${d.tsheetsUserId} (${d.name}), on North Time since ${d.startsOn}`)
      return NextResponse.json({ dryRun: true, wouldArchive: due.map(d => ({ tsheetsUserId: d.tsheetsUserId, name: d.name, startsOn: d.startsOn })) })
    }
    if (!due.length) return NextResponse.json({ archived: [] })

    const { data: s } = await c.from('app_settings').select('tsheets_api_token').eq('singleton_id', 1).maybeSingle()
    const token = (s as { tsheets_api_token?: string | null } | null)?.tsheets_api_token
    if (!token) return NextResponse.json({ skipped: 'No TSheets token configured.' })

    const result: { tsheetsUserId: number; name: string; ok: boolean; error?: string }[] = []
    for (const d of due) {
      let error: string | null = null
      try { await archiveTsheetsUser(token, d.tsheetsUserId) } catch (e) { error = e instanceof Error ? e.message : String(e) }
      const at = new Date().toISOString()
      const { error: wErr } = await c.from('tc_tsheets_archives').upsert({
        tsheets_user_id: d.tsheetsUserId, person_id: d.personId, starts_on: d.startsOn!, archived_at: error ? null : at, last_error: error, tried_at: at,
      }, { onConflict: 'tsheets_user_id' })
      if (wErr) console.error(`[north-time archive] TSheets user ${d.tsheetsUserId} was not recorded:`, wErr.message)
      if (error) console.error(`[north-time archive] TSheets user ${d.tsheetsUserId} (${d.name}) not archived:`, error)
      else console.log(`[north-time archive] archived TSheets user ${d.tsheetsUserId} (${d.name}), on North Time since ${d.startsOn}`)
      result.push({ tsheetsUserId: d.tsheetsUserId, name: d.name, ok: !error, ...(error ? { error } : {}) })
    }
    return NextResponse.json({ archived: result }, { status: result.some(r => !r.ok) ? 500 : 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[north-time archive]', message)
    return NextResponse.json({ state: 'failed', error: message }, { status: 500 })
  }
}
