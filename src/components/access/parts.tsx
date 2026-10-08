'use client'

import { useEffect, useRef } from 'react'
import { type PriorityAccessData, type PriorityPerson } from '@/components/admin/TeamPriorityAccess'
import { CATALOGUE, CHILDREN, type AccessLevel, type CatalogueItem, type ItemKind } from '@/lib/access/catalogue'
import { type Audience, type Exception, type Subject, type ToolScope } from '@/lib/access/decide'
import { initialsOf } from '@/lib/directory/people-types'

// ── Data from the server ───────────────────────────────────────────────────

export type Tab = 'permissions' | 'people' | 'why' | 'exceptions' | 'log'

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

export type Person = Omit<AccessPageData['people'][number], 'teams'> & Subject

// ── Small parts ────────────────────────────────────────────────────────────

export const KIND_TAG: Record<Exclude<ItemKind, 'module'>, { label: string; plural: string; cls: string; card: string; help: string }> = {
  page: { label: 'Page', plural: 'pages', cls: 'bg-[rgba(30,125,127,.1)] text-tn-teal', card: 'bg-[rgba(30,125,127,.07)] border-[#cfe5e5] text-tn-teal', help: 'A screen with its own address, like Report or Directory.' },
  tool: { label: 'Tool', plural: 'tools', cls: 'bg-[#efedfc] text-[#5b4bc4]', card: 'bg-[#f5f3fd] border-[#dcd7f6] text-[#5b4bc4]', help: 'A page in the Tools panel. Besides the level, one of the person\'s teams must be on its team list.' },
  tab: { label: 'Tab', plural: 'tabs', cls: 'bg-subtle text-muted', card: 'bg-subtle border-[var(--panel-border)] text-muted', help: 'A part of a page you switch to with tabs, like Report > Workload.' },
  action: { label: 'Action', plural: 'actions', cls: 'bg-[#eef3fb] text-[#3a5a8c]', card: 'bg-[#eef3fb] border-[#d9e3f3] text-[#3a5a8c]', help: 'Something you can do or see inside a page: export, edit, a sensitive column.' },
}

export const KIND_COUNT = Object.fromEntries((['page', 'tool', 'tab', 'action'] as const).map(k => [k, CATALOGUE.filter(i => i.kind === k).length])) as Record<Exclude<ItemKind, 'module'>, number>

export function Tag({ kind }: { kind: Exclude<ItemKind, 'module'> }) {
  const k = KIND_TAG[kind]
  return <span title={k.help} className={`inline-block rounded-[5px] px-1.5 py-px font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.08em] uppercase cursor-help ${k.cls}`}>{k.label}</span>
}

export const Glyph = {
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>,
  dash: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M7 12h10" /></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>,
  people: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  chev: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>,
}

export const btn = 'inline-flex items-center gap-1.5 rounded-[9px] border border-[var(--panel-border)] bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold whitespace-nowrap transition-colors hover:border-tn-teal disabled:opacity-45'
export const btnNavy = 'inline-flex items-center gap-1.5 rounded-[9px] bg-tn-primary text-[#ffffff] px-3.5 py-2 text-[13px] font-bold whitespace-nowrap disabled:opacity-45'
export const card = 'rounded-[14px] border border-[var(--panel-border)] bg-white'

export function Modal({ title, kicker, wide, onClose, children, foot }: { title: string; kicker: string; wide?: boolean; onClose: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  // The latest onClose, read by the key handler: the effect itself runs once,
  // when the popup opens, so typing (which re-renders) never moves focus.
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  // Keyboard: focus moves into the popup when it opens, Tab stays inside it,
  // Escape closes it, and focus goes back to where it was (audit, 8 October 2026).
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const focusables = () => [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
    ;(focusables().find(el => el.getAttribute('aria-label') !== 'Close') ?? box.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close.current(); return }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [])
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(1,35,88,.38)] flex items-center justify-center p-4 overflow-y-auto" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`outline-none w-full ${wide ? 'max-w-[1080px]' : 'max-w-[640px]'} max-h-[calc(100vh-32px)] bg-white rounded-[18px] shadow-[0_30px_60px_-20px_rgba(1,35,88,.55)] overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]`}>
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

export function Face({ p, size = 28 }: { p: { name: string; avatarUrl: string | null }; size?: number }) {
  if (p.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  }
  return <span className="rounded-full bg-tn-primary text-[#ffffff] inline-flex items-center justify-center font-(family-name:--font-display) font-extrabold shrink-0" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initialsOf(p.name)}</span>
}

export const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Everything inside an item (its tabs and actions, and theirs). */
export function descendants(key: string): CatalogueItem[] {
  const out: CatalogueItem[] = []
  for (const c of CHILDREN.get(key) ?? []) out.push(c, ...descendants(c.key))
  return out
}

// ── Permissions ────────────────────────────────────────────────────────────

export function teamSummary(scope: ToolScope | undefined): string {
  if (scope?.every) return 'Every team'
  const n = scope?.teams.size ?? 0
  if (!n) return 'No team yet'
  return `${n} ${n === 1 ? 'team has' : 'teams have'} access`
}

// ── Exceptions ─────────────────────────────────────────────────────────────

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10)
}
export function endOfMonth(iso: string) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}
