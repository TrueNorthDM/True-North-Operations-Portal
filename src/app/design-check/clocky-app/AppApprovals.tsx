'use client'

// Approvals inside the shell: the Approvals design check's data (3L Super
// Admin with Clarise's request, 3L2 Team Leader of Web), the real component.

import { useState } from 'react'
import { Approvals } from '@/components/clocky/approvals/Approvals'
import { approvalsData, generate, makeApi, makeStore, reqSeed } from '../clocky-entries/sample'

export function AppApprovals({ frame }: { frame: '3L' | '3L2' }) {
  const [store] = useState(() => (frame === '3L' ? makeStore('super', [...generate(), reqSeed()]) : makeStore('lead', generate())))
  const [api] = useState(() => makeApi(store))
  const [data] = useState(() => approvalsData(store))
  return <Approvals initialData={data} api={api} />
}
