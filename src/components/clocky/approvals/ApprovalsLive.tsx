'use client'

/** Approvals on the live page: the list over approvals/actions.ts. */

import { useRouter } from 'next/navigation'
import { decideCorrection, decideExtraHours, decideReimbursement, decideReimbursementReport, decideTimeOff, decideTimeOffCancel, getQueue } from '@/app/(app)/clocky-hours/approvals/actions'
import { getEntryHistory } from '@/app/(app)/clocky-hours/entries-actions'
import type { QueueData } from '@/lib/timeclock/approval-queue'
import { ApprovalsList, type QueueApi } from './ApprovalsList'

export function ApprovalsLive({ initialData }: { initialData: QueueData }) {
  const router = useRouter()
  const api: QueueApi = {
    getQueue,
    getEntryHistory,
    // After a decision the rail's waiting count changes too.
    decideCorrection: async i => { const r = await decideCorrection(i); if (r.ok) router.refresh(); return r },
    decideTimeOff: async i => { const r = await decideTimeOff(i); if (r.ok) router.refresh(); return r },
    decideTimeOffCancel: async i => { const r = await decideTimeOffCancel(i); if (r.ok) router.refresh(); return r },
    decideReimbursement: async i => { const r = await decideReimbursement(i); if (r.ok) router.refresh(); return r },
    decideReimbursementReport: async i => { const r = await decideReimbursementReport(i); if (r.ok) router.refresh(); return r },
    decideExtraHours: async i => { const r = await decideExtraHours(i); if (r.ok) router.refresh(); return r },
  }
  return <ApprovalsList initialData={initialData} api={api} />
}
