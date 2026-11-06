'use client'

/**
 * Share a topic with writers from its page (Topic Studio, phase 2): a switch and
 * the link to give them. A writer sees only shared topics, opens the writer
 * workshop and reads the SEO brief. Shown to SEOs only.
 */

import { Switch } from '@/components/ui/Switch'
import { Pill } from '@/components/ui/Pill'
import { BTN } from '@/lib/ui/buttons'
import { editTopic } from '../actions'
import { useTopicCall } from './use-topic-call'

export function ShareControl({ id, shared }: { id: string; shared: boolean }) {
  const { call, busy, say, toast } = useTopicCall()
  async function copy() {
    try { await navigator.clipboard.writeText(`${location.origin}/seo/topic-studio/${id}`); say('Link copied. Writers on the Writers team can open it once the topic is shared.') }
    catch { say('Could not copy the link. Copy it from the address bar instead.', true) }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {toast}
      {shared ? <Pill tone="green" text="Shared with writers" /> : <Pill tone="gray" text="Draft" />}
      <Switch on={shared} label="Shared with writers" disabled={busy} onChange={v => void call(() => editTopic(id, { op: 'share', shared: v }), { ok: r => r.message })} />
      <button type="button" className={BTN.smallWhite} onClick={() => void copy()}>Copy writer link</button>
    </div>
  )
}
