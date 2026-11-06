'use client'

/**
 * A Claude button (phase 3, 6 November 2026). It asks the server to run one
 * feature, shows that it is working (a call can take a minute), and says what
 * happened in the portal's toast. Until the Anthropic key is on the server, or
 * when an Admin has switched the feature off, it rests and says why.
 */

import { BTN } from '@/lib/ui/buttons'
import type { PromptKey } from '@/lib/topic-studio/ai/prompt-defs'
import { runAi } from '../actions-ai'
import { useTopicCall } from './use-topic-call'

export interface AiInfo { connected: boolean; on: Partial<Record<PromptKey, boolean>> }
export const NO_AI: AiInfo = { connected: false, on: {} }

export function AiBtn({ id, feature, ai, label, working = 'Claude is working…', done, tone = 'white', onDone }: {
  id: string
  feature: PromptKey
  ai: AiInfo
  label: string
  working?: string
  done: string
  tone?: 'white' | 'navy'
  onDone?: () => void
}) {
  const { call, busy, toast } = useTopicCall()
  const off = ai.on[feature] === false
  const rest = !ai.connected || off
  const why = !ai.connected ? 'Claude is not connected yet. An Admin needs to add the Anthropic key.' : off ? 'An Admin has switched this feature off.' : ''

  async function go() {
    const r = await call(() => runAi(id, feature), { ok: done, fail: 'Claude could not be reached. Try again in a moment.' })
    if (r) onDone?.()
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {toast}
      <button type="button" className={`${tone === 'navy' ? BTN.smallNavy : BTN.smallWhite} ${rest ? 'opacity-60' : ''}`} disabled={busy || rest} title={why || undefined} aria-busy={busy} onClick={() => void go()}>
        {busy ? working : label}
      </button>
      {why && <span className="text-[11.5px] text-muted">{!ai.connected ? 'Not connected yet' : 'Switched off'}</span>}
    </span>
  )
}
