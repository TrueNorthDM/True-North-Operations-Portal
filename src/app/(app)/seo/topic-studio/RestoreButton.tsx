'use client'

/** Brings an archived topic back to the topic list (SEO only). */

import { BTN } from '@/lib/ui/buttons'
import { editTopic } from './actions'
import { useTopicCall } from './[id]/use-topic-call'

export function RestoreButton({ id }: { id: string }) {
  const { call, busy, toast } = useTopicCall()
  return (
    <>
      {toast}
      <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => void call(() => editTopic(id, { op: 'archive', archived: false }), { ok: r => r.message })}>Restore</button>
    </>
  )
}
