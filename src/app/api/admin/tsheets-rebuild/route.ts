/**
 * The TSheets rebuild on the switch date (src/lib/timeclock/tsheets-rebuild.ts).
 *
 * GET  a dry run: what the rebuild would do, and whether the TSheets token may
 *      write. Writes nothing. For a Super Admin, or the server's own secret.
 * POST the live run, only with the server's own secret (Claude runs it by hand
 *      on the server), only on production, and only while TSHEETS_WRITE=on.
 *      Safe to run again: what already carries a TSheets id is skipped.
 *
 * Plain text, so the answer reads the same in a browser and in a terminal.
 */

import { isSuperAdmin } from '@/lib/access/resolve'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { IS_STAGING } from '@/lib/environment'
import { createAdminClient } from '@/lib/supabase/admin'
import { runRebuild, writeAccess } from '@/lib/timeclock/tsheets-rebuild'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

async function tokenOf(c: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data } = await c.from('app_settings').select('tsheets_api_token').eq('singleton_id', 1).maybeSingle()
  return (data as { tsheets_api_token?: string | null } | null)?.tsheets_api_token ?? null
}

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization')) && !(await isSuperAdmin())) return text('Super Admins only.', 403)
  const c = createAdminClient()
  try {
    const token = await tokenOf(c)
    if (!token) return text('No TSheets token configured in Settings.', 409)
    const [access, plan] = await Promise.all([writeAccess(token), runRebuild(c, token, { live: false })])
    return text([...plan.lines, access.line, IS_STAGING ? 'Staging: the live run is refused here.' : ''].filter(Boolean).join('\n'))
  } catch (e) {
    console.error('[tsheets-rebuild] dry run', e instanceof Error ? e.message : e)
    return text('The dry run could not finish. Try again in a moment.', 500)
  }
}

export async function POST(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) return text('Only from the server.', 403)
  if (IS_STAGING) return text('Refused on staging: it would change the real TSheets account.', 409)
  if (process.env.TSHEETS_WRITE !== 'on') return text('TSHEETS_WRITE is not on: nothing was sent.', 409)
  const c = createAdminClient()
  try {
    const token = await tokenOf(c)
    if (!token) return text('No TSheets token configured in Settings.', 409)
    const access = await writeAccess(token)
    if (!access.ok) return text(`Stopped before writing. ${access.line}`, 409)
    const result = await runRebuild(c, token, { live: true })
    console.log('[tsheets-rebuild] live run', result.lines.join(' | '))
    return text(result.lines.join('\n'), result.live ? 200 : 409)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[tsheets-rebuild] live run', msg)
    return text(`The rebuild stopped: ${msg}\nRun the dry run to see what is left; running again skips what was done.`, 500)
  }
}
