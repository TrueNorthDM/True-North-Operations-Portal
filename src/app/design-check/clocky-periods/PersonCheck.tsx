'use client'

// 5B and 5B2: a person's page, Work tab, with the Timesheet section, the real
// PersonPage and the prototype's person (Clarise Nixon, every 2 weeks).

import { PersonPage } from '@/components/person/PersonPage'
import type { CadenceActions } from '@/components/person/PersonForms'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import { currentPeriod, previewCadenceChange, setCadence } from './sample'

const ACTIONS: CadenceActions = { previewCadenceChange, setCadence }

export function PersonCheck({ data, editing }: { data: PersonPageData; editing: boolean }) {
  return (
    <PersonPage
      data={data}
      tab="work"
      canRemove={false}
      timesheet={{
        cadence: 'biweekly',
        currentPeriod: currentPeriod('biweekly'),
        periodIf: { monthly: currentPeriod('monthly'), biweekly: currentPeriod('biweekly') },
        canEdit: true,
        links: { rates: true, settings: true },
      }}
      cadenceActions={ACTIONS}
      startEditing={editing ? 'work' : null}
      startCadence={editing ? 'monthly' : undefined}
    />
  )
}
