// Design check: every change of order as a band, against the middle ground
// (a stretch under 10 steps stays inside its neighbour), side by side. Asked
// for on 18 September 2026. Real data. Development only.

import { notFound } from 'next/navigation'
import { FitWidth } from '../../order-clarity/FitWidth'
import { BandedList } from '../BandedList'
import { JEANNETTE_ALL } from '../lists'
import { TEAM_ROWS } from '../team-runs'

export const dynamic = 'force-dynamic'

const MIN = 10

function Head({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <div className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{title}</div>
      <p className="text-[12.5px] text-muted leading-snug m-0 mt-0.5">{note}</p>
    </div>
  )
}

export default async function OrderBandsCompare(
  { searchParams }: { searchParams: Promise<{ open?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  // Collapsed by default, so the two maps and their bands sit side by side on
  // one screen; ?open=1 starts every band open.
  const startCollapsed = (await searchParams).open !== '1'
  return (
    <div className="min-h-screen bg-background p-8 space-y-5">
      <div>
        <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] tracking-tight text-tn-ink m-0">Five bands, or the middle ground?</h1>
        <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed m-0 max-w-[1000px]">
          {`Jeannette's real list, both ways. Left: a band every time the list changes order. Right: a stretch under ${MIN} steps stays inside the band around it; its rows keep their pin, the band header counts them, and the bar marks them as small ticks. Click a band to open it. Arnaldo's list is a single band either way.`}
        </p>
      </div>
      <FitWidth width={1264}>
        <div className="grid grid-cols-[620px_620px] gap-6 items-start">
          <Head title="Every change of order is a band" note="Jeannette: 5 bands. The exact order, stretch by stretch." />
          <Head title="The middle ground" note={`Jeannette: 2 bands. Stretches under ${MIN} steps stay inside their neighbour, still marked row by row.`} />
          <BandedList rows={JEANNETTE_ALL} who="Jeannette Owens" leader="Jeannette Owens" compact startCollapsed={startCollapsed} />
          <BandedList rows={JEANNETTE_ALL} who="Jeannette Owens" leader="Jeannette Owens" compact startCollapsed={startCollapsed} minBand={MIN} />
          <div className="col-span-2 pt-4">
            <Head title="Edit priority: the map over the whole team" note="777 steps. Left: 12 stretches. Right: the same order in 2 bands, the 22 steps of the other kind shown as ticks and marked in their rows." />
          </div>
          <BandedList rows={TEAM_ROWS} who="SEO" leader="the team" mapOnly placedLabel="190 placed by hand" />
          <BandedList rows={TEAM_ROWS} who="SEO" leader="the team" mapOnly placedLabel="190 placed by hand" minBand={MIN} />
        </div>
      </FitWidth>
    </div>
  )
}
