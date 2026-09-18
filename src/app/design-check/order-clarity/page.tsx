// Design check: which order a row follows, the team's or True North's, on
// both screens. Three options, asked for on 18 September 2026. ?option=1, 2
// or 3. Development only; nothing on it is saved.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { OrderClarity, type Option } from './OrderClarity'
import { FitWidth } from './FitWidth'

export const dynamic = 'force-dynamic'

const OPTIONS: { key: Option; label: string; blurb: string }[] = [
  { key: '1', label: '1. Marks', blurb: "Every row carries a mark: a navy pin when the leader placed it by hand, a teal compass when it follows True North's order, and True North's number under the team's." },
  { key: '2', label: '2. Bands', blurb: 'The list is split where it changes from one order to the other, and each band says which order it is and why a step sits where it does.' },
  { key: '4', label: '4. Marks + bands', blurb: 'Options 1 and 2 together: the bands say which order a stretch of the list follows and why, and every row still carries its pin or compass and True North\'s number.' },
  { key: '3', label: '3. Track', blurb: "A small line on every row from True North's place to the team's place: solid navy when moved by hand, dashed grey when pushed down by steps placed above." },
]

export default async function OrderClarityDesignCheck(
  { searchParams }: { searchParams: Promise<{ option?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { option } = await searchParams
  const o = OPTIONS.find(x => x.key === option) ?? OPTIONS[0]
  return (
    <div className="min-h-screen bg-background p-8 space-y-6">
      <div>
        <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] tracking-tight text-tn-ink m-0">Team order or True North&apos;s order?</h1>
        <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed m-0 max-w-[980px]">
          The SEO team today, from production: 777 open steps, the first 169 all placed by hand, so True North&apos;s #1 is the team&apos;s #170, and Arnaldo&apos;s first step (True North&apos;s #80) is the team&apos;s #203. Three ways to make that visible, each on My Work and in the editor.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {OPTIONS.map(x => (
            <Link key={x.key} href={`/design-check/order-clarity?option=${x.key}`} className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold border ${x.key === o.key ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-[var(--panel-border)] text-tn-ink'}`}>
              {x.label}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-tn-ink leading-relaxed m-0 max-w-[980px]"><b>{o.label}.</b> {o.blurb}</p>
      </div>
      <FitWidth width={1240}>
        <OrderClarity option={o.key} />
      </FitWidth>
    </div>
  )
}
