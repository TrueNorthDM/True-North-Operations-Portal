'use client'

import { useState } from 'react'
import { TransitionReport } from '@/components/clocky/transition/TransitionReport'
import type { TransitionQuery } from '@/lib/timeclock/transition-data'
import { sampleTransition } from './sample'

/** The real component on the sample: the filters answer from it, as the page would from the server. */
export function TransitionCheck({ frame }: { frame: 'data' | 'empty' | 'none' }) {
  const [q, setQ] = useState<TransitionQuery>({})
  return <TransitionReport data={sampleTransition(q, frame)} go={setQ} />
}
