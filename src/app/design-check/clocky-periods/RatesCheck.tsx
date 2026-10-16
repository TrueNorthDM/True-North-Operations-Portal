'use client'

// 5C, 5C2 and 5C3: Directory > Rates & Costs with the Timesheet column, the
// real tab and the prototype's fifteen people.

import { RatesCostsTab } from '@/components/admin/RatesCostsTab'
import type { CadenceActions } from '@/components/person/PersonForms'
import { CHANGED, changedItems, idOf, previewCadenceChange, ratesPeople, SEED, setCadence } from './sample'

const ACTIONS: CadenceActions = { previewCadenceChange, setCadence }
const BY_PERSON = Object.fromEntries(SEED.map(r => [idOf(r[0]), r[9]]))

export function RatesCheck({ frame }: { frame: string }) {
  const editing = frame === '5C2' || frame === '5C3'
  return (
    <RatesCostsTab
      people={ratesPeople()}
      allClients={[{ id: 1, name: 'i7 Marketing' }]}
      cadence={{ byPerson: BY_PERSON, canEdit: true }}
      check={{
        cadenceActions: ACTIONS,
        startEditing: editing,
        startCadences: editing ? CHANGED : undefined,
        startDialog: frame === '5C3' ? changedItems() : null,
      }}
    />
  )
}
