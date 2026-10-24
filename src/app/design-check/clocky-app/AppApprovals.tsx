'use client'

// Approvals inside the shell (Clocky part 2, Approvals.dc.html): the real list
// with the prototype's data. AP1 waiting for Arnaldo Oliveira (Super Admin),
// AP3 with others, AP2 decided, APL Wendy Cacka (Team Leader of Web), APD
// Dave Sharpe (Admin); 7C, 9C, 10D the cards of a time off, a reimbursement
// and extra hours. Nothing is saved.

import { useState } from 'react'
import { ApprovalsList, type QueueApi } from '@/components/clocky/approvals/ApprovalsList'
import { sampleQueue } from '../clocky-part2/queue-sample'

export type ApprovalsFrame = 'AP1' | 'AP3' | 'AP2' | 'APL' | 'APD' | '7C' | '9C' | '9Cr' | '10D'

const CARD: Partial<Record<ApprovalsFrame, string>> = { '7C': 'r6', '9C': 'r7', '9Cr': 'rr1', '10D': 'r9' }

export function AppApprovals({ frame }: { frame: ApprovalsFrame }) {
  const level = frame === 'APL' ? 'lead' : frame === 'APD' ? 'admin' : 'super'
  const [data] = useState(() => sampleQueue(level, frame === '9Cr'))
  const [api] = useState<QueueApi>(() => ({
    getQueue: async () => ({ ok: true, data: sampleQueue(level, frame === '9Cr') }),
    getEntryHistory: async () => ({ ok: false, error: 'No history in the design check.' }),
    decideCorrection: async () => ({ ok: true, toast: 'Approved. The time now counts in their hours, marked Edited.' }),
    decideTimeOff: async () => ({ ok: true }),
    decideTimeOffCancel: async () => ({ ok: true, toast: 'Cancelled. It came off their time entries.' }),
    decideReimbursement: async () => ({ ok: true, toast: 'Approved. It is on RMB-2026-0031 for Finance to pay.' }),
    decideReimbursementReport: async () => ({ ok: true, toast: 'Approved 3, denied 1. They go on Justus\'s next invoice by themselves.' }),
    decideExtraHours: async () => ({ ok: true, toast: "Approved. Cheyenne's allowance for November 2026 grows by 8h 00m." }),
  }))
  return <ApprovalsList key={frame} initialData={data} api={api} initial={{ tab: frame === 'AP3' ? 'others' : frame === 'AP2' ? 'done' : 'wait', request: CARD[frame] }} />
}
