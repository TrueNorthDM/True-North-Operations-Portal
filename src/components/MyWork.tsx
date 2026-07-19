'use client'

/**
 * MyWork: the "My Work" screen: everything assigned to the signed-in person,
 * as a kanban board or a list, with priority filters and a show/hide-done
 * toggle. Data is the in-repo sample (src/lib/mywork/data.ts) until the Monday
 * pull is wired.
 */

import { useMemo, useState } from 'react'
import { TASKS, PROJECT_COLOR, PEOPLE, type Prio, type Status } from '@/lib/mywork/data'

// Priority pill styling, theme-aware via the shared --bdg-* badge palette.
const PRIO_META: Record<Prio, { label: string; cls: string; rank: number }> = {
  high: { label: 'High', cls: 'text-[var(--bdg-red-fg)] bg-[var(--bdg-red-bg)]', rank: 0 },
  med: { label: 'Medium', cls: 'text-[var(--bdg-gold-fg)] bg-[var(--bdg-gold-bg)]', rank: 1 },
  low: { label: 'Low', cls: 'text-[var(--bdg-slate-fg)] bg-[var(--bdg-slate-bg)]', rank: 2 },
}

const COLUMNS: { key: Status; name: string; color: string }[] = [
  { key: 'todo', name: 'To Do', color: '#8593a4' },
  { key: 'doing', name: 'In Progress', color: '#F2C40A' },
  { key: 'review', name: 'In Review', color: '#4a7ec0' },
  { key: 'done', name: 'Done', color: '#1E7D7F' },
]

const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: 'To Do', color: '#8593a4' },
  doing: { label: 'In Progress', color: '#B8790A' },
  review: { label: 'In Review', color: '#4a7ec0' },
  done: { label: 'Done', color: '#1E7D7F' },
}

const STATUS_ORDER: Record<Status, number> = { todo: 0, doing: 1, review: 2, done: 3 }

const initials = (who: string) => who

function ProjectChip({ project }: { project: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-foreground bg-slate-100 rounded-full px-2.5 py-[3px]">
      <span className="w-[7px] h-[7px] rounded-[2px]" style={{ background: PROJECT_COLOR[project] ?? '#8593a4' }} />
      {project}
    </span>
  )
}

function PrioPill({ prio }: { prio: Prio }) {
  return <span className={`inline-flex items-center text-[10px] font-extrabold uppercase tracking-wide rounded-full px-2 py-[3px] ${PRIO_META[prio].cls}`}>{PRIO_META[prio].label}</span>
}

function Avatar({ who, size = 26 }: { who: string; size?: number }) {
  const p = PEOPLE[who]
  return (
    <span
      title={p?.name}
      className="inline-flex items-center justify-center rounded-full font-(family-name:--font-display) font-extrabold shrink-0"
      style={{ width: size, height: size, background: p?.bg ?? '#012358', color: p?.fg ?? '#fff', fontSize: size <= 24 ? 10 : 10.5 }}
    >
      {initials(who)}
    </span>
  )
}

const CalIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
)

