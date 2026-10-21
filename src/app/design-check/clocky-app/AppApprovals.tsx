'use client'

// Approvals inside the shell (Clocky part 2, Approvals.dc.html): the real list
// with the prototype's data. AP1 waiting for Arnaldo Oliveira (Super Admin),
// AP3 with others, AP2 decided, APL Wendy Cacka (Team Leader of Web), APD
// Dave Sharpe (Admin). Nothing is saved.

import { useState } from 'react'
import { ApprovalsList, type QueueApi } from '@/components/clocky/approvals/ApprovalsList'
import { sampleQueue } from '../clocky-part2/queue-sample'

export type ApprovalsFrame = 'AP1' | 'AP3' | 'AP2' | 'APL' | 'APD'

export function AppApprovals({ frame }: { frame: ApprovalsFrame }) {
  const level = frame === 'APL' ? 'lead' : frame === 'APD' ? 'admin' : 'super'
  const [data] = useState(() => sampleQueue(level))
  const [api] = useState<QueueApi>(() => ({
    getQueue: async () => ({ ok: true, data: sampleQueue(level) }),
    getEntryHistory: async () => ({ ok: false, error: 'No history in the design check.' }),
    decideCorrection: async () => ({ ok: true, toast: 'Approved. The time now counts in their hours, marked Edited.' }),
    decideTimeOff: async () => ({ ok: true }),
  }))
  return <ApprovalsList key={frame} initialData={data} api={api} initial={{ tab: frame === 'AP3' ? 'others' : frame === 'AP2' ? 'done' : 'wait' }} />
}
