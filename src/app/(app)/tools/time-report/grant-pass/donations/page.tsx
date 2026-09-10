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
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export const metadata = { title: 'Donation records' }
export const dynamic = 'force-dynamic'

export default async function DonationRecordsPage(
  { searchParams }: { searchParams: Promise<{ year?: string }> },
) {
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/tools')
  if (!access.isPrivileged) redirect('/tools/time-report/grant-pass')

  const { year: raw } = await searchParams
  // Four digits or nothing: a junk parameter shows everything rather than an
  // empty page that looks like the records are gone.
  const year = raw && /^\d{4}$/.test(raw) ? raw : null

  const ledger = await loadDonationLedger(year)

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <Breadcrumb parents={['/tools', '/tools/time-report/grant-pass']} now="Donation records" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink mt-2 mb-1.5">
          Donation records
        </h1>
        <p className="text-muted leading-relaxed max-w-[760px] m-0">
          Every donation figure that has been entered, and every change made to one. Money is recorded
          as a monthly total per project, which is how it arrives: cheques and online donations are
          added up before they are written down, so there is no per-donation date and no donor here.
        </p>
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
