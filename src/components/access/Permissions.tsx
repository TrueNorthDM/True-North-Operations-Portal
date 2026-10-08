'use client'

import { useMemo, useState, useTransition, useEffect } from 'react'
import { CATALOGUE, ITEM, LEVELS, LEVEL_LABEL, isConfigurable, type AccessLevel, type CatalogueItem, type ConfigurableLevel, type ItemKind } from '@/lib/access/catalogue'
import { decide, impact, overlay, ruleKey, ticked, type Audience, type Rules, type ToolScope } from '@/lib/access/decide'
import { saveAccessChanges } from '@/app/(app)/admin/access-levels/actions'
import { type AccessPageData, type Person, KIND_TAG, KIND_COUNT, Tag, Glyph, btn, btnNavy, card, Modal, descendants, teamSummary } from './parts'

export function Permissions({
  base, current, counts, teams, people, today, stagedLevels, setStagedLevels, stagedTools, setStagedTools, onPreview, onSaved,
}: {
  base: Rules; current: Rules; counts: Record<AccessLevel, number>; teams: AccessPageData['teams']; people: Person[]; today: string
  stagedLevels: Map<string, boolean>; setStagedLevels: (m: Map<string, boolean>) => void
  stagedTools: Map<string, ToolScope>; setStagedTools: (m: Map<string, ToolScope>) => void
  onPreview: (l: ConfigurableLevel) => void; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [cascade, setCascade] = useState(true)
  const [query, setQuery] = useState('')
  const [closed, setClosed] = useState<Set<string>>(() => new Set(['m-hours', 'm-chat', 'm-emails', 'm-clocky', 'm-you', 'm-admin']))
  const [teamsOpen, setTeamsOpen] = useState<string | null>(null)
  // The team popover closes on Escape and on a click outside it (audit, 8 October 2026).
  useEffect(() => {
    if (!teamsOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTeamsOpen(null) }
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.('[data-teams-popover]')) setTeamsOpen(null) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
  }, [teamsOpen])
  const [editTeams, setEditTeams] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const staged = stagedLevels.size + stagedTools.size

  const setTick = (level: ConfigurableLevel, item: CatalogueItem, value: boolean, withInside: boolean) => {
    const next = new Map(stagedLevels)
    const targets = [item, ...(withInside ? descendants(item.key) : [])].filter(isConfigurable)
    for (const t of targets) {
      const k = ruleKey(level, t.key)
      if (ticked(base, level, t) === value) next.delete(k)
      else next.set(k, value)
    }
    setStagedLevels(next)
  }

  const q = query.trim().toLowerCase()
  const matches = (i: CatalogueItem): boolean =>
    !q || i.label.toLowerCase().includes(q) || descendants(i.key).some(c => c.label.toLowerCase().includes(q))
  const moduleOfItem = (i: CatalogueItem): CatalogueItem => {
    let x = i
    while (x.parent) x = ITEM.get(x.parent)!
    return x
  }
  const depth = (i: CatalogueItem) => { let d = 0; for (let x = i; x.parent; x = ITEM.get(x.parent)!) d++; return d }

  const cell = (item: CatalogueItem, level: AccessLevel) => {
    if (level === 'super_admin') return <span className="inline-flex w-[26px] h-[26px] items-center justify-center text-[#8a6703]" title="Super Admin always has everything">{Glyph.lock}</span>
    if (item.always) return <span className="text-[10.5px] font-bold text-muted">Everyone</span>
    if (item.superOnly) return <span className="inline-flex w-[26px] h-[26px] items-center justify-center text-[#b3bcc8]" title="Super Admin only, cannot be given">{Glyph.dash}</span>
    const lv = level as ConfigurableLevel
    const on = ticked(current, lv, item)
    const k = ruleKey(lv, item.key)
    const changed = stagedLevels.has(k)
    const parent = item.parent ? ITEM.get(item.parent) : undefined
    const parentOff = parent && parent.kind !== 'module' && isConfigurable(parent) && !ticked(current, lv, parent)
    return (
      <button type="button" disabled={!editing}
        onClick={() => setTick(lv, item, !on, cascade && item.kind !== 'tab' && item.kind !== 'action')}
        aria-label={`${LEVEL_LABEL[lv]}: ${item.label}, ${on ? 'on' : 'off'}`}
        title={parentOff ? `Needs ${parent!.label} first` : changed ? `Was ${ticked(base, lv, item) ? 'on' : 'off'}; not saved yet` : undefined}
        className={`inline-flex w-[26px] h-[26px] items-center justify-center rounded-full transition-shadow ${on ? 'bg-[rgba(30,125,127,.1)] text-tn-teal' : 'text-[#b3bcc8]'} ${changed ? 'shadow-[0_0_0_2px_#e8a33a]' : ''} ${parentOff ? 'opacity-35' : ''} ${editing ? 'cursor-pointer hover:shadow-[0_0_0_2px_#1E7D7F]' : 'cursor-default'}`}>
        {on ? Glyph.check : Glyph.dash}
      </button>
    )
  }

  const moduleCell = (mod: CatalogueItem, level: AccessLevel) => {
    if (level === 'super_admin') return <span className="inline-flex w-[26px] h-[26px] items-center justify-center text-[#8a6703]">{Glyph.lock}</span>
    const lv = level as ConfigurableLevel
    const leaves = descendants(mod.key).filter(isConfigurable)
    if (!leaves.length) return <span className="text-[10.5px] font-bold text-muted">Everyone</span>
    const on = leaves.filter(i => ticked(current, lv, i)).length
    const all = on === leaves.length
    // A module with an always-on page is never closed, even with nothing ticked.
    const someAlways = descendants(mod.key).some(i => i.always)
    return (
      <button type="button" disabled={!editing}
        onClick={() => { const next = new Map(stagedLevels); for (const i of leaves) { const k = ruleKey(lv, i.key); if (ticked(base, lv, i) === !all) next.delete(k); else next.set(k, !all) } setStagedLevels(next) }}
        title={`${on} of ${leaves.length} ticked${editing ? '. Click to switch the whole module.' : ''}`}
        className={`inline-flex w-[26px] h-[26px] items-center justify-center rounded-full text-[10px] font-bold ${all ? 'bg-[rgba(30,125,127,.1)] text-tn-teal' : on || someAlways ? 'bg-subtle text-tn-teal' : 'text-[#b3bcc8]'} ${editing ? 'cursor-pointer hover:shadow-[0_0_0_2px_#1E7D7F]' : 'cursor-default'}`}>
        {all ? Glyph.check : on ? on : someAlways ? <b className="text-[16px] leading-none">·</b> : Glyph.dash}
      </button>
    )
  }

  const teamsCell = (item: CatalogueItem) => {
    const scope = current.tools.get(item.key)
    const changed = stagedTools.has(item.key)
    const open = teamsOpen === item.key
    const list = scope && !scope.every ? [...scope.teams] : []
    return (
      <div data-teams-popover className="relative inline-block text-left">
        <button type="button" onClick={() => setTeamsOpen(open ? null : item.key)} aria-expanded={open}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap ${scope?.every ? 'text-tn-teal border-[var(--panel-border)]' : list.length ? 'text-[#5b4bc4] border-[var(--panel-border)]' : 'text-[#b3bcc8] border-dashed border-[#c9d1da]'} ${changed ? 'shadow-[0_0_0_2px_#e8a33a]' : ''} bg-white`}>
          {teamSummary(scope)} {Glyph.chev}
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1.5 z-20 w-[280px] rounded-[12px] border border-[var(--panel-border)] bg-white shadow-[0_18px_36px_-18px_rgba(1,35,88,.45)] p-3 space-y-2">
            {scope?.every ? <p className="text-[12.5px] m-0">Every team: anyone whose level has the tool can use it.</p>
              : list.length ? (
                <ul className="list-none m-0 p-0 space-y-1 max-h-[240px] overflow-y-auto">
                  {list.sort((a, b) => (teams.find(t => t.id === a[0])?.name ?? '').localeCompare(teams.find(t => t.id === b[0])?.name ?? '')).map(([id, aud]) => (
                    <li key={id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="font-semibold text-tn-ink">{teams.find(t => t.id === id)?.name ?? 'Team'}</span>
                      <span className={`text-[11px] font-bold ${aud === 'lead' ? 'text-[#5b4bc4]' : 'text-tn-teal'}`}>{aud === 'lead' ? 'Leads only' : 'Whole team'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[12.5px] text-muted m-0">No team may use it yet: only Super Admins.</p>}
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" className="text-[12px] font-bold text-muted" onClick={() => setTeamsOpen(null)}>Close</button>
              {editing && <button type="button" className={btnNavy} onClick={() => { setTeamsOpen(null); setEditTeams(item.key) }}>Edit the list</button>}
            </div>
          </div>
        )}
      </div>
    )
  }

  const rows: React.ReactNode[] = []
  for (const item of CATALOGUE) {
    if (!matches(item)) continue
    if (item.kind === 'module') {
      const isClosed = closed.has(item.key) && !q
      rows.push(
        <tr key={item.key} className="bg-[#f9fafc]">
          <td className="px-4 py-2 border-t border-[var(--panel-border)]">
            <button type="button" onClick={() => setClosed(s => { const n = new Set(s); if (n.has(item.key)) n.delete(item.key); else n.add(item.key); return n })}
              className="inline-flex items-center gap-2 font-(family-name:--font-display) font-black text-[14px] text-tn-ink">
              <span className={`text-muted transition-transform ${isClosed ? '-rotate-90' : ''}`}>{Glyph.chev}</span>{item.label}
              {item.building && <span className="rounded bg-[#fbf1cf] px-1.5 py-px text-[9.5px] font-bold tracking-[.06em] text-[#8a6703]">BEING BUILT</span>}
            </button>
          </td>
          <td className="border-t border-[var(--panel-border)]" />
          {LEVELS.map(l => <td key={l.key} className="text-center border-t border-[var(--panel-border)]">{moduleCell(item, l.key)}</td>)}
          <td className="border-t border-[var(--panel-border)]" />
        </tr>,
      )
      continue
    }
    if (closed.has(moduleOfItem(item).key) && !q) continue
    const d = depth(item)
    rows.push(
      <tr key={item.key}>
        <td className="py-2 pr-3 border-t border-[var(--row-rule)]" style={{ paddingLeft: d === 1 ? 30 : 54 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={d === 1 ? 'text-[13.5px] font-semibold text-tn-ink' : 'text-[13px] text-foreground'}>{item.label}</span>
            {item.soon && <span className="rounded bg-[#fbf1cf] px-1.5 py-px text-[9.5px] font-bold tracking-[.06em] text-[#8a6703]">SOON</span>}
            {item.superOnly && <span className="rounded bg-tn-primary px-1.5 py-px text-[9.5px] font-bold tracking-[.06em] text-[#F2C40A]">SUPER ADMIN ONLY</span>}
            {item.group && <span className="text-[11.5px] text-muted">{item.group}</span>}
          </div>
          {item.note && <div className="text-[11.5px] text-muted mt-px">{item.note}</div>}
        </td>
        <td className="text-center border-t border-[var(--row-rule)] px-1"><Tag kind={item.kind as Exclude<ItemKind, 'module'>} /></td>
        {LEVELS.map(l => <td key={l.key} className="text-center border-t border-[var(--row-rule)]">{cell(item, l.key)}</td>)}
        <td className="text-center border-t border-[var(--row-rule)] px-2">{item.kind === 'tool' ? teamsCell(item) : null}</td>
      </tr>,
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 text-[13px] leading-relaxed space-y-2">
        <p className="m-0">
          Someone opens an item when <strong className="text-tn-ink">their level has it ticked</strong>, the page or tool above it is open to them too, and, for tools, <strong className="text-tn-ink">one of their teams is on its list</strong> (the Teams column). <strong className="text-tn-ink">Super Admin</strong> always has everything. <strong className="text-tn-ink">Team Leader</strong> is automatic: whoever is Lead of a team. The eye on a column shows the portal as that level, for a team you choose.
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {(['page', 'tool', 'tab', 'action'] as const).map(k => (
          <div key={k} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 items-center rounded-[12px] border px-3.5 py-3 ${KIND_TAG[k].card}`}>
            <h4 className="m-0 font-(family-name:--font-display) font-black text-[12px] tracking-[.1em] uppercase">{KIND_TAG[k].label}</h4>
            <div className="row-span-2 text-right font-(family-name:--font-display) font-black text-[26px] leading-none">
              {KIND_COUNT[k]}<small className="block font-sans font-semibold text-[11px] tracking-normal">{KIND_TAG[k].plural}</small>
            </div>
            <p className="m-0 text-[12.5px] text-foreground">{KIND_TAG[k].help}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <label className="flex-1 min-w-[220px] flex items-center gap-2 rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages, tools, tabs and actions" aria-label="Search" className="flex-1 outline-none bg-transparent text-[13.5px] text-tn-ink" />
        </label>
        <button type="button" className={btn} onClick={() => setClosed(new Set())}>Expand all</button>
        <button type="button" className={btn} onClick={() => setClosed(new Set(CATALOGUE.filter(i => i.kind === 'module').map(i => i.key)))}>Collapse all</button>
        {editing && (
          <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-tn-ink cursor-pointer" title="A change to a page or tool also changes every tab and action inside it">
            <button type="button" role="switch" aria-checked={cascade} onClick={() => setCascade(c => !c)}
              className={`w-9 h-5 rounded-full transition-colors ${cascade ? 'bg-tn-teal' : 'bg-slate-300'}`}>
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${cascade ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
            Apply to everything inside
          </label>
        )}
        <button type="button" className={btnNavy} onClick={() => setEditing(e => !e)}>{editing ? 'Done editing' : 'Edit'}</button>
      </div>

      {/* The header row sticks under the portal's top bar (--chrome-top) while the list
          scrolls. A box that scrolls sideways would hold it in place instead, so
          it only scrolls sideways on screens too narrow for the table. */}
      <div className={`${card} max-[1239px]:overflow-x-auto`}>
        <table className="w-full border-separate border-spacing-0 min-w-[1060px]">
          <thead>
            <tr>
              <th className="sticky top-[var(--chrome-top)] z-10 rounded-tl-[14px] text-left bg-subtle px-4 py-2.5 border-b border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted align-bottom">Module, page, tool, tab or action</th>
              <th className="sticky top-[var(--chrome-top)] z-10 w-[78px] bg-subtle border-b border-[var(--panel-border)]" aria-label="Kind" />
              {LEVELS.map(l => (
                <th key={l.key} className="sticky top-[var(--chrome-top)] z-10 w-[128px] min-w-[128px] bg-subtle px-2 py-2.5 border-b border-[var(--panel-border)] align-bottom">
                  <div className="grid justify-items-center gap-1.5">
                    <span className="font-(family-name:--font-display) font-black text-[12.5px] text-tn-ink">{l.label}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span title={`${counts[l.key]} ${counts[l.key] === 1 ? 'person' : 'people'}${l.key === 'team_leader' ? ', automatic: Leads of a team' : ''}`}
                        className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--panel-border)] bg-white px-[7px] py-[3px] text-[12px] font-bold text-tn-ink">
                        <span className="text-muted">{Glyph.people}</span>{counts[l.key]}
                      </span>
                      {l.key !== 'super_admin' && (
                        <button type="button" onClick={() => onPreview(l.key as ConfigurableLevel)} title={`Preview the portal as ${l.label}`} aria-label={`Preview ${l.label}`}
                          className="inline-grid place-items-center w-7 h-[26px] rounded-[8px] border border-[var(--panel-border)] bg-white text-tn-teal hover:border-tn-teal hover:bg-[rgba(30,125,127,.07)]">{Glyph.eye}</button>
                      )}
                    </span>
                  </div>
                </th>
              ))}
              <th className="sticky top-[var(--chrome-top)] z-10 rounded-tr-[14px] w-[230px] bg-subtle px-2 py-2.5 border-b border-[var(--panel-border)] align-bottom font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted">Teams<div className="normal-case tracking-normal font-sans font-semibold text-[11px]">tools only</div></th>
            </tr>
          </thead>
          <tbody>{rows.length ? rows : <tr><td colSpan={7} className="px-4 py-6 text-muted text-[13px]">Nothing matches.</td></tr>}</tbody>
        </table>
      </div>

      {staged > 0 && (
        <div className="sticky bottom-3 z-30 flex items-center justify-between gap-3 flex-wrap rounded-[12px] bg-tn-primary text-[#ffffff] px-4 py-2.5 shadow-[0_18px_36px_-18px_rgba(1,35,88,.7)]">
          <span className="text-[13px]"><b className="text-[#F2C40A]">{staged} {staged === 1 ? 'change' : 'changes'}</b> not saved yet. Nothing changes for anyone until you review and save.</span>
          <span className="flex gap-2">
            <button type="button" className="rounded-[9px] bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold" onClick={() => { setStagedLevels(new Map()); setStagedTools(new Map()) }}>Discard</button>
            <button type="button" className="rounded-[9px] bg-[#F2C40A] text-tn-ink px-3.5 py-2 text-[13px] font-bold" onClick={() => setReviewing(true)}>Review and save</button>
          </span>
        </div>
      )}

      {editTeams && (
        <TeamRule
          item={ITEM.get(editTeams)!} scope={current.tools.get(editTeams)} teams={teams} people={people} rules={current} today={today}
          onClose={() => setEditTeams(null)}
          onApply={scope => {
            const next = new Map(stagedTools)
            const saved = base.tools.get(editTeams)
            const same = (saved?.every ?? false) === scope.every && JSON.stringify([...(saved?.teams ?? new Map())].sort()) === JSON.stringify([...scope.teams].sort())
            if (same) next.delete(editTeams); else next.set(editTeams, scope)
            setStagedTools(next)
            setEditTeams(null)
          }}
        />
      )}
      {reviewing && (
        <Review base={base} current={current} stagedLevels={stagedLevels} stagedTools={stagedTools} people={people} teams={teams} today={today}
          onClose={() => setReviewing(false)} onSaved={() => { setReviewing(false); onSaved() }} />
      )}
    </div>
  )
}

