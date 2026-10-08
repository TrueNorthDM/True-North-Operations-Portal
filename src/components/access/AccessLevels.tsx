'use client'

/**
 * Admin > Access levels (7 October 2026). Five tabs over one model:
 *
 *   Permissions       every module, page, tool, tab and action, ticked per level
 *                     (Super Admin always has everything), and each tool's team
 *                     list. Edits are staged on the page and saved together with
 *                     one reason after the impact (who gains, who loses) is shown.
 *   People and levels Super Admins and Admins are given here; Team Leader and
 *                     User follow team positions. Team priority by name.
 *   Check a person    everything one person can and cannot open, and why.
 *   Exceptions        one person, one item, until a date.
 *   Change log        every change with its reason, and Undo.
 *
 * Every answer on this page (ticks, the level preview, Check a person, the
 * impact) comes from lib/access/decide.ts, the function the server guards use,
 * so the page can never disagree with the portal.
 */

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Select } from '@/components/ui/Select'
import { TeamPriorityAccess, type PriorityAccessData, type PriorityPerson } from '@/components/admin/TeamPriorityAccess'
import {
  CATALOGUE, CHILDREN, CONFIGURABLE, ITEM, LEVELS, LEVEL_LABEL, isConfigurable,
  type AccessLevel, type CatalogueItem, type ConfigurableLevel, type ItemKind,
} from '@/lib/access/catalogue'
import {
  allowedKeys, decide, impact, overlay, ruleKey, ticked,
  type Audience, type Decision, type Exception, type Rules, type Subject, type ToolScope,
} from '@/lib/access/decide'
import {
  addException, endException, saveAccessChanges, setPersonLevel, undoChange,
} from '@/app/(app)/admin/access-levels/actions'

// ── Data from the server ───────────────────────────────────────────────────

type Tab = 'permissions' | 'people' | 'why' | 'exceptions' | 'log'

export interface AccessPageData {
  today: string
  meId: string | null
  initialTab: Tab
  initialWho: string | null
  rules: { levels: [string, boolean][]; tools: [string, { every: boolean; teams: [string, Audience][] }][] }
  people: { id: string; name: string; avatarUrl: string | null; level: AccessLevel; given: 'super_admin' | 'admin' | null; teams: [string, boolean][]; exceptions: Exception[] }[]
  teams: { id: string; name: string; color: string | null }[]
  exceptions: { id: string; personId: string; person: string; key: string; effect: 'grant' | 'deny'; until: string | null; reason: string; by: string | null; at: string }[]
  log: { id: number; at: string; actor: string; kind: string; summary: string; reason: string; changes: unknown; impact: unknown; undoes: number | null; undoneBy: number | null }[]
  priority: { data: PriorityAccessData; people: PriorityPerson[] }
}

type Person = Omit<AccessPageData['people'][number], 'teams'> & Subject

// ── Small parts ────────────────────────────────────────────────────────────

const KIND_TAG: Record<Exclude<ItemKind, 'module'>, { label: string; plural: string; cls: string; card: string; help: string }> = {
  page: { label: 'Page', plural: 'pages', cls: 'bg-[rgba(30,125,127,.1)] text-tn-teal', card: 'bg-[rgba(30,125,127,.07)] border-[#cfe5e5] text-tn-teal', help: 'A screen with its own address, like Report or Directory.' },
  tool: { label: 'Tool', plural: 'tools', cls: 'bg-[#efedfc] text-[#5b4bc4]', card: 'bg-[#f5f3fd] border-[#dcd7f6] text-[#5b4bc4]', help: 'A page in the Tools panel. Besides the level, one of the person\'s teams must be on its team list.' },
  tab: { label: 'Tab', plural: 'tabs', cls: 'bg-subtle text-muted', card: 'bg-subtle border-[var(--panel-border)] text-muted', help: 'A part of a page you switch to with tabs, like Report > Workload.' },
  action: { label: 'Action', plural: 'actions', cls: 'bg-[#eef3fb] text-[#3a5a8c]', card: 'bg-[#eef3fb] border-[#d9e3f3] text-[#3a5a8c]', help: 'Something you can do or see inside a page: export, edit, a sensitive column.' },
}

const KIND_COUNT = Object.fromEntries((['page', 'tool', 'tab', 'action'] as const).map(k => [k, CATALOGUE.filter(i => i.kind === k).length])) as Record<Exclude<ItemKind, 'module'>, number>

