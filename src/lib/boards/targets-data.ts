/**
 * What Settings > Publishing targets shows: each publishing board with the
 * languages its site publishes, its weekly targets, their change history and
 * the publishers list.
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

export interface TargetsBoard { id: string; short: string; name: string; languages: string[] }

export interface TargetsEditorData {
  targets: PublishingTargetRow[]
  audit: AuditLogRow[]
  boards: TargetsBoard[]
  publishers: string[]
}

function failed(what: string, error: { message: string } | null | undefined): void {
  if (error) throw new Error(`Publishing targets could not read ${what}: ${error.message}`)
}

/** The language names a board's site publishes, by its Monday board id. */
export async function boardLanguages(): Promise<Map<string, string[]>> {
  const { data, error } = await createAdminClient().from('sites').select('monday_board_id, languages')
  failed('the sites', error)
  return new Map(((data ?? []) as { monday_board_id: string | null; languages: string[] | null }[])
    .filter(s => s.monday_board_id)
    .map(s => [s.monday_board_id as string, (s.languages ?? []).map(languageName)]))
}

export async function loadTargetsEditor(): Promise<TargetsEditorData> {
  const db = createAdminClient()
  const [targets, audit, publishers, languages] = await Promise.all([
    db.from('publishing_targets').select('*').eq('period_type', 'weekly')
      .order('board_short', { ascending: true }).order('language', { ascending: true }),
    db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('publishing_publishers').select('name').order('name'),
    boardLanguages(),
  ])
  failed('the targets', targets.error)
  failed('the change history', audit.error)
  failed('the publishers', publishers.error)

  return {
    targets: (targets.data ?? []) as PublishingTargetRow[],
    audit: (audit.data ?? []) as AuditLogRow[],
    boards: PUBLISHING_BOARD_IDS.map(id => ({
      id, short: BOARDS[id].short, name: BOARDS[id].name, languages: languages.get(id) ?? [],
    })),
    publishers: ((publishers.data ?? []) as { name: string }[]).map(p => p.name),
  }
}
