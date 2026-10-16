// Design check: Clocky's clock (TB and 1A to 1N), frame by frame, with the
// prototype's data. /design-check/clocky-clock?frame=1E&device=phone, as
// Clock Panel.dc.html?frame=1E&device=phone; &frozen=1 stops the timers.

import { ClockCheck } from './ClockCheck'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') return null
  const sp = await searchParams
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? ''
  const frame = one('frame') || '1A'
  const device = one('device') === 'phone' ? 'phone' : 'desktop'
  return <ClockCheck key={`${frame}-${device}`} frame={frame} device={device} frozen={one('frozen') === '1'} />
}
