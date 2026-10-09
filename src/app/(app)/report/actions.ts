'use server'

// The person drawer's detail (screens 5.1 to 5.3), fetched when a People row
// is opened (built 9 October 2026; before, the row showed an arrow that
// opened nothing).
//
// Read-only, and narrow: the person must be one the reader's People tab may
// already show, decided by the same rule as the page (lib/report/view.ts).
// Called directly with any id, it answers for nobody else.

import { loadAccess, verifiedSession } from '@/lib/access/resolve'
import { getCurrentPerson } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { resolveReportView } from '@/lib/report/view'
import { loadPersonDetail, type PersonDetail } from '@/lib/report/drawer-data'

export type PersonDetailResult = { ok: true; detail: PersonDetail } | { ok: false; error: string }

const REFUSED = 'This person is not in your Report.'

export async function personDetail(personId: string, period: string): Promise<PersonDetailResult> {
  if (!(await verifiedSession())) return { ok: false, error: REFUSED }
  const access = await loadAccess()
  if (!access.can('report')) return { ok: false, error: REFUSED }

  const me = await getCurrentPerson()
  // Asked as widely as the URL allows; the view clamps it to what this reader
  // may see, so the person survives only if their People tab would list them.
  const view = await resolveReportView(await createClient(), access.can, me?.id ?? null, {
    tab: 'people', scope: 'everyone', period, person: personId,
  })
  if (view.tab !== 'people' || view.filter.personId !== personId) return { ok: false, error: REFUSED }

  try {
    return { ok: true, detail: await loadPersonDetail(personId, view.period) }
  } catch (e) {
    console.error('[report] person detail:', e instanceof Error ? e.message : e)
    return { ok: false, error: 'Their detail could not be read. Try again in a moment.' }
  }
}
