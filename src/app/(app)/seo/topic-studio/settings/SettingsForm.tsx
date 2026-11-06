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
import { CHECKBOX, INPUT, INPUT_SM, TEXTAREA } from '@/lib/ui/fields'
import { CARD, CARD_TITLE, FIELD_LABEL, TH } from '@/lib/ui/type'
import { PROMPT_DEFS, PROMPT_ORDER, type PromptKey } from '@/lib/topic-studio/ai/prompt-defs'
import { EFFORTS, MODEL_CHOICES, type Effort, type TsSettings } from '@/lib/topic-studio/ai/settings'
import type { ClientFull } from '@/lib/topic-studio/store'
import type { UsageLine } from '@/lib/topic-studio/ai/store'
import { saveAiSettings, saveClient } from '../actions-settings'
import { SWITCH_LABELS, TERM_RULES, WRITER_RULES } from './rules'
import { useTopicCall } from '../[id]/use-topic-call'

const effortOpts = EFFORTS.map(e => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }))
const num = (v: string, max: number) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)))

type Group = Record<string, number | boolean>

/** One rule group: its switch (if any) and its numbers and ticks, named by `labels`. */
function Rules({ title, labels, value, onChange }: { title: string; labels: Record<string, string>; value: Group; onChange: (v: Group) => void }) {
  const set = (k: string, v: number | boolean) => onChange({ ...value, [k]: v })
  return (
    <div className="rounded-[12px] border border-[var(--panel-border)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><h3 className="m-0 text-[13px] font-bold text-tn-ink">{title}</h3>{typeof value.on === 'boolean' && <Switch on={value.on} label={`${title} on`} onChange={v => set('on', v)} />}</div>
      <div className="space-y-2">
        {Object.entries(labels).map(([k, label]) => typeof value[k] === 'boolean'
          ? <label key={k} className="flex items-center gap-2 text-[12.5px]"><input type="checkbox" className={CHECKBOX} checked={value[k] as boolean} onChange={e => set(k, e.target.checked)} />{label}</label>
          : <label key={k} className="flex items-center justify-between gap-3 text-[12.5px]"><span>{label}</span><input className={`${INPUT_SM} w-20 text-right`} inputMode="numeric" aria-label={`${title}: ${label}`} value={value[k] as number} onChange={e => set(k, Number(e.target.value.replace(/\D/g, '')) || 0)} /></label>)}
      </div>
    </div>
  )
}

function ClientEditor({ client, onDone }: { client: ClientFull | null; onDone: () => void }) {
  const { call, busy, toast } = useTopicCall()
  const [c, setC] = useState<ClientFull>(client ?? { code: '', name: '', heading: '', faith: false, about: '', orig: '' })
  const f = (k: keyof ClientFull, v: string | boolean) => setC(x => ({ ...x, [k]: v }))
  return (
    <div className="rounded-[12px] border border-[var(--panel-border)] p-3">
      {toast}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className={FIELD_LABEL}>Code</span><input className={`${INPUT} mt-1 w-full`} value={c.code} disabled={!!client} maxLength={6} onChange={e => f('code', e.target.value.toUpperCase())} /></label>
        <label className="block"><span className={FIELD_LABEL}>Name</span><input className={`${INPUT} mt-1 w-full`} value={c.name} maxLength={80} onChange={e => f('name', e.target.value)} /></label>
        <label className="block"><span className={FIELD_LABEL}>Brief heading</span><input className={`${INPUT} mt-1 w-full`} value={c.heading} maxLength={60} placeholder={`${c.code || 'XX'} Topic`} onChange={e => f('heading', e.target.value)} /></label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12.5px]"><input type="checkbox" className={CHECKBOX} checked={c.faith} onChange={e => f('faith', e.target.checked)} />A faith client (Claude looks at Scripture and Bible books)</label>
      <label className="mt-3 block"><span className={FIELD_LABEL}>About the client (what Claude is told)</span><textarea className={`${TEXTAREA} mt-1 min-h-[90px] w-full`} value={c.about} maxLength={4000} onChange={e => f('about', e.target.value)} /></label>
      <label className="mt-3 block"><span className={FIELD_LABEL}>What original material means here</span><textarea className={`${TEXTAREA} mt-1 min-h-[70px] w-full`} value={c.orig} maxLength={4000} onChange={e => f('orig', e.target.value)} /></label>
      <div className="mt-3"><button type="button" className={BTN.smallNavy} disabled={busy || !c.code.trim() || !c.name.trim()} onClick={async () => { if (await call(() => saveClient(c), { ok: 'Client saved.' })) onDone() }}>{client ? 'Save client' : 'Add client'}</button></div>
    </div>
  )
}

