/**
 * Where the donation records live.
 *
 * The report shows what came in; this shows what was entered. Asked where these
 * records were kept, the honest answer was that they were only ever visible as
 * a total on a report, one month at a time, and that a correction overwrote the
 * previous figure without leaving anything behind. This is that place.
 *
 * Gated tighter than the report it belongs to. The report's own grant decides
 * who may read the figures; this page also asks for the privileged tier,
 * because it is the screen for the person who maintains them and it names who
 * changed what. Admins and the Admin Assistant, which is the same pair that may
 * write them.
 */

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { loadDonationLedger } from '@/lib/timeclock/donations-ledger'
import { DonationRecords } from '@/components/tsheets/DonationRecords'
import Link from 'next/link'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { ROUTES } from '@/lib/nav/routes'

export const metadata = { title: 'Donation records' }
export const dynamic = 'force-dynamic'

export default async function DonationRecordsPage(
  { searchParams }: { searchParams: Promise<{ year?: string }> },
) {
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/')
  if (!access.isPrivileged) redirect(ROUTES.projectHours)

  const { year: raw } = await searchParams
  // Four digits or nothing: a junk parameter shows everything rather than an
  // empty page that looks like the records are gone.
  const year = raw && /^\d{4}$/.test(raw) ? raw : null

  const ledger = await loadDonationLedger(year)

  return (
    // The shell the report next door uses, exactly. MainContent already gives
    // every page px-6 py-8 across the full width, so a page that adds its own
    // padding and a max-width gets both twice over and sits in a 1200px column
    // on a screen with room for far more.
    <div className="space-y-6">
      {/* The way back sits beside the title rather than under it. The trail
          above already links the report, but a trail is where you are, not a
          way out, and this is a side road you come back from. */}
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="min-w-0">
          <Breadcrumb parents={[ROUTES.clientReports, ROUTES.projectHours]} now="Donation records" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
            Donation records
          </h1>
          {/* One line on a normal screen. Nothing constrains its width, so it
              breaks at the edge of the display and nowhere else, but a sentence
              long enough to wrap twice at 1500px is a sentence, not a subtitle. */}
          <p className="mt-1.5 text-muted leading-relaxed">
            Every donation figure entered, and every change made to one. Money arrives as a monthly
            total per project, so there is no per-donation date and no donor here.
          </p>
        </div>

        <Link
          href={ROUTES.projectHours}
          className={`${BTN.white} shrink-0 whitespace-nowrap`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to report
        </Link>
      </div>

      <DonationRecords
        entries={ledger.entries}
        log={ledger.log}
        years={ledger.years}
        year={year}
        logMissing={ledger.logMissing}
        canEdit={access.isPrivileged}
      />
    </div>
  )
}
