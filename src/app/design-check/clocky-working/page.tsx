// Design check: Who's working (2A to 2P), frame by frame, with the
// prototype's data. /design-check/clocky-working?frame=2A, as
// Who's Working.dc.html?frame=2A; &frozen=1 stops the timers.

import { WorkingCheck } from './WorkingCheck'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') return null
  const sp = await searchParams
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? ''
  const frame = one('frame') || '2A'
  return <WorkingCheck key={frame} frame={frame} frozen={one('frozen') === '1'} bare={one('bare') === '1'} />
}
