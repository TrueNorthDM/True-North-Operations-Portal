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
        <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">Nothing here is billed.</strong>{' '}
        These projects are donation funded. Grants Pass Church and School are the exception: they buy
        hours in advance at $90, which is what the three balance columns track. The other two have no
        allowance, so those cells are blank rather than zero.
      </p>
      <p className="m-0 text-muted">
        <strong className="font-(family-name:--font-display) font-extrabold text-tn-ink">Donations are entered by hand</strong>, from
        cheques and online giving, using <span className="font-semibold">Money in</span> above. A donation
        a donor ties to a project sits on that project&rsquo;s row; one given without a project sits on the
        Unrestricted row, because it belongs to none of the four. A blank means nobody has entered a figure,
        not that nothing came in.
      </p>
      <p className="m-0 text-muted">
        All four projects are recognised by the <span className="font-semibold">“2 Project”</span>{' '}
        field on each entry. Hope for Africa in particular is not a job code: its work sits under two
        different ones and only the project value joins them, which is why counting by job code came
        out 120 to 190 hours short every month.
      </p>
      {/* The one column that compares two different kinds of truth. Saying so
          is cheaper than being asked about it every month. */}
      <p className="m-0 text-muted">
        The <span className="font-semibold">{lastYear} same period</span> column is computed from the
        timesheets as they stand today, so it can differ from what the {`${lastYear} tracking sheet`}{' '}
        said at the time: a year of corrections and retroactive approvals sits between them. Across the
        months that were checked the gap ran from four hours over to eighty-seven under.
      </p>
    </InfoDialog>
  )
}
