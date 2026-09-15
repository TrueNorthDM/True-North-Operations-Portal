// Design check: three ways to set "my priority" beside True North's, on My Work.
//
// Jeannette wrote that none of her 700 rows were "actually my priority tasks
// right now". The idea in September 2026 was two priority views inside the My
// Work tab, one True North's and one the person's own, with the difference
// between them made visible. These are three ways to show that difference, to
// choose from before anything is built. Development only, like every design
// check, and nothing on it is saved.

import { notFound } from 'next/navigation'
import { OptionA, OptionB, OptionC } from './PriorityMockups'

export const dynamic = 'force-dynamic'

const OPTIONS = [
  {
    key: 'A',
    title: 'Option A · Ranks side by side',
    blurb: 'Two tabs. My priority shows your rank, True North\'s rank and how far you moved each step. The most direct, and the most numbers on screen.',
    node: <OptionA />,
  },
  {
    key: 'B',
    title: 'Option B · Compare view',
    blurb: 'Your list stays plain. A Compare tab draws both orders with a line per step, teal where you put it higher and amber where you put it lower. The fastest to read at a glance; it gets busy past a dozen steps.',
    node: <OptionB />,
  },
  {
    key: 'C',
    title: 'Option C · Agreement summary',
    blurb: 'Your list stays plain, with a card above it: one agreement score and the steps where you and True North differ by two places or more. The quietest, and the easiest to talk through with a team leader.',
    node: <OptionC />,
  },
]

export default function PriorityDesignCheck() {
  if (process.env.NODE_ENV === 'production') notFound()
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

        {OPTIONS.map(o => (
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
