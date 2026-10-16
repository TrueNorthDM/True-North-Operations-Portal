'use client'

import { ClockSafety, type SafetyLoad } from '@/components/clocky/safety/ClockSafety'
import { sampleSafety } from './sample'

// One stable loader per frame, so the page asks again only when the period or
// the search changes.
const loader = (empty: boolean, access: 'full' | 'read'): SafetyLoad =>
  async ({ period, q }) => ({ ok: true, data: sampleSafety({ period, q, empty, access }) })
const LOADERS = {
  'data-full': loader(false, 'full'), 'data-read': loader(false, 'read'),
  'empty-full': loader(true, 'full'), 'empty-read': loader(true, 'read'),
} as const

export function SafetyCheck({ empty, access }: { empty: boolean; access: 'full' | 'read' }) {
  const load = LOADERS[`${empty ? 'empty' : 'data'}-${access}`]
  return <ClockSafety initial={sampleSafety({ period: 'month', q: '', empty, access })} load={load} />
}