function TeamRule({ item, scope, teams, people, rules, today, onClose, onApply }: {
  item: CatalogueItem; scope: ToolScope | undefined; teams: AccessPageData['teams']; people: Person[]; rules: Rules; today: string
  onClose: () => void; onApply: (s: ToolScope) => void
}) {
  const [every, setEvery] = useState(scope?.every ?? false)
  const [list, setList] = useState<Map<string, Audience>>(new Map(scope?.teams ?? []))
  const draft: ToolScope = { every, teams: list }
  const trial = overlay(rules, new Map(), new Map([[item.key, draft]]))
  const who = people.filter(p => p.level !== 'super_admin' && decide(p, item.key, trial, { today }).ok)
  const leadsOf = (teamId: string) => people.filter(p => p.teams.get(teamId)).map(p => p.name.split(' ')[0])
  return (
    <Modal kicker="Teams for a tool" title={item.label} onClose={onClose}
      foot={<><span className="text-[12px] text-muted">Added to your unsaved changes; nothing changes until you save.</span><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Cancel</button><button type="button" className={btnNavy} onClick={() => onApply(draft)}>Apply</button></span></>}>
      <p className="text-[12.5px] text-muted m-0">Which teams may use it. The level ticks still apply: a team on this list only helps people whose level has the tool.</p>
      <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
        {([[true, 'Every team'], [false, 'Only these teams']] as const).map(([v, label]) => (
          <button key={label} type="button" aria-pressed={every === v} onClick={() => setEvery(v)} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${every === v ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{label}</button>
        ))}
      </div>
      {!every && (
        <div className="space-y-1.5">
          {teams.map(t => {
            const a = list.get(t.id) ?? 'off'
            const leads = leadsOf(t.id)
            return (
              <div key={t.id} className="flex items-center justify-between gap-3 flex-wrap rounded-[10px] border border-[var(--row-rule)] px-3 py-2">
                <span className="min-w-0">
                  <b className="text-[13px] text-tn-ink inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: t.color ?? '#8593a4' }} />{t.name}</b>
                  <span className="text-[11.5px] text-muted ml-2">{`Lead${leads.length === 1 ? '' : 's'}: ${leads.join(', ') || 'none'}`}</span>
                </span>
                <span className="inline-flex rounded-[9px] border border-[var(--panel-border)] p-0.5 gap-0.5">
                  {(['off', 'lead', 'team'] as const).map(v => (
                    <button key={v} type="button" aria-pressed={a === v}
                      onClick={() => setList(m => { const n = new Map(m); if (v === 'off') n.delete(t.id); else n.set(t.id, v); return n })}
                      className={`px-2.5 py-1 rounded-[7px] text-[12px] font-bold ${a === v ? (v === 'lead' ? 'bg-[#5b4bc4] text-[#ffffff]' : v === 'team' ? 'bg-tn-teal text-[#ffffff]' : 'bg-tn-primary text-[#ffffff]') : 'text-muted'}`}>
                      {v === 'off' ? 'Off' : v === 'lead' ? 'Leads only' : 'Whole team'}
                    </button>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div className="rounded-[12px] border border-[var(--panel-border)] p-3 space-y-1.5">
        <b className="text-[13px] text-tn-ink">Who can open it with this list</b>
        <div className="flex flex-wrap gap-1.5">
          {who.length ? who.map(p => <span key={p.id} className="text-[11.5px] font-semibold rounded-full bg-subtle px-2.5 py-0.5">{p.name} · {LEVEL_LABEL[p.level]}</span>)
            : <span className="text-[12.5px] text-muted">Nobody but the Super Admins.</span>}
        </div>
      </div>
    </Modal>
  )
}

function Review({ base, current, stagedLevels, stagedTools, people, teams, today, onClose, onSaved }: {
  base: Rules; current: Rules; stagedLevels: Map<string, boolean>; stagedTools: Map<string, ToolScope>; people: Person[]; teams: AccessPageData['teams']; today: string
  onClose: () => void; onSaved: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const rows = useMemo(() => impact(people, base, current, { today }), [people, base, current, today])
  const nameOf = new Map(people.map(p => [p.id, p.name]))
  const teamsText = (s: ToolScope | undefined) => s?.every ? 'Every team' : s && s.teams.size ? [...s.teams].map(([id, a]) => `${teams.find(t => t.id === id)?.name ?? 'Team'}${a === 'lead' ? ' (Leads)' : ''}`).join(', ') : 'No team'
  const label = (k: string) => ITEM.get(k)?.label ?? k
  const gainers = rows.filter(r => r.gained.length)
  const losers = rows.filter(r => r.lost.length)
  const save = () => {
    setError(null)
    start(async () => {
      const res = await saveAccessChanges({
        levels: [...stagedLevels].map(([k, allowed]) => { const [level, key] = k.split('|'); return { level: level as ConfigurableLevel, key, allowed } }),
        tools: [...stagedTools].map(([key, s]) => ({ key, every: s.every, teams: [...s.teams].map(([teamId, audience]) => ({ teamId, audience })) })),
        reason,
        // What this page was showing for the same items: if someone saved them
        // since, the save is refused instead of overwriting their change.
        base: {
          levels: [...stagedLevels.keys()].map(k => { const [level, key] = k.split('|'); return { level: level as ConfigurableLevel, key, allowed: base.levels.get(k) ?? null } }),
          tools: [...stagedTools.keys()].map(key => { const b = base.tools.get(key); return { key, scope: b ? { every: b.every, teams: Object.fromEntries(b.teams) } : null } }),
        },
      }).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) onSaved(); else setError(res.error)
    })
  }
  return (
    <Modal kicker="Review and save" title="Check what changes, then say why" onClose={onClose}
      foot={<><span className="text-[12px] text-muted">Saved together. Super Admins get a notification.</span><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Back to editing</button><button type="button" className={btnNavy} disabled={reason.trim().length < 8 || pending} onClick={save}>{pending ? 'Saving…' : 'Save changes'}</button></span></>}>
      <div className="space-y-1">
        <b className="text-[13px] text-tn-ink">The changes</b>
        {[...stagedLevels].map(([k, v]) => {
          const [level, key] = k.split('|')
          const item = ITEM.get(key)
          const parent = item?.parent ? ITEM.get(item.parent) : null
          return <div key={k} className="text-[13px] flex items-center gap-2 flex-wrap"><span className="text-[11.5px] font-semibold rounded-full bg-subtle px-2">{LEVEL_LABEL[level as AccessLevel]}</span>{parent && parent.kind !== 'module' ? `${parent.label} › ` : ''}{label(key)} <span className="text-[#c8323d] line-through">{v ? 'Off' : 'On'}</span> → <b className="text-[#0d7a4f]">{v ? 'On' : 'Off'}</b></div>
        })}
        {[...stagedTools].map(([k, s]) => (
          <div key={k} className="text-[13px] flex items-center gap-2 flex-wrap"><span className="text-[11.5px] font-semibold rounded-full bg-[#efedfc] text-[#5b4bc4] px-2">Teams</span>{label(k)}: <span className="text-[#c8323d] line-through">{teamsText(base.tools.get(k))}</span> → <b className="text-[#0d7a4f]">{teamsText(s)}</b></div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([['Gain access', gainers, 'gained', 'text-[#0d7a4f]', 'bg-[#e6f6ee] text-[#0d7a4f]'], ['Lose access', losers, 'lost', 'text-[#c8323d]', 'bg-[#fce8e9] text-[#c8323d]']] as const).map(([title, list, field, cls, chip]) => (
          <div key={title} className="rounded-[12px] border border-[var(--panel-border)] p-3 space-y-1.5">
            <b className={`text-[13px] ${cls}`}>{title} ({list.length})</b>
            {list.length ? list.map(r => (
              <div key={r.personId} className="rounded-[9px] border border-[var(--row-rule)] px-2.5 py-1.5">
                <b className="text-[12.5px] text-tn-ink">{nameOf.get(r.personId)}</b>
                <div className="flex flex-wrap gap-1 mt-1">{r[field].slice(0, 4).map(k => <span key={k} className={`text-[11px] font-semibold rounded-full px-2 ${chip}`}>{label(k)}</span>)}{r[field].length > 4 && <span className="text-[11px] text-muted">+{r[field].length - 4}</span>}</div>
              </div>
            )) : <p className="text-[12.5px] text-muted m-0">Nobody.</p>}
          </div>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-[12.5px] font-bold text-tn-ink">Why? Required, and kept in the change log</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="For example: Team Leaders need the Workload tab to plan the week's assignments."
          className="w-full rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13.5px] text-tn-ink outline-none focus:border-tn-teal" />
      </label>
      {error && <p className="text-[12.5px] font-semibold text-[#b3271f] m-0">{error}</p>}
    </Modal>
  )
}
