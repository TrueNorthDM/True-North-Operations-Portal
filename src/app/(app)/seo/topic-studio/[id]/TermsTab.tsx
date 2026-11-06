'use client'

/**
 * Topic terms (Topic Studio, phase 1): the terms the writer is asked to cover,
 * built from what the competitors and the AI answers use. Grouped by topic or
 * as a ranked list; terms that mean the same sit under their main term and
 * count once; each term shows which competitors use it and how often. Rules
 * adjust how terms are scored before a rebuild, and a click on a term shows it
 * in context. The Claude buttons of the Artifact arrive in phase 3.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/useConfirm'
import { BTN } from '@/lib/ui/buttons'
import { CHECKBOX, INPUT_SM } from '@/lib/ui/fields'
import { CARD, CARD_TITLE, FIELD_LABEL, SECTION_TITLE, TH } from '@/lib/ui/type'
import { termPattern, type TermContext } from '@/lib/topic-studio/analysis'
import type { Rules } from '@/lib/topic-studio/engine'
import type { TermRow, TermsView } from '@/lib/topic-studio/views'
import { editTopic, previewRules, termContext, type TopicOp } from '../actions'
import { useTopicCall } from './use-topic-call'

type RuleDef = [keyof Rules, string, number, number, number, string]
const RULE_GROUPS: [string, RuleDef[]][] = [
  ['List size and single words', [
    ['size', 'Terms to build', 15, 60, 5, 'How many terms the automatic build creates. A focused list of about 20 to 35 is easier for writers to use; complex or technical topics may need more. You can always add more from the candidates below.'],
    ['singles', 'Single words favored', 10, 60, 5, 'How much the list leans toward single words. It caps their share of the list and nudges their scores. Lower favors multi-word phrases; at 55% and above, any single word can qualify, not just the main ones.'],
    ['everyday', 'Penalty for everyday words', 0, 100, 10, 'How hard to mark down generic single words such as “life”, “people” or “positive”. Higher pushes them down the list.'],
    ['inside', 'Drop words that mostly sit inside phrases', 30, 100, 5, 'A single word is dropped when this share of its uses already sits inside a chosen phrase, so the phrase stands in for it. Higher keeps more single words; 100% never drops them.'],
    ['fragments', 'Penalty for sentence-fragment phrases', 0, 100, 10, 'Marks down long phrases that look like pieces of sentences: stop words in the middle or generic words at the edges.'],
  ]],
  ['What earns a high score', [
    ['spread', 'Used by many competitors', 0, 100, 5, 'How much a term scores for appearing on many of the top competitor pages.'],
    ['usage', 'Used often on each page', 0, 100, 5, 'How much a term scores for being used many times, not just once.'],
    ['headings', 'In headings, titles and meta descriptions', 0, 100, 5, 'How much a term scores for appearing in competitors’ headings, titles or meta descriptions, which usually marks real subtopics.'],
    ['ai', 'In AI answers', 0, 100, 5, 'How much a term scores for appearing in the AI Overview, ChatGPT, Gemini and Perplexity answers.'],
    ['setup', 'Boost from Setup fields', 0, 200, 10, 'How strongly secondary keyphrases (and, when turned on, rich result and follow-up questions) lift matching terms. 0% ignores them.'],
  ]],
]
const PCT = new Set<keyof Rules>(['singles', 'everyday', 'inside', 'fragments', 'setup'])
const ruleFmt = (k: keyof Rules, v: number) => (k === 'inside' && v >= 100 ? 'Never' : PCT.has(k) ? `${v}%` : String(v))

const TIER_NAME = { high: 'High', medium: 'Medium', low: 'Low' } as const
const TIER_CLASS = { high: 'font-bold text-tn-ink', medium: 'text-foreground', low: 'text-muted' } as const
const REASON = { answer: 'helps answer a target question', question: 'related to a target question', secondary: 'matches a secondary keyphrase' } as const

const Dots = ({ t, labels }: { t: TermRow; labels: (string | null)[] }) => (
  <span className="inline-flex items-center gap-[3px] align-middle" aria-hidden="true">
    {t.per.map((v, i) => v == null ? null : (
      <i key={i} title={`${labels[i] ?? ''}: ${v} use${v === 1 ? '' : 's'}`} className={`block h-[9px] w-[9px] rounded-[2px] border ${v > 0 ? 'bg-tn-teal border-tn-teal' : 'bg-transparent border-[var(--faint)]'}`} />
    ))}
    {t.aiPer.length > 0 && <i className="mx-1 block h-3 w-px bg-[var(--panel-border)]" />}
    {t.aiPer.map(a => (
      <i key={a.label} title={`${a.label}: ${a.v} use${a.v === 1 ? '' : 's'}`} className={`block h-[8px] w-[8px] rotate-45 border ${a.v > 0 ? 'bg-tn-teal border-tn-teal' : 'bg-transparent border-[var(--faint)]'}`} />
    ))}
  </span>
)

const Chip = ({ children, onClick, title, dashed, disabled }: { children: React.ReactNode; onClick: () => void; title?: string; dashed?: boolean; disabled?: boolean }) => (
  <button type="button" title={title} disabled={disabled} onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[12.5px] text-tn-ink transition-colors hover:border-tn-teal disabled:opacity-50 ${dashed ? 'border-dashed border-[var(--faint)]' : 'border-[var(--panel-border)]'}`}>{children}</button>
)

export function TermsTab({ id, view }: { id: string; view: TermsView }) {
  const { call, busy, say, toast } = useTopicCall()
  const [confirmDialog, confirm] = useConfirm()
  const [mode, setMode] = useState<'grouped' | 'list'>('grouped')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [drawer, setDrawer] = useState<{ key: string; label: string } | null>(null)
  const [editGroup, setEditGroup] = useState<{ name: string; draft: string } | null>(null)
  const [adding, setAdding] = useState('')
  // The sliders start from the saved rules; a refresh with new data brings a new object and so drops edits already saved.
  const [edit, setEdit] = useState<{ from: Rules; to: Rules } | null>(null)
  const draft = edit && edit.from === view.rules ? edit.to : view.rules
  const setDraft = (f: (d: Rules) => Rules) => setEdit({ from: view.rules, to: f(draft) })
  const [preview, setPreview] = useState<{ top: { t: string; single: boolean }[]; singles: number } | null>(null)

  const byKey = useMemo(() => new Map(view.terms.map(t => [t.key, t])), [view.terms])
  const present = new Set(view.terms.map(t => t.key))
  const chosen = [...sel].filter(k => present.has(k))
  const ruleDirty = (Object.keys(draft) as (keyof Rules)[]).some(k => draft[k] !== view.rules[k])
  const den = view.N + view.aiCount
  const run = (op: TopicOp, ok?: string | ((r: { message?: string }) => string | undefined)) => call(() => editTopic(id, op), { ok: ok ?? (r => r.message) })

  // A live look at the top candidates while the sliders move (nothing is saved). Until one moves, the page's own list is shown.
  const moved = !!edit && edit.from === view.rules
  useEffect(() => {
    if (!view.N || !moved) return
    let stale = false
    const t = setTimeout(async () => {
      try { const r = await previewRules(id, draft); if (!stale && r.ok) setPreview({ top: r.top, singles: r.singles }) } catch { /* the preview is a convenience */ }
    }, 450)
    return () => { stale = true; clearTimeout(t) }
  }, [id, draft, view.N, moved])
  const shown = moved && preview ? preview : { top: view.primaryTop, singles: view.singlesInTop }

  const toggle = (k: string) => setSel(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const after = (p: Promise<unknown>) => { void p.then(() => setSel(new Set())) }

  async function addTerm() {
    const v = adding.trim()
    if (!v) return
    if (await run({ op: 'add', text: v }, 'Term added.')) setAdding('')
  }
  async function saveGroupName() {
    if (!editGroup) return
    const { name, draft: to } = editGroup
    setEditGroup(null)
    if (to.trim() && to.trim() !== name) await run({ op: 'groupRename', from: name, to })
  }
  async function newGroup() {
    const r = await run({ op: 'groupNew' })
    if (r?.name) setEditGroup({ name: r.name, draft: r.name })
  }
  async function removeGroup(name: string) {
    if (await confirm({ title: `Delete the group “${name}”?`, body: 'Its terms move to Other terms. The terms themselves stay on the list.', action: 'Delete group', danger: true })) await run({ op: 'groupDelete', name })
  }
  async function clearAll() {
    if (await confirm({ title: 'Clear the whole build?', body: 'This removes every term, your removed terms, the groups and the variant choices. The build rules stay.', action: 'Clear everything', danger: true })) await run({ op: 'clear' }, 'Build cleared.')
  }
  async function rebuild() {
    if (view.all > 0 && !(await confirm({ title: 'Rebuild the term list?', body: 'The automatic terms are replaced; terms you added by hand stay. Your groups and variant choices stay too.', action: 'Rebuild' }))) return
    await run(ruleDirty ? { op: 'rules', rules: draft, rebuild: true } : { op: 'build' })
  }

  const tierName = (t: TermRow) => <button type="button" disabled={busy} onClick={() => void run({ op: 'tier', key: t.key })} title="Change relevance" className={`cursor-pointer border-0 bg-transparent p-0 hover:underline ${TIER_CLASS[t.tier]}`}>{TIER_NAME[t.tier]}</button>

  function row(t: TermRow, vmain?: TermRow) {
    return (
      <tr key={t.key} className={`border-b border-[var(--row-rule)] align-top hover:bg-[var(--row-hover)] ${sel.has(t.key) ? 'bg-tn-teal-soft' : ''}`}>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <input type="checkbox" className={CHECKBOX} checked={sel.has(t.key)} onChange={() => toggle(t.key)} aria-label={`Select ${t.t}`} />
            <button type="button" className={BTN.icon} aria-label={`Move ${t.t} up`} disabled={busy} onClick={() => void run({ op: 'move', key: t.key, dir: -1 })}><Icon d="M6 15l6-6 6 6" size={14} /></button>
            <button type="button" className={BTN.icon} aria-label={`Move ${t.t} down`} disabled={busy} onClick={() => void run({ op: 'move', key: t.key, dir: 1 })}><Icon d={ICON.down} size={14} /></button>
          </span>
        </td>
        <td className="px-3 py-2.5">
          {vmain && <span className="text-muted" aria-hidden="true">↳ </span>}
          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left font-semibold text-tn-ink hover:text-tn-teal hover:underline" onClick={() => setDrawer({ key: t.key, label: t.t })}>{t.t}</button>
          {vmain && <><span className="ml-2 rounded bg-subtle px-1.5 py-0.5 text-[11px] text-muted" title="Counts as the same term when grading">same as {vmain.t}</span> <button type="button" className={`${BTN.link} ml-1 !text-[12px]`} disabled={busy} onClick={() => void run({ op: 'notVariant', key: t.key })}>Not the same</button></>}
          {t.src === 'manual' && <span className="ml-2 text-[11.5px] text-muted">added by you</span>}
          {t.avoid ? <span className="ml-2 rounded bg-[var(--bdg-red-bg)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--bdg-red-fg)]" title={`Matches “${t.avoid}”`}>matches a phrase to avoid</span> : t.reason ? <span className="ml-2 text-[11.5px] text-muted">{REASON[t.reason]}</span> : null}
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">{tierName(t)}</td>
        <td className="px-3 py-2.5 whitespace-nowrap"><Dots t={t} labels={view.labels} /> <span className="ml-1 text-[12px] text-muted tabular-nums" title={`${t.df} of ${view.N} competitors and ${t.ai} of ${view.aiCount} AI answers`}>{t.df + t.ai}/{den}</span></td>
        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{t.df ? <>{t.med}× <span className="text-muted">({t.min}-{t.max})</span></> : <span className="text-muted">not used</span>}</td>
        <td className="px-3 py-2.5"><button type="button" className={BTN.icon} aria-label={`Remove ${t.t}`} disabled={busy} onClick={() => void run({ op: 'remove', keys: [t.key] })}><Icon d={ICON.close} size={14} /></button></td>
      </tr>
    )
  }

  const body = mode === 'grouped'
    ? view.groups.map(g => (
        <GroupBlock key={g.name}>
          <tr className="bg-subtle">
            <td colSpan={6} className="px-3 py-2">
              {editGroup?.name === g.name ? (
                <input autoFocus className={`${INPUT_SM} w-64 max-w-full`} maxLength={60} value={editGroup.draft} aria-label="Group name"
                  onChange={e => setEditGroup({ name: g.name, draft: e.target.value })} onBlur={() => void saveGroupName()}
                  onKeyDown={e => { if (e.key === 'Enter') void saveGroupName(); if (e.key === 'Escape') setEditGroup(null) }} />
              ) : <b className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink">{g.name}</b>}
              <span className="ml-2 text-[12px] text-muted">{g.keys.length ? `${g.keys.length} term${g.keys.length === 1 ? '' : 's'}` : 'empty · tick terms and use Move to group'}</span>
              {!g.other && editGroup?.name !== g.name && (
                <span className="ml-2 inline-flex">
                  <button type="button" className={BTN.icon} aria-label={`Rename group ${g.name}`} onClick={() => setEditGroup({ name: g.name, draft: g.name })}><Icon d={ICON.edit} size={14} /></button>
                  <button type="button" className={BTN.icon} aria-label={`Delete group ${g.name}`} disabled={busy} onClick={() => void removeGroup(g.name)}><Icon d={ICON.close} size={14} /></button>
                </span>
              )}
            </td>
          </tr>
          {g.keys.flatMap(k => { const t = byKey.get(k); return t ? [row(t), ...(view.variants[k] ?? []).flatMap(vk => { const v = byKey.get(vk); return v ? [row(v, t)] : [] })] : [] })}
        </GroupBlock>
      ))
    : view.terms.map(t => row(t, t.variantOf ? byKey.get(t.variantOf.key) : undefined))

  const groupOptions = [...view.groups.filter(g => !g.other).map(g => ({ value: g.name, label: g.name })), { value: '__other', label: 'Other terms (no group)' }]

  return (
    <div className="space-y-6">
      {toast}{confirmDialog}
      <section className={`${CARD} p-5`}>
        <h2 className={`${SECTION_TITLE} mb-1`}>Topic terms</h2>
        <p className="m-0 mb-4 text-[13px] text-muted leading-normal">Grouped by topic, most important first. Terms that mean the same thing, like “moisture meter” and “moisture tester”, sit under the main term and count once. Each square is a competitor in rank order, and each diamond an AI answer; filled means it uses the term, and the count shows how many of the competitors and AI answers use it. Tick several terms to move or remove them together. Click a term to see how competitors use it in context.</p>

        {view.missing.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[13px] text-[#92400e]">
            <span>Required AI answers missing: {view.missing.map(m => m.label).join(', ')}. Add them in Setup before building the term list.</span>
            <Link href={`/seo/topic-studio/${id}?tab=setup`} className={BTN.smallWhite}>Open Setup</Link>
          </div>
        )}
        {view.N === 0 && view.all === 0 && (
          <div className="mb-4 rounded-[12px] bg-subtle px-4 py-3 text-[13px] text-muted">Capture competitor pages first. <Link href={`/seo/topic-studio/${id}?tab=competitors`} className="font-semibold text-tn-teal hover:underline">Open Competitors</Link></div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {view.N > 0 && <button type="button" className={view.all ? BTN.smallWhite : BTN.smallNavy} disabled={busy} onClick={() => void rebuild()}>{view.all ? 'Rebuild from data' : 'Build term list'}</button>}
          <button type="button" className={`${BTN.smallWhite} opacity-60`} disabled title="Needs the Anthropic key">Refine with Claude</button>
          <span className="text-[11.5px] text-muted">Phase 3</span>
          <span className="flex-1" />
          <input className={`${INPUT_SM} w-52`} placeholder="Add a missing term" aria-label="Add a missing term" value={adding} maxLength={120} onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addTerm() }} />
          <button type="button" className={BTN.smallNavy} disabled={busy || !adding.trim()} onClick={() => void addTerm()}>Add</button>
        </div>

        {view.N > 0 && (
          <details className="mt-4 rounded-[12px] border border-[#ecd47c] bg-[#fff6d6]" open={view.all === 0}>
            <summary className="cursor-pointer px-4 py-3 text-[13px]"><b className="font-(family-name:--font-display) font-extrabold text-tn-ink">Build rules</b> <span className="text-muted">Adjust how terms are scored, then rebuild{view.changedRules ? ` · ${view.changedRules} changed from the defaults` : ''}</span></summary>
            <div className="border-t border-[#ecd47c] px-4 pb-4 pt-3">
              <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                {RULE_GROUPS.map(([title, defs]) => (
                  <div key={title}>
                    <h4 className={`${FIELD_LABEL} mb-2`}>{title}</h4>
                    {defs.map(([k, label, min, max, step, help]) => (
                      <div key={k} className="mb-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <label htmlFor={`r-${k}`} className="text-[13px] font-semibold text-tn-ink">{label}</label>
                          <span className="text-[12.5px] font-bold tabular-nums text-tn-ink">{ruleFmt(k, draft[k])}</span>
                        </div>
                        <p className="m-0 mb-1 text-[11.5px] leading-snug text-muted">{help}</p>
                        <input id={`r-${k}`} type="range" min={min} max={max} step={step} value={draft[k]} aria-valuetext={ruleFmt(k, draft[k])} className="w-full accent-[#012358]" onChange={e => setDraft(d => ({ ...d, [k]: Number(e.target.value) }))} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {shown.top.length > 0 && (
                <div className="mb-3 rounded-[10px] bg-white/70 p-3">
                  <p className="m-0 mb-2 text-[12.5px]"><b>Top candidates with these rules</b> <span className="text-muted">· {shown.singles} of the top 30 are single words (dashed)</span></p>
                  <div className="flex flex-wrap gap-1.5">{shown.top.map(c => <span key={c.t} className={`rounded-full border bg-white px-2.5 py-1 text-[12.5px] text-tn-ink ${c.single ? 'border-dashed border-[var(--faint)]' : 'border-[var(--panel-border)]'}`}>{c.t}</span>)}</div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={BTN.smallNavy} disabled={busy} onClick={() => void rebuild()}>{view.all ? 'Rebuild term list with these rules' : 'Build term list'}</button>
                {(view.changedRules > 0 || ruleDirty) && <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => void run({ op: 'rules', rules: {}, rebuild: false })}>Reset to defaults</button>}
                {view.all > 0 && <button type="button" className={BTN.smallWhiteDanger} disabled={busy} onClick={() => void clearAll()}>Clear the whole build</button>}
                <span className="text-[12px] text-muted">Rebuilding replaces the automatic terms and keeps the ones you added by hand.</span>
              </div>
            </div>
          </details>
        )}

        {view.all > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented label="View" value={mode} onChange={setMode} options={[{ key: 'grouped', label: 'Grouped' }, { key: 'list', label: 'Ranked list' }]} />
            {mode === 'grouped' && <button type="button" className={BTN.link} disabled={busy} onClick={() => void newGroup()}>+ New group</button>}
          </div>
        )}
      </section>

      {view.all > 0 && (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--panel-border)] bg-tn-teal-soft px-4 py-3 text-[13px] text-tn-ink">
            <div>
              <b className="font-(family-name:--font-display) font-extrabold text-[22px] tabular-nums">{view.concepts}</b> term{view.concepts === 1 ? '' : 's'}
              {view.all > view.concepts && <span className="text-muted"> (plus {view.all - view.concepts} variant{view.all - view.concepts === 1 ? '' : 's'})</span>}
              <div className="text-[12px] text-muted">{view.tiers.high} high · {view.tiers.medium} medium · {view.tiers.low} low</div>
            </div>
            {view.size && <div className="min-w-[240px] flex-1 text-[12.5px]"><b>Recommended: {view.size.short}-{view.size.max} terms.</b> <span className={view.size.tone === 'ok' ? 'text-[var(--ok-fg)]' : view.size.tone === 'warn' ? 'text-[var(--warn-fg)]' : 'text-[#c8323d]'}>{view.size.text}</span></div>}
            {view.warnings.length > 0 && (
              <ul className="m-0 basis-full list-none space-y-1 border-t border-[var(--panel-border)] p-0 pt-2.5">
                {view.warnings.map(w => <li key={w} className="flex gap-2 text-[12.5px] text-[var(--warn-fg)]"><Icon d={ICON.warn} size={15} className="mt-0.5" /><span>{w}</span></li>)}
              </ul>
            )}
          </div>

          {chosen.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--panel-border)] bg-subtle px-4 py-2.5 text-[13px]">
              <b>{chosen.length} selected</b>
              <div className="w-56"><Select value="" onChange={v => after(run({ op: 'groupMove', keys: chosen, target: v === '__other' ? null : v }))} options={groupOptions} placeholder="Move to group…" fullWidth ariaLabel="Move the selected terms to a group" /></div>
              <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => after(run({ op: 'moveEnd', keys: chosen, where: 'top' }))}>Move to top</button>
              <button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => after(run({ op: 'moveEnd', keys: chosen, where: 'bottom' }))}>Move to bottom</button>
              <button type="button" className={BTN.smallWhiteDanger} disabled={busy} onClick={() => after(run({ op: 'remove', keys: chosen }))}>Remove selected</button>
              <button type="button" className={BTN.link} onClick={() => setSel(new Set())}>Clear selection</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <th className={`${TH} w-[120px]`}><input type="checkbox" className={CHECKBOX} aria-label="Select all terms" checked={chosen.length > 0 && chosen.length === view.terms.length} onChange={() => setSel(chosen.length === view.terms.length ? new Set() : new Set(view.terms.map(t => t.key)))} /></th>
                  <th className={TH}>Term</th><th className={TH}>Relevance</th><th className={TH}>Used by</th><th className={TH}>Typical uses</th><th className={TH} />
                </tr>
              </thead>
              <tbody>{body}</tbody>
            </table>
          </div>
        </section>
      )}

      {view.more.length > 0 && (
        <details className={`${CARD} p-4`}>
          <summary className={`${CARD_TITLE} cursor-pointer`}>More candidate terms ({view.more.length})</summary>
          <p className="m-0 mt-2 text-[12.5px] text-muted">Terms competitors use that are not on your list. Click one to add it.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{view.more.map(c => <Chip key={c.k} disabled={busy} title={`${c.df} of ${view.N} competitors and ${c.ai} of ${view.aiCount} AI answers`} onClick={() => void run({ op: 'add', text: c.t, key: c.k, tier: 'medium' }, `Added “${c.t}”.`)}>{c.t} <span className="text-[11px] text-muted">{c.df + c.ai}/{den}</span></Chip>)}</div>
        </details>
      )}
      {view.excluded.length > 0 && (
        <details className={`${CARD} p-4`}>
          <summary className={`${CARD_TITLE} cursor-pointer`}>Left out by your specific terms to avoid ({view.excluded.length})</summary>
          <p className="m-0 mt-2 text-[12.5px] text-muted">Click a term to add it to your list anyway. It keeps a “matches a phrase to avoid” tag so writers know why.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{view.excluded.map(x => <Chip key={x.k} disabled={busy} title={`Matches “${x.by}”`} onClick={() => void run({ op: 'add', text: x.t, key: x.k, tier: 'medium' }, `Added “${x.t}”.`)}>{x.t} <span className="text-[11px] text-muted">{x.df + x.ai}/{den} · + add</span></Chip>)}</div>
        </details>
      )}
      {view.removed.length > 0 && (
        <details className={`${CARD} p-4`}>
          <summary className={`${CARD_TITLE} cursor-pointer`}>Removed terms ({view.removed.length})</summary>
          <div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" className={BTN.smallWhite} disabled={busy} onClick={() => void run({ op: 'restoreAll' }, 'Terms restored to the end of your list.')}>Restore all {view.removed.length}</button><span className="text-[12.5px] text-muted">or click a term to restore just that one</span></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{view.removed.map(r => <Chip key={r.key} disabled={busy} title={r.reason} onClick={() => void run({ op: 'restore', key: r.key })}>{r.t} <span className="text-[11px] text-muted">restore</span></Chip>)}</div>
        </details>
      )}

      {drawer && <TermDrawer id={id} term={drawer} onClose={() => setDrawer(null)} onError={m => say(m, true)} />}
    </div>
  )
}

const GroupBlock = ({ children }: { children: React.ReactNode }) => <>{children}</>

/** A term in context: who uses it, how often, and the sentences around it. */
function TermDrawer({ id, term, onClose, onError }: { id: string; term: { key: string; label: string }; onClose: () => void; onError: (m: string) => void }) {
  const [ctx, setCtx] = useState<TermContext | null>(null)
  useEffect(() => {
    let stale = false
    void termContext(id, term.key, term.label).then(r => { if (stale) return; if (r.ok) setCtx(r.context); else { onError(r.error); onClose() } }).catch(() => { if (!stale) { onError('That did not load. Try again in a moment.'); onClose() } })
    return () => { stale = true }
  }, [id, term.key, term.label, onClose, onError])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const re = useMemo(() => { const p = termPattern(term.label); try { return p ? new RegExp(`\\b${p}\\b`, 'gi') : null } catch { return null } }, [term.label])
  const mark = (s: string) => {
    if (!re) return s
    re.lastIndex = 0
    const out: React.ReactNode[] = []
    let pos = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(s))) { out.push(s.slice(pos, m.index), <mark key={m.index} className="rounded bg-[#fbf1cf] px-0.5 text-inherit">{m[0]}</mark>); pos = m.index + m[0].length; if (!m[0]) re.lastIndex++ }
    out.push(s.slice(pos))
    return out
  }
  const st = ctx?.stats

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-[rgba(1,35,88,.32)]" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <aside role="dialog" aria-modal="true" aria-label={`${term.label} in context`} className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(1,35,88,.5)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
          <h2 className="m-0 font-(family-name:--font-display) text-[18px] font-extrabold text-tn-ink">{term.label}</h2>
          <button type="button" className={BTN.icon} onClick={onClose} aria-label="Close" autoFocus><Icon d={ICON.close} size={17} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!ctx && <p className="m-0 text-[13px] text-muted">Loading…</p>}
          {st && (
            <>
              <p className="m-0 mb-4 text-[13px] text-muted leading-normal">
                Used by {st.df} of {st.competitors} competitors{st.df ? `, typically ${st.med}× (range ${st.min}-${st.max})` : ''}
                {st.aiAnswers ? (st.ai ? `, and by ${st.aiLabels.join(', ')}` : '. No AI answer uses it') : ''}.
              </p>
              {ctx.sources.length ? ctx.sources.map(g => (
                <div key={g.label} className="mb-4">
                  <p className="m-0 mb-1.5 text-[13px] font-bold text-tn-ink">{g.label} <span className="font-normal text-muted">{g.uses} use{g.uses === 1 ? '' : 's'}</span></p>
                  {g.examples.map((e, i) => (
                    <blockquote key={i} className="m-0 mb-2 border-l-[3px] border-[var(--panel-border)] pl-3 text-[13px] leading-normal">
                      {mark(e.text)}<small className="mt-0.5 block text-[11.5px] text-muted">under “{e.under}”</small>
                    </blockquote>
                  ))}
                </div>
              )) : <p className="m-0 text-muted">No competitor uses this term.</p>}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