function Tag({ kind }: { kind: Exclude<ItemKind, 'module'> }) {
  const k = KIND_TAG[kind]
  return <span title={k.help} className={`inline-block rounded-[5px] px-1.5 py-px font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.08em] uppercase cursor-help ${k.cls}`}>{k.label}</span>
}

const Glyph = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>,
  dash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M7 12h10" /></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  people: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  chev: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>,
}

const btn = 'inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--panel-border)] bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors hover:border-tn-teal disabled:opacity-45'
const btnNavy = 'inline-flex items-center gap-1.5 rounded-[9px] bg-tn-primary text-[#ffffff] px-3.5 py-2 text-[13px] font-bold whitespace-nowrap disabled:opacity-45'
const card = 'rounded-[14px] border border-[var(--panel-border)] bg-white'

function Modal({ title, kicker, wide, onClose, children, foot }: { title: string; kicker: string; wide?: boolean; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(1,35,88,.38)] flex items-center justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`w-full ${wide ? 'max-w-[1080px]' : 'max-w-[640px]'} max-h-[calc(100vh-32px)] bg-white rounded-[18px] shadow-[0_30px_60px_-20px_rgba(1,35,88,.55)] overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]`}>
        <div className="px-5 pt-4 pb-3 border-b border-[var(--row-rule)] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.12em] uppercase text-tn-teal">{kicker}</div>
            <h3 className="font-(family-name:--font-display) font-black text-[18px] text-tn-ink m-0">{title}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg text-muted hover:bg-subtle text-[20px] leading-none">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-3.5">{children}</div>
        {foot && <div className="px-5 py-3 border-t border-[var(--row-rule)] flex items-center justify-between gap-3 flex-wrap">{foot}</div>}
      </div>
    </div>
  )
}

