// Design check: the item History with each step's owner, and your own steps
// marked with your avatar. Three options, asked for on 18 September 2026.
// Side by side by default: B mirrored, the layout chosen, with the three styles
// for another person's name being decided between. ?option= shows one alone.
// Development only; nothing on it is saved.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { HistoryMockup, type Option } from './HistoryMockup'
import { SideBySide } from './SideBySide'

export const dynamic = 'force-dynamic'

const OPTIONS: { key: Option; label: string; blurb: string }[] = [
  { key: 'a', label: 'A. Owner on every line', blurb: 'The timeline as today, with the step owner on the right of each change. Your changes sit on a tinted card with your avatar.' },
  { key: 'b', label: 'B. Grouped by step', blurb: 'One card per step, owner in the header. Your step comes first, open and marked with your avatar; the others show their latest change.' },
  { key: 'b2', label: 'B, mirrored', blurb: "B with other people's cards turned around: the owner on the left, the status and the step on the right, and their latest change aligned right. Your card is unchanged." },
  { key: 'b2-navy', label: '1. Navy button', blurb: 'The name as a navy button with a gold symbol, the palette of Save and close. Strongest; shares navy with your own step.' },
  { key: 'b2-teal', label: '2. Soft teal tag', blurb: 'A filled teal tag, navy name, green symbol. Stands out from the white card without taking navy, so your own step stays the only navy thing in the list.' },
  { key: 'b2-label', label: '3. Owner label', blurb: 'No shape: a small OWNER caption over the name in bold, like the details box at the top. Quietest, and the name is the largest text on the card.' },
  { key: 'c', label: 'C. Owner column', blurb: 'A lane on the left names the owner once for each run of their changes. Your runs are a highlighted band with your avatar.' },
]

const pill = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-[12.5px] font-semibold border ${on ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-[var(--panel-border)] text-tn-ink'}`

export default async function HistoryOwnersDesignCheck(
  { searchParams }: { searchParams: Promise<{ option?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { option } = await searchParams
  const single = OPTIONS.find(x => x.key === option)
  const compared = OPTIONS.filter(x => x.key.startsWith('b2-'))

  const nav = (
    <div className="flex gap-2 mt-3 flex-wrap">
      <Link href="/design-check/history-owners" className={pill(!single)}>Side by side</Link>
      {OPTIONS.map(x => (
        <Link key={x.key} href={`/design-check/history-owners?option=${x.key}`} className={pill(single?.key === x.key)}>{x.label}</Link>
      ))}
    </div>
  )

  if (single) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-[640px] mx-auto space-y-5">
          <div>
            <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
            <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] tracking-tight text-tn-ink m-0">{single.label}</h1>
            <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed m-0">{single.blurb}</p>
            {nav}
          </div>
          <HistoryMockup option={single.key} />
        </div>
      </div>
    )
  }

  // Scaled to fit by default, so all three are in view at once; Actual size
  // puts them at the drawer's real width and lets the row scroll.
  return (
    <div className="min-h-screen bg-background p-8">
      <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · mockup</p>
      <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] tracking-tight text-tn-ink m-0">History: the owner&apos;s name</h1>
      <p className="mt-1.5 text-[13.5px] text-muted leading-relaxed m-0 max-w-[900px]">
        B mirrored, the layout chosen, with three ways to draw another person&apos;s name. Same real item (HFA.ai 04/024), seen by Arnaldo; your own card is the same in all three. The earlier options are still one click away above.
      </p>
      {nav}
      <div className="mt-5">
        <SideBySide
          columns={compared.map(x => ({
            key: x.key,
            head: (
              <div>
                <div className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">{x.label}</div>
                <p className="text-[13px] text-muted leading-snug m-0 mt-0.5">{x.blurb}</p>
              </div>
            ),
            body: <HistoryMockup option={x.key} />,
          }))}
        />
      </div>
    </div>
  )
}
