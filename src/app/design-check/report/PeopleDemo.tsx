'use client'

// The People table with a working drawer, for the preview only.
//
// The fetch is faked with a delay so screen 5.2 is reachable: without one the
// loading state is a single frame nobody can look at, and it is the state
// most likely to be got wrong.

import { ReportPeople, type PersonRow } from '@/components/report/ReportPeople'
import type { PersonDetail } from '@/lib/report/drawer'

const DETAIL: Record<string, PersonDetail> = {
  '1': {
    totalDeliveries: 42,
    deliveries: [
      { id: 'a', item: 'SEO Bi-Weekly Company Report, Aug 4 2026', step: 'Write', heldDays: 3, lateDays: null },
      { id: 'b', item: 'SEO Bi-Weekly Company Report, Jul 21 2026', step: 'Write', heldDays: 6, lateDays: 2 },
      { id: 'c', item: 'Q2 backlink audit', step: 'Review', heldDays: 2, lateDays: null },
      { id: 'd', item: 'i7 Monthly Report, Jul billing', step: 'Write', heldDays: 11, lateDays: 5 },
    ],
    hours: [
      { project: 'i7 Marketing', hours: 146 },
      { project: 'SEO Sprints', hours: 128 },
      { project: 'AAAF', hours: 74 },
      { project: 'Internal', hours: 36 },
    ],
  },
}

const EMPTY: PersonDetail = { totalDeliveries: 0, deliveries: [], hours: [] }

export function PeopleDemo({ people }: { people: PersonRow[] }) {
  const loadDetail = (id: string) =>
    new Promise<PersonDetail>(resolve => setTimeout(() => resolve(DETAIL[id] ?? EMPTY), 900))

  return <ReportPeople people={people} periodDays={90} loadDetail={loadDetail} />
}
