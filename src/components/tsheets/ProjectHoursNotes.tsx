/**
 * What the Project Hours & Others figures mean, behind the round navy "i".
 *
 * Above the toolbar rather than beside the tabs, where the i7 report keeps its
 * own: the questions it answers arrive before somebody reads a cell, and both
 * reports should hide them in the same place.
 */

import { InfoDialog } from '@/components/ui/InfoDialog'

export function ProjectHoursNotes({ lastYear }: { lastYear: string }) {
  return (
    <InfoDialog title="How this report is built" label="How this report is built">
      <p className="m-0">
        <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">Costs here are what a project consumed, not what left the bank.</strong>{' '}
        They are hours × each person&rsquo;s break-even rate. For somebody on the payroll that is an
        attribution: they are paid the same whether they logged ten hours or a hundred.
      </p>
      <p className="m-0">
        <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">The donation funded projects are not billed.</strong>{' '}
        AskAnAdventistFriend.com and Hope for Africa live on donations. i7 and MME are clients: their
        Billed figure is hours times the client rate, as on the i7 invoices, and their net is billed minus
        employee and contractor costs. Grants Pass Church and School are the exception: they buy
        hours in advance at $90, which is what the three balance columns track. The others have no allowance, so those cells are blank rather than zero.
      </p>
      <p className="m-0 text-muted">
        <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">Donations are entered by hand</strong>, from
        cheques and online giving, using <span className="font-semibold">Money in</span> above, as a total
        for the month. Only AskAnAdventistFriend.com and Hope for Africa receive them: the other two are
        client projects that buy hours instead. Whether a gift was restricted or unrestricted is settled in
        accounting before it reaches here, so this report does not show the split. A blank means nothing
        came in that month, unless the month has not ended yet.
      </p>
      {/* Rewritten in September 2026 after Tina read the first version. It said
          Hope for Africa had no job code, which was wrong (Adventist
          Messengers/HFA is one), and it quoted hour gaps measured while the
          report was being built, which had already aged. No figures here now:
          a number in help text goes stale without anybody noticing. */}
      <p className="m-0 text-muted">
        i7 and MME are the i7 job codes, split by the invoice each code bills to. The other four projects
        are identified by the <span className="font-semibold">“2 Project”</span>{' '}
        field on each time entry, not by job code. Hope for Africa has its own job code (Adventist
        Messengers/HFA), but part of its work is logged under True North job codes, such as Project
        Management and Web Dev, with <span className="font-semibold">“2 Project”</span> set to Africa.
        Counting by the field includes those hours.
      </p>
      {/* The one column that compares two different kinds of truth. Saying so
          is cheaper than being asked about it every month. */}
      <p className="m-0 text-muted">
        The <span className="font-semibold">{lastYear}</span> column, the same period a year earlier, is
        recalculated from the timesheets as they are today. If a {lastYear} timesheet was edited after
        the {lastYear} tracking sheet was filled in, the two will not match.
      </p>
    </InfoDialog>
  )
}
