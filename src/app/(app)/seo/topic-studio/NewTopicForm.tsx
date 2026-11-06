'use client'

/**
 * Start a topic brief (Topic Studio, phase 1): the client, the Monday task name
 * and the primary keyphrase, then on to Setup for the rest.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { LabeledSelect } from '@/components/clocky/entries/ui'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { INPUT } from '@/lib/ui/fields'
import { CARD, FIELD_LABEL, SECTION_TITLE } from '@/lib/ui/type'
import { topicStudioTopic } from '@/lib/nav/routes'
import { createTopic } from './actions'
import { useTopicCall } from './[id]/use-topic-call'

export function NewTopicForm({ clients }: { clients: { code: string; name: string }[] }) {
  const router = useRouter()
  const { call, busy, toast } = useTopicCall()
  const [client, setClient] = useState(clients[0]?.code ?? '')
  const [topic, setTopic] = useState('')
  const [primary, setPrimary] = useState('')

  async function create() {
    const r = await call(() => createTopic({ client, topic, primary }), { refresh: false })
    if (r) router.push(withViewAs(`${topicStudioTopic(r.id)}?tab=setup`))
  }
  const field = 'min-w-0'

  return (
    <section className={`${CARD} p-5`}>
      {toast}
      <h2 className={`${SECTION_TITLE} mb-3.5`}>Start a topic brief</h2>
      <form className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1.2fr_auto]" onSubmit={e => { e.preventDefault(); void create() }}>
        <LabeledSelect label="Client" value={client} options={clients.map(c => ({ value: c.code, label: `${c.code} · ${c.name}` }))} onChange={setClient} disabled={busy} />
        <div className={field}>
          <label htmlFor="n-topic" className={`${FIELD_LABEL} mb-1.5 block`}>Monday task name</label>
          <input id="n-topic" className={`${INPUT} w-full`} value={topic} maxLength={300} placeholder="How can I stop feeling guilty about my past mistakes?" onChange={e => setTopic(e.target.value)} />
        </div>
        <div className={field}>
          <label htmlFor="n-primary" className={`${FIELD_LABEL} mb-1.5 block`}>Primary keyphrase</label>
          <input id="n-primary" className={`${INPUT} w-full`} value={primary} maxLength={300} placeholder="how to get over guilt" onChange={e => setPrimary(e.target.value)} />
        </div>
        <button type="submit" className={`${BTN.navy} justify-center`} disabled={busy || !client || !topic.trim() || !primary.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Create brief
        </button>
      </form>
    </section>
  )
}
