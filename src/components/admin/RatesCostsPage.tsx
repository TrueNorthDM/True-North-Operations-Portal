'use client'

// Rates & Costs, the per-person rate grid, its own page under People since the
// part 2 handoff (Company Settings.dc.html 10A-2, owner 2026-10-23): the
// breadcrumb, the title and Edit (or Cancel and Save changes) at the top, no
// text under the title (owner), the table, and what "Over" means under it. Person / team / report-to / joined-on
// are read-only (from Directory); the rates are edited inline and saved via
// the tr_assignments + people.internal_rate actions inside PeopleTab. Timesheet
// (Clocky, 16 October 2026) is how each person submits their hours, the same
// setting as their page's Work tab. Columns (owner, 25 October 2026): each
// person hides the columns they do not need, kept in their account.

import type { ComponentProps } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PeopleTab, type CadenceColumn, type PayColumn, type PersonWithAssignments } from '@/components/tsheets/settings/PeopleTab'
import { useColumnChoices } from '@/components/ui/ColumnsMenu'
import { saveHiddenColumns } from '@/app/(app)/settings/actions'
import type { HiddenColumns, SaveHidden } from '@/lib/settings/columns'

export type CheckProps = Pick<ComponentProps<typeof PeopleTab>, 'cadenceActions' | 'startEditing' | 'startCadences' | 'startDialog'> & {
  /** Saves the Columns choice without the server. */
  saveColumns?: SaveHidden
}

export function RatesCostsPage({ people, allClients, cadence = null, pay = null, hiddenColumns = {}, check }: {
  people: PersonWithAssignments[]
  allClients: { id: number; name: string }[]
  /** Pays as, Allowance and Over (Clocky part 2, 10A-2). */
  pay?: PayColumn | null
  /** The Timesheet column, for whoever opens Company settings > Timesheet periods. */
  cadence?: CadenceColumn | null
  /** The columns this person hides, as their account keeps them (read on the server, so the first paint has them). */
  hiddenColumns?: HiddenColumns
  /** Design check only: answers and a state to open in. */
  check?: CheckProps
}) {
  const { saveColumns = saveHiddenColumns, ...tabCheck } = check ?? {}
  const columns = useColumnChoices(hiddenColumns, saveColumns)
  return (
    <div className="flex flex-col gap-4">
      <PeopleTab people={people} allClients={allClients} cadence={cadence} pay={pay} {...tabCheck} columns={columns('rates')} head={actions => (
        <div className="flex items-end justify-between gap-3.5 flex-wrap mb-[18px]">
          {/* On a phone the words take the row and the buttons go under them. */}
          <div className="min-w-0 basis-full md:basis-auto md:flex-1">
            <Breadcrumb parents={['/directory']} now="Rates & Costs" />
            <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink leading-[normal]" style={{ letterSpacing: '-.01em' }}>Rates &amp; Costs</h1>
          </div>
          <div className="ml-auto">{actions}</div>
        </div>
      )} />
      {pay && <p className="m-0 text-[12px] text-muted leading-[1.5]">&quot;Over&quot; is this period, before approved extra hours. Extra hours are asked in Requests and decided on Approvals.</p>}
    </div>
  )
}
