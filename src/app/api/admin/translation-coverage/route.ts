/**
 * GET /api/admin/translation-coverage?since=2026-01-01, a read-only check that
 * the translation table still covers every job, field value and i7 code people
 * pick in TSheets. Plain text, for Admins (the job catalogue's reader). It
 * writes nothing and calls no one: it reads the portal's own copy of TSheets.
 */

import { allowedTo } from '@/lib/access/resolve'
import { coverage, coverageText } from '@/lib/timeclock/translation-coverage'
import { loadUsed } from '@/lib/timeclock/translation-coverage-data'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await allowedTo('cs-jobs'))) return new Response('Admins only.', { status: 403 })
  const asked = new URL(request.url).searchParams.get('since') ?? ''
  const since = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : '2026-01-01'
  try {
    const text = coverageText(coverage(await loadUsed(since)), since)
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[translation-coverage]', e instanceof Error ? e.message : e)
    return new Response('The check could not read the entries. Try again in a moment.', { status: 500 })
  }
}
