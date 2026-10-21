'use client'

// Approvals inside the shell: the Approvals design check's data (3L Super
// Admin with Clarise's request, 3L2 Team Leader of Web, 3L3 Super Admin with
// sent timesheets, the owner's mockup of 20 October 2026), the real component.

import { useState } from 'react'
import { Approvals } from '@/components/clocky/approvals/Approvals'
import { SHEETS, approvalsData, generate, makeApi, makeStore, reqSeed } from '../clocky-entries/sample'

export function AppApprovals({ frame }: { frame: '3L' | '3L2' | '3L3' }) {
  const [store] = useState(() => (frame === '3L' ? makeStore('super', [...generate(), reqSeed()])
    : frame === '3L3' ? makeStore('super', [...generate(), reqSeed()], {}, SHEETS.map(t => ({ ...t })))
    : makeStore('lead', generate())))
  const [api] = useState(() => makeApi(store))
  const [data] = useState(() => approvalsData(store))
  return <Approvals initialData={data} api={api} />
}