const initials = (n: string) => n.split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()
function Face({ p, size = 28 }: { p: { name: string; avatarUrl: string | null }; size?: number }) {
  if (p.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return <span className="rounded-full bg-tn-primary text-[#ffffff] inline-flex items-center justify-center font-(family-name:--font-display) font-extrabold shrink-0" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(p.name)}</span>
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Everything inside an item (its tabs and actions, and theirs). */
function descendants(key: string): CatalogueItem[] {
  const out: CatalogueItem[] = []
  for (const c of CHILDREN.get(key) ?? []) out.push(c, ...descendants(c.key))
  return out
}

// ── The page ───────────────────────────────────────────────────────────────

export function AccessLevels({ data }: { data: AccessPageData }) {
  const router = useRouter()
  const [tab, setTabState] = useState<Tab>(data.initialTab)
  const setTab = (t: Tab) => {
    setTabState(t)
    try { const u = new URL(window.location.href); u.searchParams.set('tab', t); window.history.replaceState(null, '', u) } catch { /* the address is a convenience */ }
  }

  const base: Rules = useMemo(() => ({
    levels: new Map(data.rules.levels),
    tools: new Map(data.rules.tools.map(([k, s]) => [k, { every: s.every, teams: new Map(s.teams) }])),
  }), [data.rules])
  const [stagedLevels, setStagedLevels] = useState<Map<string, boolean>>(new Map())
  const [stagedTools, setStagedTools] = useState<Map<string, ToolScope>>(new Map())
  const current = useMemo(() => overlay(base, stagedLevels, stagedTools), [base, stagedLevels, stagedTools])
  const staged = stagedLevels.size + stagedTools.size

  const people: Person[] = useMemo(() => data.people.map(p => ({ ...p, teams: new Map(p.teams) })), [data.people])
  const teamName = useMemo(() => new Map(data.teams.map(t => [t.id, t.name])), [data.teams])
  const counts = useMemo(() => Object.fromEntries(LEVELS.map(l => [l.key, people.filter(p => p.level === l.key).length])) as Record<AccessLevel, number>, [people])

  const [preview, setPreview] = useState<{ level: ConfigurableLevel; team: string; lead: boolean } | null>(null)
  const openPreview = (level: ConfigurableLevel, team?: string, lead?: boolean) => {
    const firstTeam: string = team ?? [...(people.find(p => p.level === level && p.teams.size)?.teams.keys() ?? [])][0] ?? data.teams[0]?.id ?? ''
    setPreview({ level, team: firstTeam, lead: lead ?? level === 'team_leader' })
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'permissions', label: 'Permissions' },
    { key: 'people', label: 'People and levels', count: people.length },
    { key: 'why', label: 'Check a person' },
    { key: 'exceptions', label: 'Exceptions', count: data.exceptions.length },
    { key: 'log', label: 'Change log' },
  ]

  return (
    <div className="space-y-5">
      <nav aria-label="Access levels" className="flex items-center gap-0.5 border-b border-[var(--panel-border)] flex-wrap">
        {tabs.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
            className={`px-4 py-2.5 -mb-px border-b-2 text-[13.5px] font-semibold inline-flex items-center gap-2 transition-colors ${tab === t.key ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent hover:text-tn-ink'}`}>
            {t.label}
            {t.count !== undefined && <span className="text-[11px] bg-subtle rounded-full px-2 text-muted">{t.count}</span>}
          </button>
        ))}
      </nav>

      {tab === 'permissions' && (
        <Permissions
          base={base} current={current} counts={counts} teams={data.teams} people={people} today={data.today}
          stagedLevels={stagedLevels} setStagedLevels={setStagedLevels}
          stagedTools={stagedTools} setStagedTools={setStagedTools}
          onPreview={l => openPreview(l)}
          onSaved={() => { setStagedLevels(new Map()); setStagedTools(new Map()); router.refresh() }}
        />
      )}
      {tab === 'people' && <PeopleLevels people={people} teams={data.teams} base={base} today={data.today} meId={data.meId} priority={data.priority} staged={staged > 0} onDone={() => router.refresh()} />}
      {tab === 'why' && <CheckPerson people={people} rules={base} teamName={teamName} today={data.today} initialWho={data.initialWho} onPreview={(level, team, lead) => openPreview(level, team, lead)} />}
      {tab === 'exceptions' && <Exceptions data={data} people={people} onDone={() => router.refresh()} />}
      {tab === 'log' && <ChangeLog log={data.log} teamName={teamName} onDone={() => router.refresh()} />}

      {preview && (
        <LevelPreview
          state={preview} setState={setPreview} rules={current} teams={data.teams} teamName={teamName} today={data.today}
          staged={staged} onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

// ── Permissions ────────────────────────────────────────────────────────────

function teamSummary(scope: ToolScope | undefined): string {
  if (scope?.every) return 'Every team'
  const n = scope?.teams.size ?? 0
  if (!n) return 'No team yet'
  return `${n} ${n === 1 ? 'team has' : 'teams have'} access`
}

function Permissions({
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
    if (level === 'super_admin') return <span className="inline-flex w-[26px] h-[26px] items-center justify-center text-[#a67c04]" title="Super Admin always has everything">{Glyph.lock}</span>
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
    if (level === 'super_admin') return <span className="inline-flex w-[26px] h-[26px] items-center justify-center text-[#a67c04]">{Glyph.lock}</span>
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
      <div className="relative inline-block text-left">
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
              {item.building && <span className="rounded bg-[#fbf1cf] px-1.5 py-px text-[9.5px] font-bold tracking-[.06em] text-[#a67c04]">BEING BUILT</span>}
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
            {item.soon && <span className="rounded bg-[#fbf1cf] px-1.5 py-px text-[9.5px] font-bold tracking-[.06em] text-[#a67c04]">SOON</span>}
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

      {/* The header row sticks under the portal's top bar (65px) while the list
          scrolls. A box that scrolls sideways would hold it in place instead, so
          it only scrolls sideways on screens too narrow for the table. */}
      <div className={`${card} max-[1239px]:overflow-x-auto`}>
        <table className="w-full border-separate border-spacing-0 min-w-[1060px]">
          <thead>
            <tr>
              <th className="sticky top-[65px] z-10 rounded-tl-[14px] text-left bg-subtle px-4 py-2.5 border-b border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted align-bottom">Module, page, tool, tab or action</th>
              <th className="sticky top-[65px] z-10 w-[78px] bg-subtle border-b border-[var(--panel-border)]" aria-label="Kind" />
              {LEVELS.map(l => (
                <th key={l.key} className="sticky top-[65px] z-10 w-[128px] min-w-[128px] bg-subtle px-2 py-2.5 border-b border-[var(--panel-border)] align-bottom">
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
              <th className="sticky top-[65px] z-10 rounded-tr-[14px] w-[230px] bg-subtle px-2 py-2.5 border-b border-[var(--panel-border)] align-bottom font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted">Teams<div className="normal-case tracking-normal font-sans font-semibold text-[11px]">tools only</div></th>
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
          <button key={label} type="button" onClick={() => setEvery(v)} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${every === v ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{label}</button>
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
                    <button key={v} type="button"
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

// ── The level preview ──────────────────────────────────────────────────────

function LevelPreview({ state, setState, rules, teams, teamName, today, staged, onClose }: {
  state: { level: ConfigurableLevel; team: string; lead: boolean }
  setState: (s: { level: ConfigurableLevel; team: string; lead: boolean }) => void
  rules: Rules; teams: AccessPageData['teams']; teamName: Map<string, string>; today: string; staged: number; onClose: () => void
}) {
  const subject: Subject = { level: state.level, teams: state.team ? new Map([[state.team, state.lead]]) : new Map() }
  const memo = new Map<string, Decision>()
  const d = (k: string) => decide(subject, k, rules, { today, teamNames: teamName, memo })
  const pages = CATALOGUE.filter(i => (i.kind === 'page' || i.kind === 'tool') && !i.soon)
  const open = pages.filter(p => d(p.key).ok)
  const inner = CATALOGUE.filter(i => (i.kind === 'tab' || i.kind === 'action') && d(i.key).ok)
  const tools = open.filter(p => p.kind === 'tool')
  const [pageKey, setPageKey] = useState<string | null>(null)
  const page = (pageKey && open.find(p => p.key === pageKey)) || open.find(p => (CHILDREN.get(p.key) ?? []).some(c => c.kind === 'tab')) || open[0]
  const kids = page ? CHILDREN.get(page.key) ?? [] : []
  const teamLabel = state.team ? `${state.lead ? 'Lead' : 'Member'} of ${teamName.get(state.team) ?? 'a team'}` : 'In no team'

  return (
    <Modal wide kicker="Preview" title={`The portal for ${state.level === 'admin' ? 'an Admin' : state.level === 'team_leader' ? 'a Team Leader' : 'a User'}`} onClose={onClose}
      foot={<><span className="text-[12px] text-muted">Navigation, pages, tabs and actions from the rules on this page. To click through the real pages, use View Stage.</span><span className="flex gap-2"><Link href="/admin/view-stage" className={btn}>Open View Stage →</Link><button type="button" className={btnNavy} onClick={onClose}>Close</button></span></>}>
      <div className="flex flex-wrap items-end gap-4">
        <div><div className="text-[11.5px] font-bold text-muted mb-1">Level</div>
          <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
            {CONFIGURABLE.map(l => <button key={l} type="button" onClick={() => setState({ ...state, level: l, lead: l === 'team_leader' ? true : l === 'user' ? false : state.lead })} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${state.level === l ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{LEVEL_LABEL[l]}</button>)}
          </div></div>
        <div className="min-w-[220px]"><div className="text-[11.5px] font-bold text-muted mb-1">Team</div>
          <Select value={state.team} onChange={v => setState({ ...state, team: v })} options={[...teams.map(t => ({ value: t.id, label: t.name })), { value: '', label: 'No team' }]} searchable ariaLabel="Team" fullWidth /></div>
        <div><div className="text-[11.5px] font-bold text-muted mb-1">Position</div>
          <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
            {([true, false] as const).map(lead => {
              const disabled = (state.level === 'team_leader' && !lead) || (state.level === 'user' && lead)
              return <button key={String(lead)} type="button" disabled={disabled} title={disabled ? 'A Team Leader is Lead of a team; a User is a Member' : undefined} onClick={() => setState({ ...state, lead })} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold disabled:opacity-35 ${state.lead === lead ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{lead ? 'Lead' : 'Member'}</button>
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

// ── People and levels ──────────────────────────────────────────────────────

function PeopleLevels({ people, teams, base, today, meId, priority, staged, onDone }: {
  people: Person[]; teams: AccessPageData['teams']; base: Rules; today: string; meId: string | null
  priority: AccessPageData['priority']; staged: boolean; onDone: () => void
}) {
  const [changing, setChanging] = useState<{ personId: string; to: 'super_admin' | 'admin' | null } | null>(null)
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const teamsText = (p: Person) => [...p.teams].map(([id, lead]) => `${lead ? 'Lead' : 'Member'} of ${teamName.get(id) ?? 'a team'}`).join(' · ') || 'No team'
  const intro: Record<AccessLevel, string> = {
    super_admin: 'Everything, always. At least two.',
    admin: 'Given by a Super Admin. Opens what the Admin column has ticked.',
    team_leader: 'Automatic: Lead of at least one team. Change it on the Directory\'s Teams tab.',
    user: 'Automatic: everyone else.',
  }
  return (
    <div className="space-y-6">
      <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 text-[13px] leading-relaxed">
        <strong className="text-tn-ink">Super Admin</strong> and <strong className="text-tn-ink">Admin</strong> are given here, with a reason. <strong className="text-tn-ink">Team Leader</strong> and <strong className="text-tn-ink">User</strong> are automatic: whoever is Lead of any team on the Directory&apos;s Teams tab is a Team Leader; everyone else is a User. There are always at least two Super Admins.
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start">
        {LEVELS.map(l => {
          const list = people.filter(p => p.level === l.key)
          return (
            <div key={l.key} className={`${card} p-4 space-y-2.5`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-(family-name:--font-display) font-black text-[15px] text-tn-ink m-0">{l.label}</h3>
                <span className="text-[11.5px] font-bold rounded-full bg-subtle px-2">{list.length}</span>
              </div>
              <p className="text-[12px] text-muted m-0">{intro[l.key]}</p>
              {(l.key === 'super_admin' || l.key === 'admin')
                ? <button type="button" className={btn} onClick={() => setChanging({ personId: '', to: l.key as 'super_admin' | 'admin' })}>+ Add</button>
                : <Link href="/directory" className="text-[12.5px] font-bold text-tn-teal">Directory, Teams tab →</Link>}
              <div>
                {list.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 py-1.5 border-t border-[var(--row-rule)] first:border-t-0">
                    <Face p={p} />
                    <span className="flex-1 min-w-0"><b className="block text-[13px] text-tn-ink">{p.name}{p.id === meId ? ' (you)' : ''}</b><span className="text-[11.5px] text-muted">{teamsText(p)}</span></span>
                    {(l.key === 'super_admin' || l.key === 'admin') && <button type="button" className="text-[12px] font-bold text-tn-teal" onClick={() => setChanging({ personId: p.id, to: null })}>Change</button>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <TeamPriorityAccess people={priority.people} data={priority.data} editingMatrix={staged} onChanged={onDone} />
      {changing && <LevelChange people={people} base={base} today={today} initial={changing} onClose={() => setChanging(null)} onDone={() => { setChanging(null); onDone() }} />}
    </div>
  )
}

function LevelChange({ people, base, today, initial, onClose, onDone }: {
  people: Person[]; base: Rules; today: string; initial: { personId: string; to: 'super_admin' | 'admin' | null }
  onClose: () => void; onDone: () => void
}) {
  const [personId, setPersonId] = useState(initial.personId)
  const [to, setTo] = useState<'super_admin' | 'admin' | null>(initial.to)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const p = people.find(x => x.id === personId)
  const supers = people.filter(x => x.given === 'super_admin').length
  const autoLevel: AccessLevel = p && [...p.teams.values()].some(Boolean) ? 'team_leader' : 'user'
  const newLevel: AccessLevel = to ?? autoLevel
  const blocked = !!p && p.given === 'super_admin' && to !== 'super_admin' && supers <= 2
  const diff = useMemo(() => {
    if (!p) return { gained: [] as string[], lost: [] as string[] }
    const was = allowedKeys(p, base, { today })
    const is = allowedKeys({ ...p, level: newLevel }, base, { today })
    const keep = (k: string) => ITEM.get(k)?.kind !== 'module'
    return { gained: [...is].filter(k => !was.has(k) && keep(k)), lost: [...was].filter(k => !is.has(k) && keep(k)) }
  }, [p, newLevel, base, today])
  const save = () => {
    setError(null)
    start(async () => {
      const res = await setPersonLevel(personId, to, reason).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) onDone(); else setError(res.error)
    })
  }
  return (
    <Modal kicker="Change a level" title={p ? p.name : 'Choose a person'} onClose={onClose}
      foot={<><span /><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Cancel</button><button type="button" className={btnNavy} disabled={!p || blocked || p.given === to || reason.trim().length < 8 || pending} onClick={save}>{pending ? 'Saving…' : 'Save the level'}</button></span></>}>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Person</span>
        <Select value={personId} onChange={setPersonId} options={people.map(x => ({ value: x.id, label: `${x.name} · ${LEVEL_LABEL[x.level]}` }))} searchable fullWidth placeholder="Choose a person…" ariaLabel="Person" /></div>
      {p && (
        <>
          <div className="space-y-1.5">
            {([['super_admin', 'Super Admin', 'Everything, always, including this page.'], ['admin', 'Admin', 'What the Admin column has ticked.'], [null, 'Automatic', `Team Leader if Lead of a team, otherwise User. For ${p.name.split(' ')[0]}: ${LEVEL_LABEL[autoLevel]}.`]] as const).map(([v, label, help]) => (
              <button key={String(v)} type="button" onClick={() => setTo(v)} className={`w-full text-left rounded-[10px] border px-3 py-2 ${to === v ? 'border-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-[var(--panel-border)]'}`}>
                <b className="text-[13px] text-tn-ink">{label}</b>{p.given === v && <span className="text-[11px] text-muted ml-2">today</span>}
                <div className="text-[12px] text-muted">{help}</div>
              </button>
            ))}
          </div>
          {blocked
            ? <div className="rounded-[10px] border border-[#f0d98a] bg-[#fbf1cf] px-3 py-2 text-[12.5px] text-[#6b5000]">There must always be <b>at least two Super Admins</b>, so nobody can be locked out by one mistake or one lost phone. Make someone else a Super Admin first.</div>
            : p.given !== to && (
              <div className="rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[12.5px] space-y-1">
                <div><b className="text-[#0d7a4f]">Gains {diff.gained.length}</b>{diff.gained.length ? `: ${diff.gained.slice(0, 6).map(k => ITEM.get(k)?.label).join(', ')}${diff.gained.length > 6 ? ` and ${diff.gained.length - 6} more` : ''}` : ''}</div>
                <div><b className="text-[#c8323d]">Loses {diff.lost.length}</b>{diff.lost.length ? `: ${diff.lost.slice(0, 6).map(k => ITEM.get(k)?.label).join(', ')}${diff.lost.length > 6 ? ` and ${diff.lost.length - 6} more` : ''}` : ''}</div>
              </div>
            )}
          <label className="block space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Why? Required</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13.5px] text-tn-ink outline-none focus:border-tn-teal" /></label>
          {error && <p className="text-[12.5px] font-semibold text-[#b3271f] m-0">{error}</p>}
        </>
      )}
    </Modal>
  )
}

// ── Check a person ─────────────────────────────────────────────────────────

function CheckPerson({ people, rules, teamName, today, initialWho, onPreview }: {
  people: Person[]; rules: Rules; teamName: Map<string, string>; today: string; initialWho: string | null
  onPreview: (level: ConfigurableLevel, team?: string, lead?: boolean) => void
}) {
  const [who, setWho] = useState(initialWho && people.some(p => p.id === initialWho) ? initialWho : people[0]?.id ?? '')
  const p = people.find(x => x.id === who)
  const memo = new Map<string, Decision>()
  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex items-center gap-3 flex-wrap`}>
        <span className="text-[13px] font-bold text-tn-ink">Whose access?</span>
        <div className="min-w-[260px]"><Select value={who} onChange={setWho} options={people.map(x => ({ value: x.id, label: `${x.name} · ${LEVEL_LABEL[x.level]}` }))} searchable fullWidth ariaLabel="Person" /></div>
        <span className="text-[12px] text-muted">Every page, tool, tab and action, and the rule that decided it. From the saved rules.</span>
      </div>
      {p && (
        <div className={`${card} p-4 space-y-3`}>
          <div className="flex items-center gap-3 flex-wrap">
            <Face p={p} size={40} />
            <div className="min-w-0">
              <h3 className="font-(family-name:--font-display) font-black text-[19px] text-tn-ink m-0">{p.name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                <span className="text-[11.5px] font-bold rounded-full bg-tn-primary text-[#ffffff] px-2">{LEVEL_LABEL[p.level]}{p.given ? '' : ' (automatic)'}</span>
                {[...p.teams].map(([id, lead]) => <span key={id} className="text-[11.5px] font-semibold rounded-full bg-[#efedfc] text-[#5b4bc4] px-2">{lead ? 'Lead' : 'Member'} of {teamName.get(id) ?? 'a team'}</span>)}
                {(p.exceptions ?? []).map(e => <span key={e.key} className="text-[11.5px] font-semibold rounded-full bg-[#fbf1cf] text-[#8a6703] px-2">Exception: {ITEM.get(e.key)?.label ?? e.key}</span>)}
              </div>
            </div>
            {p.level !== 'super_admin' && (
              <button type="button" className={`${btn} ml-auto`} onClick={() => { const [t, lead] = [...p.teams][0] ?? ['', false]; onPreview(p.level as ConfigurableLevel, t, lead) }}>{Glyph.eye} See their portal</button>
            )}
          </div>
          {CATALOGUE.filter(m => m.kind === 'module').map(m => {
            const items = descendants(m.key).filter(i => !i.soon)
            if (!items.length) return null
            return (
              <div key={m.key} className="space-y-0.5">
                <h4 className="font-(family-name:--font-display) font-extrabold text-[12px] tracking-[.08em] uppercase text-tn-teal mt-2 mb-1">{m.label}</h4>
                {items.map(i => {
                  const x = decide(p, i.key, rules, { today, teamNames: teamName, memo })
                  const deep = i.parent && ITEM.get(i.parent)?.kind !== 'module'
                  return (
                    <div key={i.key} className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-2.5 items-center rounded-[8px] px-2.5 py-1 odd:bg-[#fafbfc]" style={{ paddingLeft: deep ? 34 : 10 }}>
                      <span className={x.ok ? 'text-[#1E9E6A] font-black' : 'text-[#b3bcc8]'}>{x.ok ? '✓' : '–'}</span>
                      <span className={`text-[13px] ${x.ok ? 'text-tn-ink' : 'text-muted'}`}>{i.label} <span className="text-[11px] text-muted">{KIND_TAG[i.kind as Exclude<ItemKind, 'module'>]?.label}</span></span>
                      <span className="flex flex-wrap gap-1 justify-end">{x.reasons.map(r => <span key={r.text} className={`text-[11px] font-semibold rounded-full px-2 ${r.kind === 'exception' ? 'bg-[#fbf1cf] text-[#8a6703]' : x.ok ? 'bg-[rgba(30,125,127,.1)] text-tn-teal' : 'bg-subtle text-muted'}`}>{r.text}</span>)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Exceptions ─────────────────────────────────────────────────────────────

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10)
}
function endOfMonth(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

function Exceptions({ data, people, onDone }: { data: AccessPageData; people: Person[]; onDone: () => void }) {
  const [adding, setAdding] = useState(false)
  const [ending, setEnding] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const end = (id: string) => {
    setError(null)
    start(async () => {
      const res = await endException(id, reason).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) { setEnding(null); setReason(''); onDone() } else setError(res.error)
    })
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[13.5px] text-muted m-0">One person, one item, for a while, without changing their level or their teams. Each one ends on its date by itself, and every exception is in the change log.</p>
        <button type="button" className={btnNavy} onClick={() => setAdding(true)}>+ Add an exception</button>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full border-collapse text-[13px] min-w-[820px]">
          <thead><tr>{['Person', 'Item', 'Effect', 'Until', 'Reason', 'Added', ''].map(h => <th key={h} className="text-left bg-subtle px-3 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted">{h}</th>)}</tr></thead>
          <tbody>
            {data.exceptions.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-muted">No exceptions. Everyone follows their level and teams.</td></tr>}
            {data.exceptions.map(e => {
              const item = ITEM.get(e.key)
              return (
                <tr key={e.id} className="border-t border-[var(--row-rule)] align-top">
                  <td className="px-3 py-2.5"><b className="text-tn-ink">{e.person}</b></td>
                  <td className="px-3 py-2.5">{item?.label ?? e.key} {item && item.kind !== 'module' && <Tag kind={item.kind as Exclude<ItemKind, 'module'>} />}</td>
                  <td className="px-3 py-2.5"><span className={`text-[11.5px] font-bold rounded-full px-2 py-0.5 ${e.effect === 'grant' ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#fce8e9] text-[#c8323d]'}`}>{e.effect === 'grant' ? 'Can open' : 'Cannot open'}</span></td>
                  <td className="px-3 py-2.5">{e.until ?? 'Until removed'}</td>
                  <td className="px-3 py-2.5">{e.reason}</td>
                  <td className="px-3 py-2.5 text-muted">{e.by ?? 'Someone'}, {when(e.at)}</td>
                  <td className="px-3 py-2.5">
                    {ending === e.id ? (
                      <div className="space-y-1.5 min-w-[220px]">
                        <input value={reason} onChange={x => setReason(x.target.value)} placeholder="Why end it now?" className="w-full rounded-[8px] border border-[var(--panel-border)] px-2 py-1 text-[12.5px]" />
                        <div className="flex gap-1.5"><button type="button" className={btnNavy} disabled={reason.trim().length < 8 || pending} onClick={() => end(e.id)}>End it</button><button type="button" className={btn} onClick={() => setEnding(null)}>Cancel</button></div>
                        {error && <p className="text-[12px] text-[#b3271f] m-0">{error}</p>}
                      </div>
                    ) : <button type="button" className="text-[12.5px] font-bold text-tn-teal" onClick={() => { setEnding(e.id); setReason('') }}>End now</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {adding && <AddException people={people} today={data.today} onClose={() => setAdding(false)} onDone={() => { setAdding(false); onDone() }} />}
    </div>
  )
}

function AddException({ people, today, onClose, onDone }: { people: Person[]; today: string; onClose: () => void; onDone: () => void }) {
  const [personId, setPersonId] = useState('')
  const [key, setKey] = useState('')
  const [effect, setEffect] = useState<'grant' | 'deny'>('grant')
  const [until, setUntil] = useState<string | null>(endOfMonth(today))
  const [custom, setCustom] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const items = CATALOGUE.filter(i => i.kind !== 'module' && !i.superOnly && !i.always && !i.soon)
  const options = items.map(i => {
    let mod = i
    while (mod.parent) mod = ITEM.get(mod.parent)!
    const parent = i.parent && ITEM.get(i.parent)?.kind !== 'module' ? `${ITEM.get(i.parent)!.label} › ` : ''
    return { value: i.key, label: `${parent}${i.label}`, group: mod.label }
  })
  const p = people.find(x => x.id === personId)
  const item = ITEM.get(key)
  const save = () => {
    setError(null)
    start(async () => {
      const res = await addException({ personId, key, effect, until, reason }).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) onDone(); else setError(res.error)
    })
  }
  return (
    <Modal kicker="Exception" title="Add an exception" onClose={onClose}
      foot={<><span /><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Cancel</button><button type="button" className={btnNavy} disabled={!p || !item || reason.trim().length < 8 || pending} onClick={save}>{pending ? 'Adding…' : 'Add exception'}</button></span></>}>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Person</span>
        <Select value={personId} onChange={setPersonId} options={people.filter(x => x.level !== 'super_admin').map(x => ({ value: x.id, label: `${x.name} · ${LEVEL_LABEL[x.level]}` }))} searchable fullWidth placeholder="Choose a person…" ariaLabel="Person" /></div>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Item</span>
        <Select value={key} onChange={setKey} options={options} searchable fullWidth placeholder="Choose a page, tool, tab or action…" ariaLabel="Item" /></div>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Effect</span>
        <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
          {([['grant', 'Can open'], ['deny', 'Cannot open']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setEffect(v)} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${effect === v ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{l}</button>)}
        </div></div>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Until</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5 flex-wrap">
            {([['1 week', addDays(today, 7)], ['End of the month', endOfMonth(today)], ['Until removed', null]] as const).map(([l, v]) => <button key={l} type="button" onClick={() => { setCustom(false); setUntil(v) }} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${!custom && until === v ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{l}</button>)}
            <button type="button" onClick={() => { setCustom(true); setUntil(addDays(today, 14)) }} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${custom ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>A date…</button>
          </div>
          {custom && <input type="date" value={until ?? ''} min={today} onChange={e => setUntil(e.target.value || null)} className="rounded-[9px] border border-[var(--panel-border)] px-2 py-1.5 text-[13px] text-tn-ink" />}
        </div></div>
      {p && item && (
        <div className="rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[12.5px]">
          {p.name.split(' ')[0]} will {effect === 'grant' ? 'open' : 'not open'} <b className="text-tn-ink">{item.label}</b>{until ? ` until ${until}` : ' until the exception is removed'}, whatever their level and teams say.{effect === 'grant' && item.parent && ITEM.get(item.parent)?.kind !== 'module' ? ` It still needs ${ITEM.get(item.parent)!.label} to be open to them.` : ''}
        </div>
      )}
      <label className="block space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Why? Required</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13.5px] text-tn-ink outline-none focus:border-tn-teal" /></label>
      {error && <p className="text-[12.5px] font-semibold text-[#b3271f] m-0">{error}</p>}
    </Modal>
  )
}

// ── Change log ─────────────────────────────────────────────────────────────

const KIND_NAME: Record<string, string> = { rules: 'Permissions', 'tool-teams': 'Teams for tools', level: 'Levels', exception: 'Exceptions', position: 'Team positions', undo: 'Undo' }

type Change = { kind?: string; level?: string; key?: string; label?: string; before?: unknown; after?: unknown; beforeEffective?: boolean; person?: string; from?: string; to?: string; effect?: string; until?: string | null; teamNames?: Record<string, string> }

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

function ChangeLog({ log, teamName, onDone }: { log: AccessPageData['log']; teamName: Map<string, string>; onDone: () => void }) {
  const [filter, setFilter] = useState<string>('all')
  const [undoing, setUndoing] = useState<AccessPageData['log'][number] | null>(null)
  const [openImpact, setOpenImpact] = useState<number | null>(null)
  const kinds = ['all', ...Object.keys(KIND_NAME)]
  const shown = log.filter(e => filter === 'all' || e.kind === filter)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {kinds.map(k => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filter === k ? 'bg-tn-primary text-[#ffffff] border-tn-primary' : 'bg-white border-[var(--panel-border)] text-tn-ink'}`}>{k === 'all' ? 'Everything' : KIND_NAME[k]}</button>)}
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
