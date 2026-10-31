/**
 * GET /api/cron/agenda-google-sync, every 5 minutes (owner, 30 October 2026):
 * brings what changed in each Google-connected calendar into the Agenda.
 * See src/lib/agenda/google-sync.ts. Does nothing while the new Agenda is
 * closed (migration 134).
 */

import { NextResponse } from 'next/server'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { syncFromGoogle } from '@/lib/agenda/google-sync'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await agendaGoogleOpen())) return NextResponse.json({ ok: true, skipped: 'the new Agenda is closed' })
  try {
    const report = await syncFromGoogle()
    if (report.errors.length) console.error('[agenda google sync]', report.errors.slice(0, 5).join(' | '))
    if (report.updated || report.deleted || report.added) { revalidatePath('/agenda'); revalidatePath('/') }
    return NextResponse.json({ ok: true, ...report, errors: report.errors.slice(0, 5) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
