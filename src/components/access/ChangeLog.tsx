'use client'

import { useState, useTransition } from 'react'
import { ITEM, LEVEL_LABEL, type AccessLevel } from '@/lib/access/catalogue'

import { undoChange } from '@/app/(app)/admin/access-levels/actions'
import { type AccessPageData, btn, card, Modal, when } from './parts'

// ── Change log ─────────────────────────────────────────────────────────────

const KIND_NAME: Record<string, string> = { rules: 'Permissions', 'tool-teams': 'Teams for tools', level: 'Levels', exception: 'Exceptions', position: 'Team positions', undo: 'Undo' }

export type Change = { kind?: string; level?: string; key?: string; label?: string; before?: unknown; after?: unknown; beforeEffective?: boolean; person?: string; from?: string; to?: string; effect?: string; until?: string | null; teamNames?: Record<string, string> }

function ChangeLines({ changes, teamName }: { changes: unknown; teamName: Map<string, string> }) {
  const list = (Array.isArray(changes) ? changes : []) as Change[]
  const scope = (s: unknown, names?: Record<string, string>) => {
    const v = s as { every?: boolean; teams?: Record<string, string> } | null
    if (!v) return 'No team'
    if (v.every) return 'Every team'
    const e = Object.entries(v.teams ?? {})
    return e.length ? e.map(([id, a]) => `${names?.[id] ?? teamName.get(id) ?? 'Team'}${a === 'lead' ? ' (Leads)' : ''}`).join(', ') : 'No team'
  }
  if (!list.length) return null
  return (
    <div className="space-y-1 text-[13px]">
      {list.slice(0, 12).map((c, i) => {
        if (c.kind === 'rule') return <div key={i} className="flex flex-wrap items-center gap-2"><span className="text-[11.5px] font-semibold rounded-full bg-subtle px-2">{LEVEL_LABEL[c.level as AccessLevel] ?? c.level}</span>{c.label} <span className="text-[#c8323d] line-through">{(c.beforeEffective ?? c.before) ? 'On' : 'Off'}</span> → <b className="text-[#0d7a4f]">{c.after ? 'On' : 'Off'}</b></div>
        if (c.kind === 'tool') return <div key={i} className="flex flex-wrap items-center gap-2"><span className="text-[11.5px] font-semibold rounded-full bg-[#efedfc] text-[#5b4bc4] px-2">Teams</span>{c.label}: {c.before !== undefined && <span className="text-[#c8323d] line-through">{scope(c.before, c.teamNames)}</span>} → <b className="text-[#0d7a4f]">{scope(c.after, c.teamNames)}</b></div>
        if (c.kind === 'level' || (c.person && c.from && c.to)) return <div key={i}>{c.person}: <span className="text-[#c8323d] line-through">{LEVEL_LABEL[c.from as AccessLevel] ?? c.from}</span> → <b className="text-[#0d7a4f]">{LEVEL_LABEL[c.to as AccessLevel] ?? c.to}</b></div>
        if (c.kind === 'exception-add') return <div key={i}>{c.person} · {c.label} <span className={`text-[11.5px] font-bold rounded-full px-2 ${c.effect === 'grant' ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#fce8e9] text-[#c8323d]'}`}>{c.effect === 'grant' ? 'Can open' : 'Cannot open'}</span> {c.until ? `until ${c.until}` : 'until removed'}</div>
        if (c.kind === 'exception-end') return <div key={i}>{c.person} · {c.label}: exception ended</div>
        return null
      })}
      {list.length > 12 && <div className="text-[12px] text-muted">and {list.length - 12} more</div>}
    </div>
  )
}

