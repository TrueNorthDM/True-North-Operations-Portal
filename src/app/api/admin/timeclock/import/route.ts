/**
 * POST /api/admin/timeclock/import?kind=full|delta
 *
 * One slice of the migration. Admin only. Reads QuickBooks Time and writes only
 * to our own tc_ tables: nothing is sent back to TSheets, and no payroll system
 * is touched.
 *
 * It returns after its time budget, with `nextMonth` set when there is more to
 * do. Call it again to continue; the cursor lives in tc_import_runs, so
 * repeating a call is safe and stopping one loses at most the month in flight,
 * which the next call re-imports whole.
 *
 * Service-role client on purpose: the import writes across people and every tc_
 * table, and it must behave the same whether it was started by a person or, one
 * day, by a cron. The admin check above is what gates it.
 */

import { NextResponse } from 'next/server'
import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { runImport } from '@/lib/timeclock/runner'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!(await isSecurityAdmin())) {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 })
  }

  const kind = new URL(request.url).searchParams.get('kind') === 'delta' ? 'delta' : 'full'

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings').select('tsheets_api_token').eq('singleton_id', 1).maybeSingle()
  const token = (data as { tsheets_api_token?: string | null } | null)?.tsheets_api_token
  if (!token) return NextResponse.json({ error: 'No TSheets token configured.' }, { status: 500 })

  // Short of maxDuration, so the month in flight can finish and the cursor can
  // be written before the platform pulls the plug.
  const report = await runImport(supabase, token, { kind, budgetMs: 230_000 })
  return NextResponse.json(report, { status: report.state === 'failed' ? 500 : 200 })
}
