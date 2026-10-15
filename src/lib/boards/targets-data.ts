/**
 * What Settings > Publishing targets shows: each publishing board with the
 * languages its site publishes, its rhythm (every week or every two weeks,
 * 15 October 2026), its targets, their change history and the publishers list.
 *
 * Read with the server's own client (audit, 10 October 2026): the tables are
 * closed to signed-in sessions (migration 106), and the history depended on
 * the old admin profile, so someone given Publishing targets without it saw
 * "No changes recorded yet". Who may see this is decided by the page
 * (cs-targets). A read that fails throws.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { AuditLogRow, PublishingTargetRow } from '@/lib/types/database.types'
import { languageName } from '@/lib/language-display'
import { BOARDS, PUBLISHING_BOARD_IDS } from './config'
import { readPublishingSites, weekStartDay } from './publishing-rules'
import { WEEKLY, type Cadence } from './publishing-cycles'

export interface TargetsBoard {
  id: string
  short: string
  name: string
  languages: string[]
  /** Every week, or two-week cycles from a Monday. A board with no site row is weekly. */
  cadence: Cadence
}

export interface TargetsEditorData {
  targets: PublishingTargetRow[]
  audit: AuditLogRow[]
  boards: TargetsBoard[]
  publishers: string[]
  /** This week's Monday in New York: where a new two-week rhythm would start. */
  thisMonday: string
}

function failed(what: string, error: { message: string } | null | undefined): void {
  if (error) throw new Error(`Publishing targets could not read ${what}: ${error.message}`)
}

/** The language names a board's site publishes, and its rhythm, by its Monday board id. */
async function boardSites(): Promise<Map<string, { languages: string[]; cadence: Cadence }>> {
  const sites = await readPublishingSites(createAdminClient())
  return new Map(sites.map(s => [s.boardId, { languages: s.languages.map(languageName), cadence: s.cadence }]))
}

/** The language names a board's site publishes, by its Monday board id. */
export async function boardLanguages(): Promise<Map<string, string[]>> {
  return new Map([...(await boardSites())].map(([id, s]) => [id, s.languages]))
}

export async function loadTargetsEditor(): Promise<TargetsEditorData> {
  const db = createAdminClient()
  const [targets, audit, publishers, sites] = await Promise.all([
    db.from('publishing_targets').select('*').eq('period_type', 'weekly')
      .order('board_short', { ascending: true }).order('language', { ascending: true }),
    db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('publishing_publishers').select('name').order('name'),
    boardSites(),
  ])
  failed('the targets', targets.error)
  failed('the change history', audit.error)
  failed('the publishers', publishers.error)

  return {
    targets: (targets.data ?? []) as PublishingTargetRow[],
    audit: (audit.data ?? []) as AuditLogRow[],
    boards: PUBLISHING_BOARD_IDS.map(id => ({
      id, short: BOARDS[id].short, name: BOARDS[id].name,
      languages: sites.get(id)?.languages ?? [], cadence: sites.get(id)?.cadence ?? WEEKLY,
    })),
    publishers: ((publishers.data ?? []) as { name: string }[]).map(p => p.name),
    thisMonday: weekStartDay(new Date()),
  }
}
