'use server'

/**
 * A payroll summary or reimbursement document as its sheet, for the preview
 * window the Payments tab opens (Company Settings.dc.html 10P). The same people
 * as the PDF: the person, Super Admins, Admins and Finance (lib/timeclock/pay-docs.ts).
 */

import { loadAccess } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadDoc, type DocKind, type DocSheetData } from '@/lib/timeclock/pay-docs'
import type { Result } from '@/lib/timeclock/clocky-types'

export async function getPayDoc(input: { kind: DocKind; id: number }): Promise<Result<{ doc: DocSheetData }>> {
  try {
    if (input.kind !== 'payroll' && input.kind !== 'rmb') return { ok: false, error: 'No such document.' }
    const access = await loadAccess()
    if (!access.can('clocky-hours')) return { ok: false, error: 'North Time is not open to your access.' }
    const v = await viewerFor(access)
    const doc = await loadDoc(access, input.kind, Number(input.id), v?.zone ?? 'America/New_York')
    return doc ? { ok: true, doc } : { ok: false, error: 'That document is not open to you.' }
  } catch (e) {
    console.error('[clocky documents]', e instanceof Error ? e.message : e)
    return { ok: false, error: 'The document could not be read. Try again in a moment.' }
  }
}
