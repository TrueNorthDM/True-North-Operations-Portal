// Design check: "my priority" beside True North's, on My Work.
//
// Jeannette wrote that none of her 700 rows were "actually my priority tasks
// right now". The idea in September 2026 was two priority views inside the My
// Work tab, one True North's and one the person's own, with the difference
// between them made visible. These are three ways to show that difference, to
// choose from before anything is built. Development only, like every design
// check, and nothing on it is saved. Option B was dropped on 16 September
// 2026; A and C were asked for together, and stay below for comparison.

import { notFound } from 'next/navigation'
import { OptionA, OptionAC, OptionC } from './PriorityMockups'

export const dynamic = 'force-dynamic'

const OPTIONS = [
  {
    key: 'AC',
    title: 'A + C · Agreement summary with ranks',
    blurb: 'C\'s card on top: the agreement score, how many steps moved, and the biggest differences. A\'s list underneath: your rank, True North\'s rank and how far apart they are. Rows two or more places apart are marked on the left in the same colour as their chip.',
    node: <OptionAC />,
  },
  {
    key: 'A',
    title: 'Option A · Ranks side by side',
    blurb: 'For comparison. Two tabs. My priority shows your rank, True North\'s rank and how far you moved each step.',
    node: <OptionA />,
  },
  {
    key: 'C',
    title: 'Option C · Agreement summary',
    blurb: 'For comparison. Your list stays plain, with a card above it: one agreement score and the steps where you and True North differ by two places or more.',
    node: <OptionC />,
  },
]

export default async function PriorityDesignCheck(
  { searchParams }: { searchParams: Promise<{ only?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  // ?only=A (or B, C): one option on its own, for a screenshot that shows it
  // without the other two around it.
  const { only } = await searchParams
  const shown = OPTIONS.filter(o => !only || o.key === only.toUpperCase())
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1100px] mx-auto space-y-10">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">My Work · My priority and True North&apos;s</h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            True North&apos;s order is the one the list already uses: board priority, then the soonest deadline. Use the arrows to move a step and watch the comparison change. Nothing here is saved.
          </p>
        </div>

        {shown.map(o => (
          <section key={o.key} className="space-y-3">
            <div>
              <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0">{o.title}</h2>
              <p className="text-[13.5px] text-muted mt-1 m-0 leading-relaxed">{o.blurb}</p>
            </div>
            {o.node}
          </section>
        ))}
      </div>
    </div>
  )
}
