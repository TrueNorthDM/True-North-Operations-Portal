// Reading one item's History: Monday's log, filed under the board's steps.
//
// The API route (app/api/monday/item-history) answers the panel with this; it
// lives here so it can be exercised against real data without a session.
// Rules for grouping and drawing are in history.ts.

import type { Db } from '@/lib/supabase/types'
import { gql } from './discover'
import { missingColumn } from './missing-column'
import {
  columnSteps, personIds, type HistoryData, type HistoryEvent, type HistoryStep, type StepRow,
} from './history'

type Client = Db

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
  const o = v as { label?: { text?: string }; text?: string; name?: string; date?: string; url?: string }
  return o.label?.text ?? o.text ?? o.name ?? o.date ?? o.url ?? null
}

function parse(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw !== 'string') return raw as Record<string, unknown>
  try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
}

/** The reader, as the History needs them: who they are and their photo. */
export interface HistoryReaderPerson { id: string; full_name: string; avatar_url: string | null }

export async function loadItemHistory(
  supabase: Client, token: string, board: string, item: string, me: HistoryReaderPerson | null,
): Promise<HistoryData> {
  const [d, stepRows, assignRows] = await Promise.all([
    gql<{
      boards: { activity_logs: RawLog[] }[]
      items: { column_values: { id: string; text: string | null; value: string | null }[] }[]
    }>(token, `
      query ($board: [ID!], $item: [ID!]) {
        boards(ids: $board) {
          activity_logs(item_ids: $item, limit: 200) { id event data created_at user_id }
        }
        items(ids: $item) { column_values { id text value } }
      }`, { board: [board], item: [item] }),
    readSteps(supabase, Number(board)),
    supabase.from('monday_assignments')
      .select('people_col, due_col, due_date, status_text, status_color, monday_user_id')
      .eq('board_id', Number(board)).eq('item_id', Number(item)),
  ])

  // Which step each column belongs to, including the due column the sync
  // recorded for a step when the layout named no stage.
  type Assign = { people_col: string; due_col: string | null; due_date: string | null; status_text: string | null; status_color: string | null; monday_user_id: number }
  const assigns = (assignRows.data ?? []) as Assign[]
  const extra = new Map<string, string[]>()
  for (const a of assigns) if (a.due_col) extra.set(a.people_col, [...(extra.get(a.people_col) ?? []), a.due_col])
  const stepOf = columnSteps(stepRows, extra)

  const logs = d.boards?.[0]?.activity_logs ?? []
  const events: HistoryEvent[] = logs.map(l => {
    const parsed = parse(l.data)
    const columnId = (parsed.column_id as string) ?? null
    const before = personIds(parse(parsed.previous_value))
    const after = personIds(parse(parsed.value))
    const isPeople = before.length > 0 || after.length > 0
    return {
      id: l.id,
      event: l.event,
      at: whenOf(l.created_at),
      userId: l.user_id ? Number(l.user_id) : null,
      column: (parsed.column_title as string) ?? null,
      // Labels read the raw value, as before: a text column's value is plain
      // text, which parse() would turn into nothing.
      from: isPeople ? null : labelOf(parsed.previous_value),
      to: isPeople ? null : labelOf(parsed.value),
      stepKey: columnId ? stepOf.get(columnId) ?? null : null,
      ...(isPeople ? { assigned: after.filter(id => !before.includes(id)), unassigned: before.filter(id => !after.includes(id)) } : {}),
    }
  })
    .filter(e => e.event === 'update_column_value' ? e.column != null : true)
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))

  // Who is on each step now, read from the item itself, and its status.
  const values = new Map((d.items?.[0]?.column_values ?? []).map(c => [c.id, c]))
  const steps: HistoryStep[] = stepRows.map(s => {
    const live = values.get(s.people_col)
    const own = assigns.filter(a => a.people_col === s.people_col)
    const owners = live ? personIds(parse(live.value)) : [...new Set(own.map(a => a.monday_user_id))]
    const statusCol = s.status_col ?? s.stages?.[0]?.statusCol ?? null
    const stage = s.stages?.find(st => st.statusCol === statusCol) ?? s.stages?.[0]
    return {
      key: s.people_col,
      name: s.step_name,
      position: s.position,
      owners,
      status: (statusCol ? values.get(statusCol)?.text : null) || own[0]?.status_text || null,
      statusColor: own[0]?.status_color ?? null,
      dueTitle: stage?.dateTitle ?? null,
      due: (stage?.dateCol ? values.get(stage.dateCol)?.text : null) || own[0]?.due_date || null,
    }
  })

  // The reader's accounts, so the panel knows which steps are theirs.
  const { data: myLinks } = me
    ? await supabase.from('monday_user_links').select('monday_user_id').eq('person_id', me.id)
    : { data: [] }
  const accounts = ((myLinks ?? []) as { monday_user_id: number }[]).map(l => l.monday_user_id)

  const ids = new Set<number>()
  for (const e of events) {
    if (e.userId) ids.add(e.userId)
    for (const id of [...(e.assigned ?? []), ...(e.unassigned ?? [])]) ids.add(id)
  }
  for (const s of steps) for (const o of s.owners) ids.add(o)

  return {
    events,
    names: await namesFor(supabase, [...ids]),
    steps,
    reader: me ? { name: me.full_name, avatarUrl: me.avatar_url, accounts } : null,
  }
}

/** The board's steps. Migration 082 added stages; before it, a step is its people and status column. */
async function readSteps(supabase: Client, board: number): Promise<StepRow[]> {
  const first = await supabase.from('monday_board_steps').select('people_col, step_name, position, status_col, stages').eq('board_id', board)
  if (missingColumn(first.error, 'stages')) {
    const { data } = await supabase.from('monday_board_steps').select('people_col, step_name, position, status_col').eq('board_id', board)
    return (data ?? []) as StepRow[]
  }
  return (first.data ?? []) as StepRow[]
}

/** The portal's name for each account where it is linked to a person, Monday's otherwise. */
async function namesFor(supabase: Client, ids: number[]): Promise<Record<number, string>> {
  const names: Record<number, string> = {}
  if (!ids.length) return names
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
  return names
}
