'use client'

/** Approvals on the live page: the screen over approvals/actions.ts. */

import { useRouter } from 'next/navigation'
import { decideCorrection, decideTimeOff, decideTimesheet, getApprovals, getTimesheet, reopenTimesheet } from '@/app/(app)/clocky-hours/approvals/actions'
import { getEntryHistory } from '@/app/(app)/clocky-hours/entries-actions'
import type { ApprovalsData } from '@/lib/timeclock/clocky-types'
import type { ApprovalsApi } from '../entries/api'
import { Approvals } from './Approvals'

export function ApprovalsLive({ initialData }: { initialData: ApprovalsData }) {
  const router = useRouter()
  const api: ApprovalsApi = {
    getApprovals,
    getEntryHistory,
    // After a decision the rail's waiting count changes too.
    decideCorrection: async i => { const r = await decideCorrection(i); if (r.ok) router.refresh(); return r },
    decideTimeOff: async i => { const r = await decideTimeOff(i); if (r.ok) router.refresh(); return r },
    getTimesheet,
    decideTimesheet: async i => { const r = await decideTimesheet(i); if (r.ok) router.refresh(); return r },
    reopenTimesheet: async i => { const r = await reopenTimesheet(i); if (r.ok) router.refresh(); return r },
  }
  return <Approvals initialData={initialData} api={api} />
}