export function MyWork() {
  const [view, setView] = useState<'board' | 'list'>('board')
  const [prio, setPrio] = useState<'all' | Prio>('all')
  const [showDone, setShowDone] = useState(true)

  const filtered = useMemo(
    () => TASKS.filter(t => (prio === 'all' || t.prio === prio) && (showDone || t.status !== 'done')),
    [prio, showDone],
  )

  const columns = COLUMNS.filter(c => c.key !== 'done' || showDone).map(c => ({
    ...c,
    tasks: filtered.filter(t => t.status === c.key),
  }))

  const listTasks = useMemo(
    () => [...filtered].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || PRIO_META[a.prio].rank - PRIO_META[b.prio].rank),
    [filtered],
  )

  const open = TASKS.filter(t => t.status !== 'done')
  const totalOpen = open.length
  const highCount = open.filter(t => t.prio === 'high').length
  const dueSoonCount = open.filter(t => t.dueSoon).length

  const toggleBtn = (active: boolean) =>
    `inline-flex items-center gap-[7px] font-(family-name:--font-display) font-extrabold text-[13px] rounded-lg px-[15px] py-2 transition-all ${
      active ? 'bg-tn-primary text-white shadow-[0_6px_14px_-8px_rgba(1,35,88,.6)]' : 'text-muted'
    }`

  return (
    <div>
      {/* heading + view toggle */}
      <div className="flex items-start justify-between gap-5 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">My Work</h1>
            <span className="font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase text-[var(--bdg-gold-fg)] bg-[var(--bdg-gold-bg)] rounded-full px-2 py-[3px]" title="Sample data until the Monday integration is wired">Sample</span>
          </div>
          <p className="text-[15px] text-muted mt-1.5">Everything assigned to you across Monday, in one place.</p>
        </div>
        <div className="shrink-0 inline-flex gap-[3px] p-1 border border-slate-200 bg-white rounded-[11px]">
          <button type="button" onClick={() => setView('board')} className={toggleBtn(view === 'board')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="11" rx="1" /></svg>
            <span className={view === 'board' ? 'text-[#ffffff]' : ''}>Board</span>
          </button>
          <button type="button" onClick={() => setView('list')} className={toggleBtn(view === 'list')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
            <span className={view === 'list' ? 'text-[#ffffff]' : ''}>List</span>
          </button>
        </div>
      </div>

      {/* summary + filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-[22px]">
        <div className="flex items-center gap-[18px] text-[13px] text-muted">
          <span><strong className="text-tn-ink font-(family-name:--font-display) font-extrabold text-[15px]">{totalOpen}</strong> open</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span><strong className="font-(family-name:--font-display) font-extrabold text-[15px] text-[#D64545]">{highCount}</strong> high priority</span>
          <span className="w-1 h-1 rounded-full bg-slate-300" />
          <span><strong className="text-tn-ink font-(family-name:--font-display) font-extrabold text-[15px]">{dueSoonCount}</strong> due this week</span>
        </div>
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-[7px]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Priority</span>
            {(['all', 'high', 'med', 'low'] as const).map(k => {
              const active = prio === k
              const label = k === 'all' ? 'All' : k === 'med' ? 'Med' : k === 'high' ? 'High' : 'Low'
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPrio(k)}
                  className={`text-xs font-bold rounded-full px-[13px] py-[5px] border transition-all ${
                    active ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-muted hover:border-tn-teal'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <label className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-foreground cursor-pointer select-none">
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="w-[15px] h-[15px] cursor-pointer accent-tn-teal" />
            Show done
          </label>
        </div>
      </div>

      {/* board */}
      {view === 'board' && (
        <div className="flex gap-4 items-start overflow-x-auto pb-2">
          {columns.map(col => (
            <div key={col.key} className="flex-1 min-w-[250px] bg-subtle border border-slate-200 rounded-[14px] p-3">
              <div className="flex items-center gap-2.5 px-1.5 pt-1 pb-3">
                <span className="w-[9px] h-[9px] rounded-full" style={{ background: col.color }} />
                <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{col.name}</span>
                <span className="ml-auto text-[11.5px] font-bold text-muted bg-white border border-slate-200 rounded-full min-w-[22px] text-center px-[7px] py-px tabular-nums">{col.tasks.length}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {col.tasks.map(t => (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-[12px] px-3.5 py-[13px] shadow-[0_1px_2px_rgba(1,35,88,.06)] cursor-pointer transition-all hover:-translate-y-0.5 hover:border-tn-teal hover:shadow-[0_12px_26px_-14px_rgba(1,35,88,.35)]">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <ProjectChip project={t.project} />
                      <PrioPill prio={t.prio} />
                    </div>
                    <div className="text-[13.5px] font-semibold text-tn-ink leading-snug">{t.title}</div>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: t.dueSoon ? '#D64545' : 'var(--muted)' }}>
                        {CalIcon}
                        {t.due}
                      </span>
                      <Avatar who={t.who} />
                    </div>
                  </div>
                ))}
                {col.tasks.length === 0 && (
                  <div className="border-[1.5px] border-dashed border-slate-300 rounded-[10px] px-2.5 py-[18px] text-center text-xs text-muted">Nothing here</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* list */}
      {view === 'list' && (
        <div className="border border-slate-200 bg-white rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
          <div className="grid grid-cols-[2.6fr_1.1fr_1fr_0.9fr_1fr] gap-3 px-5 py-3 bg-subtle border-b border-slate-200 text-[10.5px] font-extrabold uppercase tracking-wide text-muted">
            <span>Task</span><span>Project</span><span>Assignee</span><span>Priority</span><span>Status &amp; due</span>
          </div>
          {listTasks.map(t => (
            <div key={t.id} className="grid grid-cols-[2.6fr_1.1fr_1fr_0.9fr_1fr] gap-3 items-center px-5 py-[13px] border-b border-slate-100 last:border-0 transition-colors hover:bg-subtle">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_META[t.status].color }} />
                <span className="text-[13.5px] font-semibold text-tn-ink truncate">{t.title}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-foreground min-w-0">
                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: PROJECT_COLOR[t.project] ?? '#8593a4' }} />
                <span className="truncate">{t.project}</span>
              </span>
              <span className="inline-flex items-center gap-2 text-xs text-foreground min-w-0">
                <Avatar who={t.who} size={24} />
                <span className="truncate">{PEOPLE[t.who]?.name}</span>
              </span>
              <span className="justify-self-start"><PrioPill prio={t.prio} /></span>
              <div className="flex flex-col gap-[3px]">
                <span className="text-[11px] font-bold" style={{ color: STATUS_META[t.status].color }}>{STATUS_META[t.status].label}</span>
                <span className="text-[11.5px] font-semibold" style={{ color: t.dueSoon ? '#D64545' : 'var(--muted)' }}>{t.due}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
