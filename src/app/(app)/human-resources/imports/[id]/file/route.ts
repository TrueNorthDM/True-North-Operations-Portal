/**
 * GET /human-resources/imports/<id>/file: last year's review, imported from
 * Drive and kept as a PDF (lib/review/drive.ts), shown beside the self-review
 * and on My reviews. Only for whoever may see that person's reviews: the
 * person, the one they report to now, HR, the VP of Operations, the CISO.
 */

import { loadAccess } from '@/lib/access/resolve'
import { contentDisposition } from '@/lib/drive/file-names'
import { canSeePerson, loadHrSettings, loadRoster, rdb, rosterParticipants, viewerOf } from '@/lib/review/data'
import { importPath, storedPdf } from '@/lib/review/drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const none = () => new Response('No such file.', { status: 404, headers: { 'Content-Type': 'text/plain' } })

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await loadAccess()
  if (!access.can('human-resources') || !/^\d+$/.test(id)) return none()
  const row = (await rdb().from('review_imports').select('id, person_id, file_name, imported_at').eq('id', Number(id)).maybeSingle()).data as { id: number; person_id: string | null; file_name: string; imported_at: string | null } | null
  if (!row?.person_id || !row.imported_at) return none()
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  if (!canSeePerson(viewerOf(access, settings, rosterParticipants(roster, settings)), row.person_id)) return none()
  const bytes = await storedPdf(importPath(row.id))
  if (!bytes) return none()
  const name = row.file_name.replace(/\.[a-z0-9]{2,5}$/i, '') + '.pdf'
  return new Response(bytes as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': contentDisposition(name, 'inline'), 'Cache-Control': 'no-store' } })
}
