'use client'

// 10A-1: a person's Work tab with Approvals and Pay and hours (Company
// Settings.dc.html, frame 10A1), the real PersonPage with the prototype's
// person: Cheyenne Wilson, Writers, contractor, reports to Arnaldo Oliveira,
// $22.00 an hour, 140h a month. Nothing saves.

import { PersonPage } from '@/components/person/PersonPage'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import type { TypeChangeView } from '@/components/person/TypeChange'
import type { ApprovalsView, PayView } from '@/components/person/PayApprovalsSections'

type PaySample = { approvals: ApprovalsView; pay: PayView; invoicesLine: string; /** 10A-4: every 2 weeks from Dec 1. */ scheduled?: boolean }

// Cheyenne Wilson's (10A-1); Rock Kai brings his own (10A-3, 10A-4).
const CHEYENNE: PaySample = {
  approvals: {
    rows: [
      { k: 'Reports to', v: 'Arnaldo Oliveira', sub: 'Work tab' },
      { k: 'Hours approved by', v: 'Arnaldo Oliveira', sub: 'The person they report to' },
      { k: 'Invoice approved by', v: 'Arnaldo Oliveira', sub: 'Everyone not reporting to Dave Sharpe' },
    ],
    note: 'Same person: one step, Approve both.',
  },
  pay: { isContractor: true, paysAs: 'hourly', hourlyRate: 22, fixedAmount: null, allowance: { hours: 140, period: 'month' }, timeOff: 'Contractors do not ask PTO', canEdit: true },
  invoicesLine: 'Made when they submit',
}

export function PersonPayCheck({ data, editing, typeChange = null, sample = CHEYENNE }: { data: PersonPageData; editing: boolean; typeChange?: TypeChangeView | null; sample?: PaySample }) {
  return (
    <PersonPage
      data={data}
      tab="work"
      canRemove={false}
      timesheet={{
        cadence: sample.scheduled ? 'biweekly' : 'monthly',
        until: sample.scheduled ? { cadence: 'monthly', from: '2026-12-01' } : null,
        currentPeriod: 'November 2026',
        periodIf: { monthly: 'November 2026', biweekly: 'Nov 8 to 21, 2026' },
        canEdit: false,
        links: { rates: true, settings: true },
      }}
      pay={{
        approvals: sample.approvals,
        pay: sample.pay,
        invoicesLine: sample.invoicesLine,
        save: async () => ({ ok: true }),
        startEditing: editing,
        typeChange,
        typeApi: {
          schedule: async () => ({ ok: true, toast: 'Scheduled. Rock Kai becomes an employee on Tue, Dec 1, 2026. Dave Sharpe and Finance were told.' }),
          cancel: async () => ({ ok: true, toast: 'Change cancelled. Rock Kai stays a contractor.' }),
        },
      }}
    />
  )
}
