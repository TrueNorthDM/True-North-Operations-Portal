'use client'

/**
 * TargetsEditor: edit weekly publishing pace targets (Settings › Publishing
 * targets, and Boards Review · Targets).
 *
 * Admins get inline edit / add / remove (Server Actions, RLS-enforced). Viewers
 * get a read-only list. Styled to the True North handoff: one card per board,
 * flag-coloured language dots, filled inputs, and a branded change history.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BOARDS, PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { saveTargetValue, addTarget, deleteTarget } from '@/app/(app)/boards-beta/targets/actions'
import { initialsOf, PILL_CLASS, type PillKind } from '@/components/admin/people-types'
import type { PublishingTargetRow, AuditLogRow } from '@/lib/types/database.types'

// ── Language dots, flag colours, keyed by the Monday label text ─────────────
const LANG_DOT: Record<string, string> = {
  english: '#111111',
  spanish: '#F5B800',
  portuguese: '#009C3B',
  swahili: '#00A3DD',
  french: '#0055A4',
}
const langDot = (name: string) => LANG_DOT[name.trim().toLowerCase()] ?? '#8593a4'

// Board short code without the -P/-T workflow suffix: "AAAF-P" → "AAAF".
const shortAbbr = (short: string | null | undefined) => (short ?? '').replace(/-[PT]$/i, '')

// Site-brand badge tint, keyed by the abbreviation (matches Sites & languages):
// AAAF green, HFA orange. Theme-aware via the app's brand tokens.
const BOARD_BADGE: Record<string, string> = {
  aaaf: 'bg-aaaf-soft text-aaaf-primary',
  hfa: 'bg-hfa-soft text-hfa-primary',
}
const boardBadge = (abbr: string) => BOARD_BADGE[abbr.toLowerCase()] ?? 'bg-tn-primary text-white'

// ── Icons (stroke, 16px) ─────────────────────────────────────────────────────
const iconCls = 'w-4 h-4'
const Trash = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9}><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg>
const Plus = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
// Gold-stroke icons for the per-block Edit / Save button (matches the handoff).
const PencilGold = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const CheckGold = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>

const iconBtn = 'inline-flex items-center justify-center p-1.5 rounded-md text-muted hover:text-tn-ink hover:bg-subtle transition-colors disabled:opacity-30'
const paceInput = 'w-[68px] text-center tabular-nums font-semibold text-tn-ink bg-subtle border border-slate-200 rounded-[9px] px-2 py-1.5 text-sm focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20'

export function TargetsEditor({
  targets,
  isAdmin,
  audit,
  grid = false,
}: {
  targets: PublishingTargetRow[]
  isAdmin: boolean
  audit: AuditLogRow[]
  grid?: boolean          // when true, lay the board cards out side by side
}) {
  const byBoard = new Map<string, PublishingTargetRow[]>()
  for (const t of targets) {
    const arr = byBoard.get(t.board_id) ?? []
    arr.push(t)
    byBoard.set(t.board_id, arr)
  }
  const boardIds = [...new Set([...PUBLISHING_BOARD_IDS.filter((b) => byBoard.has(b)), ...byBoard.keys()])]

  return (
    <div className="space-y-8">
      {!isAdmin && (
        <div className="rounded-[12px] border border-slate-200 bg-subtle px-4 py-3 text-sm text-muted">
          View-only: ask an admin to change targets.
        </div>
      )}

      <div className={grid ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : 'space-y-6'}>
        {boardIds.map((bid) => (
          <BoardTargets key={bid} boardId={bid} rows={byBoard.get(bid) ?? []} isAdmin={isAdmin} />
        ))}
      </div>

      {boardIds.length === 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-subtle p-8 text-center text-sm text-muted">
          No targets yet.
        </div>
      )}

      {isAdmin && <AuditHistory audit={audit} />}
    </div>
  )
}

function BoardTargets({ boardId, rows, isAdmin }: { boardId: string; rows: PublishingTargetRow[]; isAdmin: boolean }) {
  const router = useRouter()
  const config = BOARDS[boardId]
  const sorted = [...rows].sort((a, b) => a.language.localeCompare(b.language))
  const abbr = shortAbbr(config?.short) || (config?.name ?? boardId).slice(0, 4).toUpperCase()

  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function enterEdit() {
    setValues(Object.fromEntries(sorted.map((r) => [r.id, String(r.target_value)])))
    setError(null)
    setEditing(true)
  }
  function saveAll() {
    setError(null)
    start(async () => {
      for (const r of sorted) {
        const v = values[r.id]
        if (v != null && v !== '' && v !== String(r.target_value)) {
          const res = await saveTargetValue({ id: r.id, targetValue: Number(v) })
          if (!res.ok) { setError(res.error ?? 'Failed to save'); return }
        }
      }
      setEditing(false)
      router.refresh()
    })
  }
  function removeRow(id: string) {
    setError(null)
    start(async () => {
      const res = await deleteTarget({ id })
      if (!res.ok) setError(res.error ?? 'Failed to remove')
      else router.refresh()
    })
  }

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <div className="flex items-center gap-3 mb-4">
        <span className={`inline-flex w-9 h-9 items-center justify-center rounded-[9px] font-(family-name:--font-display) font-extrabold text-[12px] shrink-0 ${boardBadge(abbr)}`}>{abbr}</span>
        <div className="min-w-0">
          <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink truncate">{config?.name ?? boardId}</div>
          <div className="text-[12px] text-muted">{sorted.length} {sorted.length === 1 ? 'language' : 'languages'}</div>
        </div>
      </div>

      <div>
        {sorted.map((row) => (
          <div key={row.id} className="flex items-center gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
            <span className="w-[11px] h-[11px] rounded-[4px] shrink-0" style={{ background: langDot(row.language) }} />
            <span className="flex-1 min-w-0 font-(family-name:--font-display) font-bold text-tn-ink text-[13.5px] truncate">{row.language}</span>
            {editing ? (
              <>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={values[row.id] ?? String(row.target_value)}
                  onChange={(e) => setValues((v) => ({ ...v, [row.id]: e.target.value }))}
                  className={paceInput}
                  aria-label={`${row.language} weekly pace`}
                />
                <span className="text-[12px] text-muted">/wk</span>
                <button onClick={() => removeRow(row.id)} disabled={pending} className={iconBtn} title="Remove language" aria-label="Remove language"><Trash /></button>
              </>
            ) : (
              <>
                <span className="font-semibold text-tn-ink tabular-nums text-sm">{row.target_value}</span>
                <span className="text-[12px] text-muted">/wk</span>
              </>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="py-2 text-[13px] text-muted">No languages yet.</p>}
      </div>

      {editing && <AddTargetForm boardId={boardId} boardShort={config?.short ?? ''} />}

      {error && <p className="mt-3 text-xs text-[var(--bdg-red-fg)]">{error}</p>}

      {isAdmin && (
        <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={editing ? saveAll : enterEdit}
            disabled={pending}
            className={`inline-flex items-center gap-2 rounded-[10px] px-5 py-[11px] font-(family-name:--font-display) font-extrabold text-[13.5px] transition-all shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] hover:-translate-y-px disabled:opacity-60 ${editing ? 'bg-tn-teal text-white' : 'bg-tn-primary text-white'}`}
          >
            {editing ? <CheckGold /> : <PencilGold />}
            <span className="text-[#ffffff]">{editing ? (pending ? 'Saving…' : 'Save') : 'Edit'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function AddTargetForm({ boardId, boardShort }: { boardId: string; boardShort: string }) {
  const router = useRouter()
  const [language, setLanguage] = useState('')
  const [value, setValue] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    start(async () => {
      const res = await addTarget({ boardId, boardShort, language, targetValue: Number(value) })
      if (!res.ok) {
        setError(res.error ?? 'Failed')
        return
      }
      setLanguage('')
      setValue('')
      router.refresh()
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
      <input
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        placeholder="Language (e.g. French)"
        className="flex-1 min-w-[150px] font-(family-name:--font-display) font-semibold text-tn-ink text-sm bg-subtle border border-slate-200 rounded-[9px] px-3 py-2 focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20"
      />
      <input
        type="number"
        min={0}
        step="0.1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0"
        className={paceInput}
        aria-label="Weekly pace"
      />
      <span className="text-[12px] text-muted">/wk</span>
      <button
        onClick={add}
        disabled={pending || language.trim() === '' || value === ''}
        className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal bg-tn-teal-soft border border-dashed border-tn-teal rounded-[9px] px-3 py-2 hover:bg-tn-teal/15 transition-colors disabled:opacity-40"
      >
        <Plus /> Add language
      </button>
      {error && <span className="text-xs text-[var(--bdg-red-fg)]">{error}</span>}
    </div>
  )
}

// ── Change history, branded rows (avatar + badge + diff) ────────────────────
interface Change { label: string; kind: PillKind; summary: string }

/** Prettify an email into a display name: "ana.oliveira@x" → "Ana Oliveira". */
function actorFrom(email: string | null): string {
  if (!email) return 'System'
  const local = email.split('@')[0]
  const name = local.split(/[._-]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
  return name || email
}

function describeAudit(e: AuditLogRow): { subject: string; change: Change } {
  const row = (e.after ?? e.before ?? {}) as { board_short?: string; language?: string; target_value?: number }
  const subject = [row.language, shortAbbr(row.board_short)].filter(Boolean).join(' · ')
  if (e.action === 'update') {
    const before = (e.before as { target_value?: number } | null)?.target_value
    const after = (e.after as { target_value?: number } | null)?.target_value
    return { subject, change: { label: 'Weekly pace', kind: 'teal', summary: `${before} → ${after} /wk` } }
  }
  if (e.action === 'insert') return { subject, change: { label: 'Added', kind: 'green', summary: `set to ${row.target_value} /wk` } }
  return { subject, change: { label: 'Removed', kind: 'grey', summary: '' } }
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

function AuditHistory({ audit }: { audit: AuditLogRow[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink">Change history</h3>
        {audit.length > 0 && <span className="text-[12.5px] text-muted">{audit.length} {audit.length === 1 ? 'entry' : 'entries'}</span>}
      </div>
      {audit.length === 0 ? (
        <div className="rounded-[12px] border border-slate-200 bg-white p-8 text-center space-y-2">
          <p className="text-sm font-medium text-tn-ink">No changes recorded yet</p>
          <p className="text-xs text-muted">Every target change will appear here with who changed it and when.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audit.map((e) => {
            const actor = actorFrom(e.user_email)
            const { subject, change } = describeAudit(e)
            return (
              <div key={e.id} className="rounded-[12px] border border-slate-200 bg-white px-4 py-3.5 flex items-start gap-3">
                <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[11px] mt-0.5">{initialsOf(actor)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] leading-snug">
                    <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{actor}</span>
                    <span className="text-muted"> changed </span>
                    {subject && <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{subject}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 ${PILL_CLASS[change.kind]}`}>{change.label}</span>
                    {change.summary && <span className="text-[12.5px] text-foreground tabular-nums">{change.summary}</span>}
                  </div>
                </div>
                <span className="shrink-0 text-[11.5px] text-muted whitespace-nowrap mt-0.5">{fmtWhen(e.created_at)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
