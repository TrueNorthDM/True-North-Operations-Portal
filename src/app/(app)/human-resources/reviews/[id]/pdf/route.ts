/**
 * GET /human-resources/reviews/<id>/pdf: the approved review as a PDF, the one
 * the preview window shows (every PDF in the portal opens a preview first).
 * The copy kept at approval when there is one, else printed now from the
 * print page. Only for whoever may see the review (lib/review/data.ts).
 */

import { loadAccess } from '@/lib/access/resolve'
import { contentDisposition } from '@/lib/drive/file-names'
import { sheetPdf } from '@/lib/pdf/sheet-pdf'
import { loadHrSettings, loadReview, loadRoster, rosterParticipants, viewerOf, canSeePerson } from '@/lib/review/data'
import { storedPdf } from '@/lib/review/drive'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const none = () => new Response('No such review.', { status: 404, headers: { 'Content-Type': 'text/plain' } })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await loadAccess()
  if (!access.can('human-resources') || !/^\d+$/.test(id)) return none()
  const r = await loadReview(Number(id))
  if (!r || r.step !== 'approved') return none()
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  const viewer = viewerOf(access, settings, rosterParticipants(roster, settings))
  if (!canSeePerson(viewer, r.person_id)) return none()
  const name = r.pdf_name ?? 'Annual review.pdf'
  const kept = r.pdf_path ? await storedPdf(r.pdf_path) : null
  if (kept) return new Response(kept as unknown as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': contentDisposition(name), 'Cache-Control': 'no-store' } })
  return sheetPdf(request, `/human-resources/reviews/${id}/print`, () => name, { width: 816, landscape: false, allPages: true, letter: true }, name)
}