export function SettingsForm({ settings, clients, connected, usage }: { settings: TsSettings; clients: ClientFull[]; connected: boolean; usage: UsageLine[] }) {
  const { call, busy, toast } = useTopicCall()
  const [all, setAll] = useState<TsSettings>(settings)
  const [adding, setAdding] = useState(false)
  const s = all.ai
  const setS = (f: (x: TsSettings['ai']) => TsSettings['ai']) => setAll(a => ({ ...a, ai: f(a.ai) }))
  const [open, setOpen] = useState<PromptKey | null>(null)
  const modelOpts = (cur: string) => [...MODEL_CHOICES.map(m => ({ value: m.id, label: m.label })), ...(MODEL_CHOICES.some(m => m.id === cur) ? [] : [{ value: cur, label: cur }])]
  const feat = (k: PromptKey, patch: Partial<TsSettings['ai']['features'][PromptKey]>) => setS(x => ({ ...x, features: { ...x.features, [k]: { ...x.features[k], ...patch } } }))
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

      <section className={`${CARD} p-4`}>
        <h2 className={CARD_TITLE}>Tabs and fields</h2>
        <p className="m-0 mt-1 mb-3 text-[12.5px] text-muted">Switch off what the team does not use. A tab that is off disappears from every topic; its data is kept.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SWITCH_LABELS).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13px]"><span>{label}</span><Switch on={all.features[k as keyof typeof all.features]} label={label} onChange={v => setAll(a => ({ ...a, features: { ...a.features, [k]: v } }))} /></div>
          ))}
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className={CARD_TITLE}>Term list warnings</h2>
        <p className="m-0 mt-1 mb-3 text-[12.5px] text-muted">The notes SEOs see about a term list that looks thin, repetitive or lopsided.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.entries(TERM_RULES).map(([g, [title, labels]]) => (
            <Rules key={g} title={title} labels={labels} value={all.feedback.terms[g as keyof typeof all.feedback.terms] as Group} onChange={v => setAll(a => ({ ...a, feedback: { ...a.feedback, terms: { ...a.feedback.terms, [g]: v } } }))} />
          ))}
        </div>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className={CARD_TITLE}>Writer guidance</h2>
        <p className="m-0 mt-1 mb-3 text-[12.5px] text-muted">The panels beside a writer’s draft. Writers never see grades or competitor targets, only guidance in words.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {Object.entries(WRITER_RULES).map(([g, [title, labels]]) => (
            <Rules key={g} title={title} labels={labels} value={all.feedback.writer[g as keyof typeof all.feedback.writer] as Group} onChange={v => setAll(a => ({ ...a, feedback: { ...a.feedback, writer: { ...a.feedback.writer, [g]: v } } }))} />
          ))}
        </div>
      </section>

      <div><button type="button" className={BTN.navy} disabled={busy} onClick={() => void call(() => saveAiSettings(all), { ok: 'Settings saved.', refresh: false })}>Save settings</button></div>

      <section className={`${CARD} p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className={CARD_TITLE}>Clients</h2><button type="button" className={BTN.smallWhite} onClick={() => setAdding(a => !a)}>{adding ? 'Cancel' : 'Add a client'}</button></div>
        <p className="m-0 mt-1 mb-3 text-[12.5px] text-muted">Each client has its own profile: what Claude is told about it, and its heading in the brief. Saved on their own button, not with the settings above.</p>
        <div className="space-y-3">
          {adding && <ClientEditor client={null} onDone={() => setAdding(false)} />}
          {clients.map(c => <details key={c.code} className="rounded-[12px] border border-[var(--panel-border)]"><summary className="cursor-pointer px-3 py-2.5 text-[13px] font-semibold text-tn-ink">{c.code} · {c.name}</summary><div className="p-2"><ClientEditor client={c} onDone={() => {}} /></div></details>)}
        </div>
      </section>

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
