// Design check: the loading skeleton every (app) page shows on a click.
//
// The real component, in the padding MainContent gives every page, beside the
// page it stands in for, so the two can be compared for where the eye lands.
// The live one is only ever on screen for a moment between a click and the data.

import { PageSkeleton } from '@/components/ui/PageSkeleton'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export default function PageSkeletonDesignCheck() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)]">
      <div className="px-6 py-8 space-y-12">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Page skeleton</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            Above: the skeleton. Below: the top of a real page it stands in for.
          </p>
        </div>

        <section className="rounded-2xl border border-dashed border-slate-300 p-6">
          <PageSkeleton />
        </section>

        <section className="rounded-2xl border border-dashed border-slate-300 p-6 space-y-6">
          <div className="min-w-0">
            <Breadcrumb parents={['/work-tools']} self="/work-tools/time-report/grant-pass" />
            <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
              Client Report · Project Hours &amp; Others
            </h1>
            <p className="mt-1.5 text-muted leading-relaxed">
              AskAnAdventistFriend.com, Grants Pass Church and School, and Hope for Africa.
            </p>
          </div>
          <div className="rounded-[14px] border border-slate-200 bg-white p-5 text-muted">The report table sits here.</div>
        </section>
      </div>
    </div>
  )
}
