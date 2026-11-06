'use client'

/**
 * The Claude settings form: one save for everything on the page. Each feature
 * has a switch, a model and an effort; the prompts open one at a time with the
 * default beside them and a way back to it. The server checks the prompts again.
 */

import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { BTN } from '@/lib/ui/buttons'
import { INPUT, TEXTAREA } from '@/lib/ui/fields'
import { CARD, CARD_TITLE, FIELD_LABEL, TH } from '@/lib/ui/type'
import { PROMPT_DEFS, PROMPT_ORDER, type PromptKey } from '@/lib/topic-studio/ai/prompt-defs'
import { EFFORTS, MODEL_CHOICES, type AiSettings, type Effort } from '@/lib/topic-studio/ai/settings'
import type { UsageLine } from '@/lib/topic-studio/ai/store'
import { saveAiSettings } from '../actions-settings'
import { useTopicCall } from '../[id]/use-topic-call'

const effortOpts = EFFORTS.map(e => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))
const num = (v: string, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)))

export function SettingsForm({ ai, connected, usage }: { ai: AiSettings; connected: boolean; usage: UsageLine[] }) {
  const { call, busy, toast } = useTopicCall()
  const [s, setS] = useState<AiSettings>(ai)
  const [open, setOpen] = useState<PromptKey | null>(null)
  const modelOpts = (cur: string) => [...MODEL_CHOICES.map(m => ({ value: m.id, label: m.label })), ...(MODEL_CHOICES.some(m => m.id === cur) ? [] : [{ value: cur, label: cur }])]
  const feat = (k: PromptKey, patch: Partial<AiSettings['features'][PromptKey]>) => setS(x => ({ ...x, features: { ...x.features, [k]: { ...x.features[k], ...patch } } }))
  const prompt = (k: PromptKey) => s.prompts[k] ?? PROMPT_DEFS[k].template
  const setPrompt = (k: PromptKey, text: string) => setS(x => { const p = { ...x.prompts }; if (text === PROMPT_DEFS[k].template) delete p[k]; else p[k] = text; return { ...x, prompts: p } })

  return (
    <div className="space-y-4">
      {toast}
      <section className={`${CARD} p-4`}>
        <h2 className={CARD_TITLE}>Connection</h2>
        <p className="m-0 mt-1 text-[13px] text-muted">
          {connected ? 'Claude is connected. The key is kept on the server and never shown here.' : 'Claude is not connected yet. The Anthropic key (ANTHROPIC_API_KEY) must be added to the server, then the buttons wake up.'}
        </p>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className={CARD_TITLE}>Limits</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className={FIELD_LABEL}>Runs per person per day</span><input className={`${INPUT} mt-1 w-full`} inputMode="numeric" value={s.dailyCap} onChange={e => setS(x => ({ ...x, dailyCap: num(e.target.value, 1000) }))} /><span className="text-[12px] text-muted">Super Admins are not limited.</span></label>
          <label className="block"><span className={FIELD_LABEL}>Seconds before the same feature runs again</span><input className={`${INPUT} mt-1 w-full`} inputMode="numeric" value={s.cooldownSec} onChange={e => setS(x => ({ ...x, cooldownSec: num(e.target.value, 600) }))} /></label>
          <div><span className={FIELD_LABEL}>Highest effort allowed</span><div className="mt-1"><Select ariaLabel="Highest effort allowed" fullWidth value={s.maxEffort} options={effortOpts} onChange={v => setS(x => ({ ...x, maxEffort: v as Effort }))} /></div></div>
        </div>
        <label className="mt-4 block"><span className={FIELD_LABEL}>Models that may not be used (words, separated by commas)</span><input className={`${INPUT} mt-1 w-full`} value={s.blockedModels.join(', ')} onChange={e => setS(x => ({ ...x, blockedModels: e.target.value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) }))} /></label>
      </section>

      <section className={`${CARD} overflow-x-auto`}>
        <h2 className={`${CARD_TITLE} px-4 pt-4`}>Claude features</h2>
        <table className="mt-2 w-full border-collapse text-[13px]">
          <thead><tr><th className={TH}>Feature</th><th className={TH}>On</th><th className={TH}>Model</th><th className={TH}>Effort</th><th className={TH}>Prompt</th></tr></thead>
          <tbody>
            {PROMPT_ORDER.map(k => (
              <tr key={k} className="border-t border-[var(--row-rule)]">
                <td className="px-4 py-2.5"><b className="text-tn-ink">{PROMPT_DEFS[k].title}</b><span className="block text-[12px] text-muted">{PROMPT_DEFS[k].tab}</span></td>
                <td className="px-4 py-2.5"><Switch on={s.features[k].on} label={`${PROMPT_DEFS[k].title} on`} onChange={v => feat(k, { on: v })} /></td>
                <td className="min-w-[230px] px-4 py-2.5"><Select ariaLabel={`${PROMPT_DEFS[k].title} model`} fullWidth value={s.features[k].model} options={modelOpts(s.features[k].model)} onChange={v => feat(k, { model: v })} /></td>
                <td className="min-w-[120px] px-4 py-2.5"><Select ariaLabel={`${PROMPT_DEFS[k].title} effort`} fullWidth value={s.features[k].effort} options={effortOpts} onChange={v => feat(k, { effort: v as Effort })} /></td>
                <td className="px-4 py-2.5"><button type="button" className={BTN.link} onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Close' : s.prompts[k] ? 'Edit (changed)' : 'Edit'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open && (
        <section className={`${CARD} p-4`}>
          <h2 className={CARD_TITLE}>Prompt: {PROMPT_DEFS[open].title}</h2>
          <p className="m-0 mt-1 text-[12.5px] text-muted">{PROMPT_DEFS[open].does}</p>
          <p className="m-0 mt-2 text-[12.5px] text-muted">Data the prompt can use: {PROMPT_DEFS[open].vars.map(([n, d, r]) => <span key={n}><code>{`{{${n}}}`}</code> {d}{r ? ' (required)' : ''}; </span>)}</p>
          <textarea className={`${TEXTAREA} mt-3 min-h-[320px] w-full font-mono`} aria-label="Prompt text" value={prompt(open)} onChange={e => setPrompt(open, e.target.value)} />
          <div className="mt-2"><button type="button" className={BTN.smallWhite} disabled={!s.prompts[open]} onClick={() => setPrompt(open, PROMPT_DEFS[open].template)}>Restore the default</button></div>
        </section>
      )}

      <div><button type="button" className={BTN.navy} disabled={busy} onClick={() => void call(() => saveAiSettings(s), { ok: 'Settings saved.', refresh: false })}>Save settings</button></div>

      <section className={`${CARD} overflow-x-auto`}>
        <h2 className={`${CARD_TITLE} px-4 pt-4`}>Usage log</h2>
        {usage.length ? (
          <table className="mt-2 w-full border-collapse text-[12.5px]">
            <thead><tr><th className={TH}>When</th><th className={TH}>Who</th><th className={TH}>Topic</th><th className={TH}>Feature</th><th className={TH}>Result</th><th className={TH}>Tokens</th></tr></thead>
            <tbody>
              {usage.map(u => (
                <tr key={u.id} className="border-t border-[var(--row-rule)]">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(u.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="px-4 py-2">{u.person || 'Unknown'}</td>
                  <td className="px-4 py-2">{u.topic}</td>
                  <td className="px-4 py-2">{PROMPT_DEFS[u.feature as PromptKey]?.title ?? u.feature}</td>
                  <td className="px-4 py-2">{u.ok ? 'Worked' : u.error || 'Failed'}</td>
                  <td className="px-4 py-2 tabular-nums">{u.tokens.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="m-0 px-4 pb-4 pt-2 text-[13px] text-muted">No runs yet.</p>}
      </section>
    </div>
  )
}
