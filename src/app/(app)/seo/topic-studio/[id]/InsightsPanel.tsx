'use client'

/**
 * What the discussion threads reveal (phase 3): pain points, the readers' own
 * words, questions, misconceptions and angles. Claude reads the threads the SEO
 * captured on the Discussions tab and the result is kept on the topic.
 */

import type { Insights } from '@/lib/topic-studio/ai/results'
import { CARD, CARD_TITLE } from '@/lib/ui/type'
import { AiBtn, NO_AI, type AiInfo } from './AiBtn'

const LISTS: [keyof Omit<Insights, 'at'>, string][] = [['painPoints', 'Pain points'], ['language', 'How readers say it'], ['questions', 'Questions they ask'], ['misconceptions', 'Misconceptions'], ['angles', 'Angles to take']]

export function InsightsPanel({ id, insights, threads, ai = NO_AI }: { id: string; insights: Insights | null; threads: number; ai?: AiInfo }) {
  return (
    <section className={`${CARD} mt-4 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={CARD_TITLE}>What the discussions reveal</h3>
        {threads > 0 ? <AiBtn id={id} feature="insights" ai={ai} label={insights ? 'Summarize again' : 'Summarize with Claude'} done="Claude summarized the discussions." /> : <span className="text-[12.5px] text-muted">Add a discussion thread first.</span>}
      </div>
      {insights ? (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {LISTS.map(([k, label]) => insights[k].length > 0 && (
            <div key={k}><h4 className="m-0 mb-1 text-[12.5px] font-bold text-muted">{label}</h4><ul className="m-0 list-disc pl-5 text-[13px]">{insights[k].map(x => <li key={x}>{x}</li>)}</ul></div>
          ))}
        </div>
      ) : <p className="m-0 mt-2 text-[12.5px] text-muted">Claude reads the threads and pulls out what readers struggle with and how they put it.</p>}
    </section>
  )
}
