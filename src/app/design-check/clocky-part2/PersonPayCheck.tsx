'use client'

// 10A-1: a person's Work tab with Approvals and Pay and hours (Company
// Settings.dc.html, frame 10A1), the real PersonPage with the prototype's
// person: Cheyenne Wilson, Writers, contractor, reports to Arnaldo Oliveira,
// $22.00 an hour, 140h a month. Nothing saves.

import { PersonPage } from '@/components/person/PersonPage'
import type { PersonPageData } from '@/lib/directory/person-page-data'

export function PersonPayCheck({ data, editing }: { data: PersonPageData; editing: boolean }) {
  return (
    <PersonPage
      data={data}
      tab="work"
      canRemove={false}
      timesheet={{
        cadence: 'monthly',
        currentPeriod: 'November 2026',
        periodIf: { monthly: 'November 2026', biweekly: 'Nov 8 to 21, 2026' },
        canEdit: false,
        links: { rates: true, settings: true },
      }}
      pay={{
        approvals: {
          rows: [
            { k: 'Reports to', v: 'Arnaldo Oliveira', sub: 'Work tab' },
            { k: 'Hours approved by', v: 'Arnaldo Oliveira', sub: 'The person they report to' },
            { k: 'Invoice approved by', v: 'Arnaldo Oliveira', sub: 'Everyone not reporting to Dave Sharpe' },
          ],
          note: 'Same person: one step, Approve both.',
        },
        pay: { isContractor: true, paysAs: 'hourly', hourlyRate: 22, fixedAmount: null, allowance: { hours: 140, period: 'month' }, canEdit: true },
        invoicesLine: 'Made when they submit',
        save: async () => ({ ok: true }),
        startEditing: editing,
      }}
    />
  )
}
