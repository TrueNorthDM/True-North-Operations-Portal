// Client Report, Grant Pass.
//
// Its own page and its own tool grant ('grant-pass-report'), not a tab beside
// i7. One permission per client: whoever is trusted with one client's hours and
// budget has not thereby been trusted with every client added later.
//
// The body was a placeholder for months because nobody knew where these hours
// were. Counting settled it: until 2022 they were tagged with the GP Church and
// GP School job codes, which were later deactivated, and since 2023 with the
// "2 Project" field. Both are read here, and no entry carries both, so the union
// is the client's history without double counting.
//
// My earlier guess that they were values of "1 - i7 Code" was wrong. It is
// "2 Project".

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { loadGrantPassData } from '@/lib/timeclock/grant-pass'
import { GrantPassReport } from '@/components/tsheets/GrantPassReport'

export const metadata = { title: 'Client Report · Grant Pass' }
export const dynamic = 'force-dynamic'

export default async function GrantPassReportPage() {
  // The area comes from the level, the client from its own team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/tools')

  const supabase = await createClient()
  const data = await loadGrantPassData(supabase)

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-tn-ink transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-foreground font-semibold">Client Report · Grant Pass</span>
        </div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
          Client Report · Grant Pass
        </h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          Every hour logged for Grant Pass, Church and School, since 2017.
        </p>
      </div>

      <GrantPassReport data={data} />
    </div>
  )
}
