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

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/useConfirm'
import { withViewAs } from '@/components/ViewAsKeeper'
import { LEVELS, type AccessLevel, type ConfigurableLevel } from '@/lib/access/catalogue'
import { overlay, type Rules, type ToolScope } from '@/lib/access/decide'
import { type Tab, type AccessPageData, type Person } from './parts'

export type { AccessPageData } from './parts'
import { Permissions } from './Permissions'
import { type PreviewState, LevelPreview } from './LevelPreview'
import { PeopleLevels, CheckPerson } from './PeopleLevels'
import { Exceptions } from './Exceptions'
import { ChangeLog } from './ChangeLog'

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

  // Unsaved changes are never lost without asking (audit, 8 October 2026):
  // closing or reloading the tab, and following a link inside the portal.
  // The question is the portal's own dialog, not window.confirm (audit, 13
  // October 2026). It answers later, so the click is held back and the link
  // followed by hand on a yes. A link out of the portal is left to the
  // browser's own leave warning, which unloading the page raises anyway.
  const [confirmDialog, confirm] = useConfirm()
  useEffect(() => {
    if (!staged) return
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement | null)?.closest?.('a')
      if (!a || a.target === '_blank' || !a.getAttribute('href') || a.getAttribute('href')!.startsWith('#')) return
      const to = new URL(a.href, window.location.href)
      if (to.origin !== window.location.origin) return
      e.preventDefault()
      e.stopPropagation()
      void confirm({
        title: 'Leave without saving?',
        body: `You have ${staged} unsaved change${staged === 1 ? '' : 's'}. Leave this page without saving ${staged === 1 ? 'it' : 'them'}?`,
        action: 'Leave without saving',
        danger: true,
      }).then(yes => {
        if (yes) router.push(withViewAs(to.pathname + to.search + to.hash))
      })
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onClick, true) }
  }, [staged, confirm, router])

  const people: Person[] = useMemo(() => data.people.map(p => ({ ...p, teams: new Map(p.teams) })), [data.people])
  const teamName = useMemo(() => new Map(data.teams.map(t => [t.id, t.name])), [data.teams])
  const counts = useMemo(() => Object.fromEntries(LEVELS.map(l => [l.key, people.filter(p => p.level === l.key).length])) as Record<AccessLevel, number>, [people])

  const [preview, setPreview] = useState<PreviewState | null>(null)
  const openPreview = (level: ConfigurableLevel, team?: string, lead?: boolean) => {
    const firstTeam: string = team ?? [...(people.find(p => p.level === level && p.teams.size)?.teams.keys() ?? [])][0] ?? data.teams[0]?.id ?? ''
    setPreview({ level, team: firstTeam, lead: lead ?? level === 'team_leader' })
  }
  // A real person's portal: all their teams and their exceptions, so it agrees
  // with Check a person and with View Stage (decided 8 October 2026).
  const openPersonPreview = (p: Person) => {
    const [team, lead] = [...p.teams][0] ?? ['', false]
    setPreview({ level: p.level as ConfigurableLevel, team, lead, person: { name: p.name, teams: p.teams, exceptions: p.exceptions ?? [] } })
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
      {confirmDialog}
      <nav aria-label="Access levels" role="tablist" className="flex items-center gap-0.5 border-b border-[var(--panel-border)] flex-wrap">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
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
      {tab === 'why' && <CheckPerson people={people} rules={base} teamName={teamName} today={data.today} initialWho={data.initialWho} onPreview={openPersonPreview} />}
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
