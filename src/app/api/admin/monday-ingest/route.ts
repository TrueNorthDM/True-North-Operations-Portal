/**
 * GET /api/admin/monday-ingest?run=yes
 *
 * Starts the same chained ingest the cron runs, and answers immediately.
 *
 * It used to do the reading inside this request, which meant the browser sat
 * on a blank tab for up to four minutes and then, if the platform lost
 * patience first, showed nothing at all. A request that holds a person still
 * while it works is a bad way to run a job that takes minutes: the work has a
 * place to report progress already, and waiting is not how you read it.
 *
 * So this hands off to /api/cron/monday-worklist, which slices, chains and
 * stamps each board as it finishes, and returns a pointer to the status page.
 * Nothing is lost if the tab is closed a second later.
 */

import { allowedTo } from '@/lib/access/resolve'
import { internalOrigin } from '@/lib/auth/public-origin'
import { ANOTHER_SITE, fromAnotherSite } from '@/lib/auth/same-site'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await allowedTo('cs-my-work'))) return new Response('Admins only.', { status: 403 })

  const url = new URL(request.url)
  if (url.searchParams.get('run') !== 'yes') {
    return new Response('This one writes. Add ?run=yes.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  if (fromAnotherSite(request)) return new Response(ANOTHER_SITE, { status: 403 })

  // A sync already running would make this one skip its turn without a word,
  // and "Started." would be untrue (audit, 10 October 2026).
  const { data: lock, error: lockErr } = await createAdminClient()
    .from('monday_sync_lock').select('holder, expires_at').eq('id', 1).maybeSingle()
  if (lockErr) return new Response('The sync could not be checked. Try again in a moment.', { status: 500 })
  const held = lock as { holder: string | null; expires_at: string | null } | null
  if (held?.holder && held.expires_at && Date.parse(held.expires_at) > Date.now()) {
    return new Response(
      'A sync is already running, so this one was not started. It reads every board;\n'
      + 'watch it at /api/admin/monday-inventory?part=status\n',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  }

  const secret = process.env.CRON_SECRET
  const target = new URL('/api/cron/monday-worklist', internalOrigin(request.url))

  // Fire and forget, exactly as the chain does between its own hops: awaiting
  // it would put the four-minute wait straight back.
  void fetch(target.toString(), {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  }).catch(() => {
    // Nothing to recover here. The scheduled run picks up the same queue, in
    // the same order, because progress lives on the board rows.
  })

  return new Response(
    [
      'Started.',
      '',
      'It refreshes the user, board and step maps first, then reads boards in',
      'slices, oldest first, calling itself until the queue is empty. A full',
      'pass over 197 boards takes a few minutes and continues after this tab',
      'is closed.',
      '',
      'Watch it here:',
      '  /api/admin/monday-inventory?part=status',
      '',
      'Or just wait: the same job runs on its own every four hours.',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}
