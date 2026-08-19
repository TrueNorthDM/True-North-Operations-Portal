/**
 * GET /api/monday/item-history?board=<id>&item=<id>
 *
 * One item's trip through its workflow, fetched from Monday when somebody asks
 * for it. Nothing here is stored: the survey established that activity_logs
 * accepts item_ids, which is what lets a whole ingest not exist.
 *
 * Signed-in users, not admins. This is the same information the boards
 * dashboards already show, and a person needs to see the history of work that
 * is on their own list.
 */

import { createClient } from '@/lib/supabase/server'
import { getMondayToken } from '@/lib/monday/snapshot'
import { gql } from '@/lib/monday/worklist/discover'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RawLog {
  id: string
  event: string
  data: string
  created_at: string
  user_id: string | null
}

/** Monday stamps logs in 100-nanosecond units since the epoch. */
function whenOf(raw: string): string | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Math.round(n / 10000)).toISOString()
}

function labelOf(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v || null
  const o = v as { label?: { text?: string }; text?: string; name?: string; date?: string }
  return o.label?.text ?? o.text ?? o.name ?? o.date ?? null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return new Response('Sign in.', { status: 401 })

  const url = new URL(request.url)
  const board = url.searchParams.get('board')
  const item = url.searchParams.get('item')
  if (!board || !item) return Response.json({ error: 'board and item are required' }, { status: 400 })

  const token = await getMondayToken()
  if (!token) return Response.json({ error: 'No Monday token configured.' }, { status: 400 })

  try {
    const d = await gql<{ boards: { activity_logs: RawLog[] }[] }>(token, `
      query ($board: [ID!], $item: [ID!]) {
        boards(ids: $board) {
          activity_logs(item_ids: $item, limit: 200) { id event data created_at user_id }
        }
      }`, { board: [board], item: [item] })

    const logs = d.boards?.[0]?.activity_logs ?? []
    const events = logs.map(l => {
      let parsed: Record<string, unknown> = {}
      try { parsed = (typeof l.data === 'string' ? JSON.parse(l.data) : l.data) as Record<string, unknown> } catch { /* keep empty */ }
      return {
        id: l.id,
        event: l.event,
        at: whenOf(l.created_at),
        userId: l.user_id ? Number(l.user_id) : null,
        column: (parsed.column_title as string) ?? null,
        from: labelOf(parsed.previous_value),
        to: labelOf(parsed.value),
      }
    })
      // Column moves are the workflow; the rest is noise on a history screen.
      .filter(e => e.event === 'update_column_value' ? e.column != null : true)
      .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))

    // Names for whoever moved things, resolved to directory names when known.
    const ids = [...new Set(events.map(e => e.userId).filter(Boolean) as number[])]
    const names: Record<number, string> = {}
    if (ids.length) {
      const [{ data: mu }, { data: links }] = await Promise.all([
        supabase.from('monday_users').select('id, name').in('id', ids),
        supabase.from('monday_user_links').select('monday_user_id, person_id').in('monday_user_id', ids),
      ])
      const personIds = ((links ?? []) as { person_id: string }[]).map(l => l.person_id)
      const { data: people } = personIds.length
        ? await supabase.from('people').select('id, full_name').in('id', personIds)
        : { data: [] }
      const pn = new Map(((people ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
      const byAccount = new Map(((links ?? []) as { monday_user_id: number; person_id: string }[])
        .map(l => [l.monday_user_id, l.person_id]))
      for (const u of (mu ?? []) as { id: number; name: string }[]) {
        const pid = byAccount.get(u.id)
        names[u.id] = (pid ? pn.get(pid) : undefined) ?? u.name
      }
    }

    return Response.json({ events, names })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
