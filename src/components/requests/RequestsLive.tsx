'use client'

/** Requests on the live pages: the screens over requests/actions.ts and approvals/actions.ts. */

import { askCancelTimeOff, askExtraHours, askTimeOff, cancelTimeOff, markRmbPaid } from '@/app/(app)/requests/actions'
import { retryTimeOffRippling } from '@/app/(app)/clocky-hours/approvals/actions'
import { getPayDoc } from '@/app/(app)/clocky-hours/documents/actions'
import type { TimeOffPage } from '@/lib/timeclock/time-off-data'
import type { ExtraPage, ReimbursementsPage, RmbDocPage } from '@/lib/timeclock/requests-data'
import { TimeOffView } from './TimeOffView'
import { ReimbursementsView, sendReimbursement } from './ReimbursementsView'
import { RmbDocView } from './RmbDocView'
import { ExtraHoursView } from './ExtraHoursView'

export function TimeOffLive({ data }: { data: TimeOffPage }) {
  return <TimeOffView data={data} api={{ askTimeOff, cancelTimeOff, askCancelTimeOff, retryTimeOffRippling }} />
}

export function ReimbursementsLive({ data }: { data: ReimbursementsPage }) {
  return <ReimbursementsView data={data} send={sendReimbursement} />
}

export function RmbDocLive({ d }: { d: RmbDocPage }) {
  return <RmbDocView d={d} api={{ getPayDoc: i => getPayDoc(i), markRmbPaid }} />
}

export function ExtraHoursLive({ data, ask = false }: { data: ExtraPage; ask?: boolean }) {
  return <ExtraHoursView data={data} api={{ askExtraHours }} initial={ask ? { form: true } : undefined} />
}
