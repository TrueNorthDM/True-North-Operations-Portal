// Rates & Costs, the per-person rate grid, moved here from Settings → People &
// rates. Person / team / report-to / joined-on are read-only (from the People
// tab); Rate / client and Rate / cost are edited inline and saved via the
// tr_assignments + people.internal_rate actions inside PeopleTab. Timesheet
// (Clocky, 16 October 2026) is how each person submits their hours, the same
// setting as their page's Work tab.

import type { ComponentProps } from 'react'
import { PeopleTab, type CadenceColumn, type PersonWithAssignments } from '@/components/tsheets/settings/PeopleTab'

type CheckProps = Pick<ComponentProps<typeof PeopleTab>, 'cadenceActions' | 'startEditing' | 'startCadences' | 'startDialog'>

export function RatesCostsTab({ people, allClients, cadence = null, check }: {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
  /** The Timesheet column, for whoever opens Company settings > Timesheet periods. */
  cadence?: CadenceColumn | null
  /** Design check only: answers and a state to open in. */
  check?: CheckProps
}) {
  return (
    <div className="space-y-5">
      <p className={`text-[13.5px] text-muted leading-relaxed ${cadence ? 'max-w-[820px]' : 'max-w-[720px]'}`}>
        Everyone who logs time on i7. Person, team, report-to and joined-on come from the <b className="text-foreground font-bold">People</b> tab; here you set <b className="text-foreground font-bold">Rate / client</b> (what the client is billed per hour) and <b className="text-foreground font-bold">Rate / cost</b> (what the hour costs internally) and <b className="text-foreground font-bold">Rate / break-even</b> (what it has to earn to cover them, overhead included).
        {cadence && <> <b className="text-foreground font-bold">Timesheet</b> is how often the person submits hours: monthly or every 2 weeks; it is the same setting as on their page.</>}
      </p>
      <PeopleTab people={people} allClients={allClients} cadence={cadence} {...check} />
    </div>
  )
}
