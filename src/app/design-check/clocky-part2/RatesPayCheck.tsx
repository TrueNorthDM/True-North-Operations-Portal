'use client'

// 10A-2: Rates & Costs, its own page under People, with Pays as, Allowance and Over (Company
// Settings.dc.html, frame 10A2), the real tab in Edit with the prototype's
// values: Olivia Hale fixed monthly, Cheyenne Wilson 11h 15m over 140h a
// month, Wendy Cacka an employee with 40h a week. The Columns menu works and
// "saves" without the server (design-check/columns starts it with columns hidden).

import { RatesCostsPage } from '@/components/admin/RatesCostsPage'
import type { CadenceActions } from '@/components/person/PersonForms'
import type { PayColumn } from '@/components/tsheets/settings/PeopleTab'
import type { SaveHidden } from '@/lib/settings/columns'
import { idOf, previewCadenceChange, ratesPeople, SEED, setCadence } from '../clocky-periods/sample'

const ACTIONS: CadenceActions = { previewCadenceChange, setCadence }
const BY_PERSON = Object.fromEntries(SEED.map(r => [idOf(r[0]), r[9]]))

const M = (hours: number) => ({ hours, period: 'month' as const })
const PAY: Record<string, Partial<PayColumn['byPerson'][string]>> = {
  'Cheyenne Wilson': { allowance: M(140), overSeconds: 11.25 * 3600 },
  'Justus Tsofa': { allowance: M(170) },
  'Clarise Nixon': { allowance: M(140) },
  'Stephanie Aguirre': { allowance: M(130) },
  'Olivia Hale': { paysAs: 'fixed_monthly', allowance: M(120) },
  'Amy Prindle': { allowance: M(140) },
  'Samuel Manzi': { allowance: M(160) },
  'Wendy Cacka': { isContractor: false, paysAs: null, allowance: { hours: 40, period: 'week' } },
  // Fixed, no timesheet: Timesheet says None.
  'Tina Gennette': { paysAs: 'fixed_no_timesheet' },
}

const payColumn = (): PayColumn => ({
  byPerson: Object.fromEntries(SEED.map(r => [idOf(r[0]), { isContractor: true, paysAs: 'hourly' as const, allowance: null, overSeconds: null, ...PAY[r[0]] }])),
  canEdit: true,
})

/** A save that goes through, a moment later, like the server's. */
const saved: SaveHidden = () => new Promise(done => setTimeout(() => done({ ok: true }), 250))

export function RatesPayCheck({ editing, hidden, saveColumns = saved }: {
  editing: boolean
  /** The Rates & Costs columns hidden at first. */
  hidden?: string[]
  saveColumns?: SaveHidden
}) {
  return (
    <RatesCostsPage
      people={ratesPeople()}
      allClients={[{ id: 1, name: 'i7 Marketing' }]}
      cadence={{ byPerson: BY_PERSON, canEdit: true }}
      pay={payColumn()}
      hiddenColumns={hidden ? { rates: hidden } : {}}
      check={{ cadenceActions: ACTIONS, startEditing: editing, saveColumns }}
    />
  )
}
