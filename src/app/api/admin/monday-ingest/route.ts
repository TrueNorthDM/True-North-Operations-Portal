/**
 * GET /api/admin/monday-ingest?run=yes
 *
 * Reads assignments off every included board that has steps, oldest first,
 * until the time budget runs out. Re-run until it says nothing is left.
 *
 * Sliced rather than one long run because a Vercel function is killed at 300
 * seconds and 197 boards do not fit in one. Progress lives on the board row
 * (items_synced_at), so a slice that dies costs one board.
 */

import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMondayToken } from '@/lib/monday/snapshot'
import { ingestSlice } from '@/lib/monday/worklist/ingest'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Leaves room to write what was gathered before the platform pulls the plug.
const BUDGET_MS = 220_000

export async function GET(request: Request) {
  if (!(await isSecurityAdmin())) return new Response('Admins only.', { status: 403 })

  const url = new URL(request.url)
  if (url.searchParams.get('run') !== 'yes') {
    return new Response('This one writes. Add ?run=yes.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const token = await getMondayToken()
  if (!token) return new Response('No Monday token configured in Settings.', { status: 400 })

  const out: string[] = []
  try {
    const r = await ingestSlice(createAdminClient(), token, BUDGET_MS)
    const items = r.done.reduce((s, b) => s + b.items, 0)
    const asg = r.done.reduce((s, b) => s + b.assignments, 0)
    out.push(`${r.done.length} boards in ${Math.round(r.spentMs / 1000)}s: ${items} items, ${asg} assignments.`)
    out.push('')
    for (const b of r.done.sort((a, b2) => b2.assignments - a.assignments)) {
      out.push(`  ${String(b.assignments).padStart(6)}  from ${String(b.items).padStart(5)} items   ${b.board}`)
    }
    out.push('')
    out.push(r.remaining > 0
      ? `${r.remaining} boards still to go. Run it again.`
      : 'Nothing left. Every board is in.')
    return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (e) {
    out.push(`FAILED: ${(e as Error).message}`)
    out.push('Whatever finished is saved. Run it again to pick up from there.')
    return new Response(out.join('\n'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
