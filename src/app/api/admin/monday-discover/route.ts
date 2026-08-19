/**
 * GET /api/admin/monday-discover?run=yes
 *
 * Fills monday_users, monday_user_links, monday_boards and monday_board_steps.
 * Reads no items: this is the map, not the work.
 *
 * A separate route from monday-inventory on purpose. That one says it writes
 * nothing, and a survey that quietly also writes is a survey nobody can trust
 * to run twice. This one writes, says so, and refuses to move without ?run=yes.
 *
 * Safe to re-run. Board and user rows are upserted; a step somebody confirmed
 * or switched off is left exactly as they left it.
 */

import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMondayToken } from '@/lib/monday/snapshot'
import { syncMondayUsers, syncMondayBoards } from '@/lib/monday/worklist/discover'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await isSecurityAdmin())) return new Response('Admins only.', { status: 403 })

  const url = new URL(request.url)
  if (url.searchParams.get('run') !== 'yes') {
    return new Response(
      'This one writes. Add ?run=yes to go ahead.\n\n' +
      'It fills the Monday user list, links each account to a directory person\n' +
      'by email, records every active board, and seeds each board\'s steps from\n' +
      'its column layout. Steps you have already confirmed are left alone.\n',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const token = await getMondayToken()
  if (!token) return new Response('No Monday token configured in Settings.', { status: 400 })

  const supabase = createAdminClient()
  const out: string[] = []
  const started = Date.now()

  try {
    const u = await syncMondayUsers(supabase, token)
    out.push(`USERS      ${u.users} accounts, ${u.linkedByEmail} newly linked by email`)
    if (u.unlinked.length) {
      out.push(`  ${u.unlinked.length} could not be linked and need a person chosen by hand:`)
      for (const x of u.unlinked) out.push(`    ${String(x.id).padEnd(11)} ${x.name}  ${x.email ?? '(no email)'}`)
      out.push('  Their work will not appear under any team until they are linked.')
    }
    out.push('')

    const b = await syncMondayBoards(supabase, token)
    out.push(`BOARDS     ${b.boards} active, ${b.withPeople} carry people columns`)
    out.push(`STEPS      ${b.stepsSeeded} seeded from the layout, ${b.stepsKept} left as you confirmed them`)
    out.push('')
    out.push(`Done in ${Math.round((Date.now() - started) / 1000)}s.`)
    out.push('')
    out.push('Every seeded step is a guess until somebody looks at it. The guess')
    out.push('cannot tell a workflow step from a tag, so expect a few steps named')
    out.push('after things like "Priority" and correct those on the review screen.')
    return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (e) {
    out.push(`FAILED after ${Math.round((Date.now() - started) / 1000)}s: ${(e as Error).message}`)
    return new Response(out.join('\n'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }
}
