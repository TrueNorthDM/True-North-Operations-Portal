'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { Select } from '@/components/ui/Select'
import { CATALOGUE, CHILDREN, CONFIGURABLE, LEVEL_LABEL, type ConfigurableLevel } from '@/lib/access/catalogue'
import { decide, type Decision, type Rules, type Subject } from '@/lib/access/decide'
import { type AccessPageData, btn, btnNavy, Modal } from './parts'

// ── The level preview ──────────────────────────────────────────────────────

/** What the preview shows: a level on one team, or one real person as they are. */
export type PreviewState = {
  level: ConfigurableLevel; team: string; lead: boolean
  /** Set by "See their portal": the person's own teams and exceptions win over level and team. */
  person?: { name: string; teams: Subject['teams']; exceptions: NonNullable<Subject['exceptions']> }
}

export function LevelPreview({ state, setState, rules, teams, teamName, today, staged, onClose }: {
  state: PreviewState
  setState: (s: PreviewState) => void
  rules: Rules; teams: AccessPageData['teams']; teamName: Map<string, string>; today: string; staged: number; onClose: () => void
}) {
  const subject: Subject = state.person
    ? { level: state.level, teams: state.person.teams, exceptions: state.person.exceptions }
    : { level: state.level, teams: state.team ? new Map([[state.team, state.lead]]) : new Map() }
  const memo = new Map<string, Decision>()
  const d = (k: string) => decide(subject, k, rules, { today, teamNames: teamName, memo })
  const pages = CATALOGUE.filter(i => (i.kind === 'page' || i.kind === 'tool') && !i.soon)
  const open = pages.filter(p => d(p.key).ok)
  const inner = CATALOGUE.filter(i => (i.kind === 'tab' || i.kind === 'action') && d(i.key).ok)
  const tools = open.filter(p => p.kind === 'tool')
  const [pageKey, setPageKey] = useState<string | null>(null)
  const page = (pageKey && open.find(p => p.key === pageKey)) || open.find(p => (CHILDREN.get(p.key) ?? []).some(c => c.kind === 'tab')) || open[0]
  const kids = page ? CHILDREN.get(page.key) ?? [] : []
  const teamLabel = state.person
    ? `${state.person.name}, as they are: ${[...state.person.teams].map(([t, lead]) => `${lead ? 'Lead' : 'Member'} of ${teamName.get(t) ?? 'a team'}`).join(', ') || 'in no team'}${state.person.exceptions.length ? `, with ${state.person.exceptions.length} exception${state.person.exceptions.length === 1 ? '' : 's'}` : ''}`
    : state.team ? `${state.lead ? 'Lead' : 'Member'} of ${teamName.get(state.team) ?? 'a team'}` : 'In no team'

  return (
    <Modal wide kicker="Preview" title={`The portal for ${state.level === 'admin' ? 'an Admin' : state.level === 'team_leader' ? 'a Team Leader' : 'a User'}`} onClose={onClose}
      foot={<><span className="text-[12px] text-muted">Navigation, pages, tabs and actions from the rules on this page. To click through the real pages, use View Stage.</span><span className="flex gap-2"><Link href="/admin/view-stage" target="_blank" rel="noopener" className={btn} title="Opens in a new tab: this page keeps your unsaved changes. View Stage shows what is saved.">Open View Stage →</Link><button type="button" className={btnNavy} onClick={onClose}>Close</button></span></>}>
      <div className="flex flex-wrap items-end gap-4">
        <div><div className="text-[11.5px] font-bold text-muted mb-1">Level</div>
          <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
            {CONFIGURABLE.map(l => <button key={l} type="button" aria-pressed={!state.person && state.level === l} onClick={() => setState({ ...state, person: undefined, level: l, lead: l === 'team_leader' ? true : l === 'user' ? false : state.lead })} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${state.level === l ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{LEVEL_LABEL[l]}</button>)}
          </div></div>
        <div className="min-w-[220px]"><div className="text-[11.5px] font-bold text-muted mb-1">Team</div>
          <Select value={state.team} onChange={v => setState({ ...state, person: undefined, team: v })} options={[...teams.map(t => ({ value: t.id, label: t.name })), { value: '', label: 'No team' }]} searchable ariaLabel="Team" fullWidth /></div>
        <div><div className="text-[11.5px] font-bold text-muted mb-1">Position</div>
          <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
            {([true, false] as const).map(lead => {
              const disabled = (state.level === 'team_leader' && !lead) || (state.level === 'user' && lead)
              return <button key={String(lead)} type="button" aria-pressed={state.lead === lead} disabled={disabled} title={disabled ? 'A Team Leader is Lead of a team; a User is a Member' : undefined} onClick={() => setState({ ...state, person: undefined, lead })} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold disabled:opacity-35 ${state.lead === lead ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{lead ? 'Lead' : 'Member'}</button>
            })}
          </div></div>
      </div>
      <p className="text-[12.5px] text-muted m-0">{teamLabel}. Tools follow the team: pick another to compare.</p>
      {staged > 0 && <div className="rounded-[10px] border border-[#f0d98a] bg-[#fbf1cf] px-3 py-2 text-[12.5px] text-[#6b5000]">Includes your {staged} unsaved {staged === 1 ? 'change' : 'changes'}. Nobody sees them until you save.</div>}
      <div className="flex flex-wrap gap-2">
        {[[open.length, 'pages and tools'], [inner.length, 'tabs and actions'], [tools.length, `tools: ${tools.map(t => t.label.replace('Client Report · ', '')).join(', ') || 'none'}`]].map(([n, l]) => (
          <div key={String(l)} className="rounded-[10px] border border-[var(--panel-border)] px-3 py-1.5"><b className="font-(family-name:--font-display) font-black text-[19px] text-tn-ink block leading-tight">{n}</b><span className="text-[11.5px] text-muted">{l}</span></div>
        ))}
      </div>
      <div className="grid md:grid-cols-[220px_minmax(0,1fr)] rounded-[14px] border border-[var(--panel-border)] overflow-hidden min-h-[380px]">
        <nav className="bg-tn-primary p-2 space-y-0.5 max-h-[460px] overflow-y-auto" aria-label="Their navigation">
          {CATALOGUE.filter(m => m.kind === 'module').map(m => {
            const kidsOpen = (CHILDREN.get(m.key) ?? []).filter(c => !c.soon && d(c.key).ok)
            if (!kidsOpen.length) return null
            return (
              <Fragment key={m.key}>
                <div className="px-2 pt-2 pb-0.5 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.12em] uppercase text-[#F2C40A]">{m.label}</div>
                {kidsOpen.map(c => (
                  <button key={c.key} type="button" onClick={() => setPageKey(c.key)}
                    className={`w-full text-left rounded-[7px] px-2 py-1.5 text-[12.5px] font-semibold ${page?.key === c.key ? 'bg-white/10 text-[#F2C40A]' : 'text-[#e5ecf6] hover:bg-white/10'}`}>
                    {c.label.replace('Client Report · ', 'Report · ').replace(', with Check a person, Exceptions and the change log', '')}
                  </button>
                ))}
              </Fragment>
            )
          })}
        </nav>
        <div className="bg-[#fbfaf6] p-4 space-y-3">
          {page && (
            <>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <h4 className="font-(family-name:--font-display) font-black text-[17px] text-tn-ink m-0">{page.label}</h4>
                <span className="flex flex-wrap gap-1">{d(page.key).reasons.map(r => <span key={r.text} className="text-[11.5px] font-semibold rounded-full bg-[rgba(30,125,127,.1)] text-tn-teal px-2">{r.text}</span>)}</span>
              </div>
              {kids.some(k => k.kind === 'tab') && (
                <div><div className="text-[11.5px] font-bold text-muted mb-1">Tabs</div>
                  <div className="flex flex-wrap gap-1.5">{kids.filter(k => k.kind === 'tab').map(k => { const x = d(k.key); return <span key={k.key} title={x.reasons.map(r => r.text).join(' · ')} className={`rounded-[9px] border px-2.5 py-1 text-[12.5px] font-bold ${x.ok ? 'bg-white border-[var(--panel-border)] text-tn-ink' : 'border-dashed border-[#c9d1da] text-[#b3bcc8] line-through'}`}>{k.label}</span> })}</div></div>
              )}
              {kids.some(k => k.kind === 'action') && (
                <div><div className="text-[11.5px] font-bold text-muted mb-1">What they can do here</div>
                  <div className="space-y-0.5">{kids.filter(k => k.kind === 'action').map(k => { const x = d(k.key); return (
                    <div key={k.key} className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-2 items-center rounded-[8px] px-2 py-1 odd:bg-white">
                      <span className={x.ok ? 'text-[#1E9E6A] font-black' : 'text-[#b3bcc8]'}>{x.ok ? '✓' : '–'}</span>
                      <span className={`text-[12.5px] ${x.ok ? 'text-tn-ink' : 'text-muted'}`}>{k.label}</span>
                      <span className="flex flex-wrap gap-1 justify-end">{x.reasons.map(r => <span key={r.text} className="text-[11px] rounded-full bg-subtle px-2">{r.text}</span>)}</span>
                    </div>) })}</div></div>
              )}
              {!kids.length && <p className="text-[12.5px] text-muted m-0">This page has no tabs or actions of its own.</p>}
              <p className="text-[11.5px] text-muted m-0">Crossed-out tabs are hidden from them. Hover one to see why.</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
