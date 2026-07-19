// Rates & Costs, the per-person rate grid, moved here from Settings → People &
// rates. Person / team / report-to / joined-on are read-only (from the People
// tab); Rate / client and Rate / cost are edited inline and saved via the
// tr_assignments + people.internal_rate actions inside PeopleTab.

import { PeopleTab, type PersonWithAssignments } from '@/components/tsheets/settings/PeopleTab'

export function RatesCostsTab({ people, allClients }: { people: PersonWithAssignments[]; allClients: { id: number; name: string }[] }) {
  return (
    <div className="space-y-5">
      <p className="text-[13.5px] text-muted max-w-[720px] leading-relaxed">
        Everyone who logs time on i7. Person, team, report-to and joined-on come from the <b className="text-foreground font-bold">People</b> tab; here you set <b className="text-foreground font-bold">Rate / client</b> (what the client is billed per hour) and <b className="text-foreground font-bold">Rate / cost</b> (what the hour costs internally).
      </p>
      <PeopleTab people={people} allClients={allClients} />
    </div>
  )
}
