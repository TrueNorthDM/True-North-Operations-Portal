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

import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMondayToken } from '@/lib/monday/snapshot'
import { syncMondayUsers, syncMondayBoards } from '@/lib/monday/worklist/discover'
import { acquireLease, releaseLease } from '@/lib/monday/worklist/sync-run'
import { ANOTHER_SITE, fromAnotherSite } from '@/lib/auth/same-site'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await allowedTo('cs-my-work'))) return new Response('Admins only.', { status: 403 })

  const url = new URL(request.url)
  if (url.searchParams.get('run') !== 'yes') {
    return new Response(
      'This one writes. Add ?run=yes to go ahead.\n\n' +
      'It fills the Monday user list, links each account to a directory person\n' +
      'by email, records every active board, and seeds each board\'s steps from\n' +
      'its column layout. Steps you have already confirmed are left alone.\n',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  if (fromAnotherSite(request)) return new Response(ANOTHER_SITE, { status: 403 })

  const token = await getMondayToken()
  if (!token) return new Response('No Monday token configured in Settings.', { status: 400 })

  const supabase = createAdminClient()
  const out: string[] = []
  const started = Date.now()

  // The sync's own lock: discovery clears gone boards and rewrites steps, and
  // running beside a sync hop raced it (audit, 10 October 2026).
  const run = `discover-${new Date().toISOString()}`
  const lease = await acquireLease(supabase, run)
  if (!lease.ok) {
    return new Response('A sync is running, and it starts with this same step. Try again once it ends.\n',
      { status: 409, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  try {
    const u = await syncMondayUsers(supabase, token)
    out.push(`USERS      ${u.users} accounts, ${u.linkedByEmail} newly linked by email`)
    if (u.recovered) out.push(`  ${u.recovered} were found only by asking for their id: on work, but left out of the listing.`)
    if (u.ghosts) out.push(`  ${u.ghosts} could not be resolved at all and got a placeholder: the account was deleted from Monday while its id stays written on old items.`)
    if (u.unlinked.length) {
      out.push(`  ${u.unlinked.length} could not be linked and need a person chosen by hand:`)
      for (const x of u.unlinked) out.push(`    ${String(x.id).padEnd(11)} ${x.name}  ${x.email ?? '(no email)'}`)
      out.push('  Their work will not appear under any team until they are linked.')
    }
    out.push('')

    const b = await syncMondayBoards(supabase, token)
    out.push(`BOARDS     ${b.boards} active, ${b.withPeople} carry people columns`)
    out.push(`STEPS      ${b.stepsWithDeadline} people columns own a status with a deadline and are steps;`)
    out.push(`           ${b.stepsSeeded - b.stepsWithDeadline} own none and stay off My Work; ${b.stepsKept} left as you set them`)
    out.push('')
    out.push(`Done in ${Math.round((Date.now() - started) / 1000)}s.`)
    out.push('')
    out.push('A step is a status with a deadline beside it, read from the board\'s')
    out.push('layout. Every seeded step is still a guess until somebody looks at it:')
    out.push('switch off anything that is not a stage of work on the review screen.')
    return new Response(out.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (e) {
    console.error('[monday-discover]', (e as Error).message)
    out.push(`FAILED after ${Math.round((Date.now() - started) / 1000)}s. The detail is in the server log.`)
    return new Response(out.join('\n'), { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } finally {
    await releaseLease(supabase, run)
  }
}
