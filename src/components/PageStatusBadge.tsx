/**
 * PageStatusBadge — shows how many languages are confirmed for a page.
 * Green = all done, Yellow = partial, Red = none started.
 */

interface Props {
  confirmed: number
  total: number
}

export function PageStatusBadge({ confirmed, total }: Props) {
  const allDone = confirmed === total
  const started = confirmed > 0

  const cls = allDone
    ? 'bg-green-100 text-green-700'
    : started
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-slate-100 text-slate-500'

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>
      {allDone ? '✓' : `${confirmed}/${total}`}
      {allDone ? ' Done' : ' confirmed'}
    </span>
  )
}