export function ChangeLog({ log, teamName, onDone }: { log: AccessPageData['log']; teamName: Map<string, string>; onDone: () => void }) {
  const [filter, setFilter] = useState<string>('all')
  const [undoing, setUndoing] = useState<AccessPageData['log'][number] | null>(null)
  const [openImpact, setOpenImpact] = useState<number | null>(null)
  const kinds = ['all', ...Object.keys(KIND_NAME)]
  const shown = log.filter(e => filter === 'all' || e.kind === filter)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {kinds.map(k => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filter === k ? 'bg-tn-primary text-[#ffffff] border-tn-primary' : 'bg-white border-[var(--panel-border)] text-tn-ink'}`}>{k === 'all' ? 'Everything' : KIND_NAME[k]}</button>)}
      </div>
      {shown.length === 0 && <p className="text-[13px] text-muted">Nothing here yet.</p>}
      {shown.map(e => {
        const imp = (Array.isArray(e.impact) ? e.impact : []) as { person: string; gained: string[]; lost: string[] }[]
        const gained = imp.filter(r => r.gained.length).length
        const lost = imp.filter(r => r.lost.length).length
        const canUndo = !e.undoneBy && ['rules', 'tool-teams', 'level', 'exception'].includes(e.kind)
        return (
          <div key={e.id} className={`${card} px-4 py-3 space-y-2`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <b className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{e.summary}</b>
                <div className="text-[12px] text-muted">{e.actor} · {when(e.at)} · <span className="rounded-full bg-subtle px-2">{KIND_NAME[e.kind] ?? e.kind}</span>{e.undoes ? ` · reverses #${e.undoes}` : ''}{e.undoneBy ? ` · undone by #${e.undoneBy}` : ''}</div>
              </div>
              <span className="flex items-center gap-2">
                {imp.length > 0 && <button type="button" onClick={() => setOpenImpact(openImpact === e.id ? null : e.id)} className={`text-[11.5px] font-bold rounded-full px-2.5 py-0.5 ${lost ? 'bg-[#fce8e9] text-[#c8323d]' : 'bg-[#e6f6ee] text-[#0d7a4f]'}`}>{gained} gain, {lost} lose</button>}
                {canUndo && <button type="button" className={btn} onClick={() => setUndoing(e)}>Undo</button>}
              </span>
            </div>
            <ChangeLines changes={e.changes} teamName={teamName} />
            {openImpact === e.id && (
              <div className="rounded-[10px] border border-[var(--row-rule)] px-3 py-2 space-y-1 text-[12.5px]">
                {imp.map(r => <div key={r.person}><b className="text-tn-ink">{r.person}</b>{r.gained.length ? <span className="text-[#0d7a4f]"> gained {r.gained.map(k => ITEM.get(k)?.label ?? k).join(', ')}</span> : null}{r.lost.length ? <span className="text-[#c8323d]"> lost {r.lost.map(k => ITEM.get(k)?.label ?? k).join(', ')}</span> : null}</div>)}
              </div>
            )}
            <div className="rounded-r-[8px] border-l-[3px] border-[#F2C40A] bg-subtle px-3 py-1.5 text-[13px]"><span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.1em] uppercase text-[#8a6703] mr-2">Why</span>{e.reason}</div>
          </div>
        )
      })}
      {undoing && <Undo entry={undoing} onClose={() => setUndoing(null)} onDone={() => { setUndoing(null); onDone() }} />}
    </div>
  )
}

function Undo({ entry, onClose, onDone }: { entry: AccessPageData['log'][number]; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = () => {
    setError(null)
    start(async () => {
      const res = await undoChange(entry.id, reason).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) onDone(); else setError(res.error)
    })
  }
  return (
    <Modal kicker="Undo" title={`Undo "${entry.summary}"`} onClose={onClose}
      foot={<><span className="text-[12px] text-muted">The undo is a new entry in the log, pointing at the one it reverses. Nothing is erased.</span><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Cancel</button><button type="button" className="inline-flex items-center rounded-[9px] bg-[#c8323d] text-[#ffffff] px-3.5 py-2 text-[13px] font-bold disabled:opacity-45" disabled={reason.trim().length < 8 || pending} onClick={run}>{pending ? 'Undoing…' : 'Undo the change'}</button></span></>}>
      <p className="text-[13px] m-0">Puts back what was there before this change, for everyone it touched. The impact is worked out again and kept with the undo.</p>
      <label className="block space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Why undo? Required</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13.5px] text-tn-ink outline-none focus:border-tn-teal" /></label>
      {error && <p className="text-[12.5px] font-semibold text-[#b3271f] m-0">{error}</p>}
    </Modal>
  )
}
