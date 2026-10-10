'use client'

/**
 * TargetsEditor: Settings > Publishing targets. The weekly publishing target
 * per board and language, the people who count as publishers, and the change
 * history.
 *
 * Every write is a Server Action (targets-actions.ts) that checks the
 * Publishing targets grant for the person really signed in and then writes
 * with the server's own client, so the grant decides, not a database policy.
 * Without `canEdit` the same lists show read-only, with no edit controls.
 *
 * Since 10 October 2026 (audit): a language is chosen from the ones the
 * board's site publishes rather than typed, targets are whole numbers, a
 * removal asks first, a save that fails part way says which rows went in, and
 * the publishers list is edited here instead of living in the code.
 */

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveTargetValue, addTarget, deleteTarget, addPublisher, removePublisher,
} from '@/app/(app)/admin/settings/targets-actions'
import { initialsOf, PILL_CLASS, type PillKind } from '@/lib/directory/people-types'
import type { PublishingTargetRow, AuditLogRow } from '@/lib/types/database.types'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { Select } from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/useConfirm'
import type { TargetsBoard as TargetsBoardInfo } from '@/lib/boards/targets-data'

// ── Language dots, flag colours, keyed by the Monday label text ─────────────
const LANG_DOT: Record<string, string> = {
  english: '#111111',
  spanish: '#F5B800',
  portuguese: '#009C3B',
  swahili: '#00A3DD',
  french: '#0055A4',
}
const langDot = (name: string) => LANG_DOT[name.trim().toLowerCase()] ?? '#8593a4'

// Board short code without the -P/-T workflow suffix: "AAAF-P" -> "AAAF".
export const shortAbbr = (short: string | null | undefined) => (short ?? '').replace(/-[PT]$/i, '')

// Site-brand badge tint, keyed by the abbreviation (matches Sites & languages):
// AAAF green, HFA orange. Theme-aware via the app's brand tokens.
const BOARD_BADGE: Record<string, string> = {
  aaaf: 'bg-aaaf-soft text-aaaf-primary',
  hfa: 'bg-hfa-soft text-hfa-primary',
}
const boardBadge = (abbr: string) => BOARD_BADGE[abbr.toLowerCase()] ?? 'bg-tn-primary text-white'

/**
 * A weekly target as typed: a whole number, 0 or more, or null. The server
 * refuses anything else; saying so here names the row before anything is sent.
 * Exported for its test.
 */
export function parseTarget(raw: string): number | null {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n <= 1000 ? n : null
}

const BAD_TARGET = 'A target is a whole number of pages a week, 0 or more.'

/** "English", "English and Spanish", "English, Portuguese and Spanish". Exported for its test. */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The publisher name as it will be stored, or an error. Trimmed and with runs
 * of spaces made one, as the server does, and refused when it is already on
 * the list in any capitalisation. Exported for its test.
 */
export function checkPublisher(raw: string, existing: string[]): { name: string } | { error: string } {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) return { error: 'Write the full name as Monday shows it.' }
  if (existing.some(p => p.trim().toLowerCase() === name.toLowerCase())) return { error: `${name} is already a publisher.` }
  return { name }
}

// ── Icons (stroke, 16px) ─────────────────────────────────────────────────────
const iconCls = 'w-4 h-4'
const Trash = () => <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg>

const iconBtn = 'inline-flex items-center justify-center p-1.5 rounded-md text-muted hover:text-tn-ink hover:bg-subtle transition-colors disabled:opacity-30'
const paceInput = 'w-[68px] text-center tabular-nums font-semibold text-tn-ink bg-subtle border border-slate-200 rounded-[9px] px-2 py-1.5 text-sm focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20'
const textInput = 'flex-1 min-w-[180px] font-(family-name:--font-display) font-semibold text-tn-ink text-sm bg-subtle border border-slate-200 rounded-[9px] px-3 py-2 focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20'
const fieldLabel = 'block text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted mb-1'
const errorText = 'mt-3 text-xs text-[var(--bdg-red-fg)]'

export function TargetsEditor({
  targets,
  audit,
  boards,
  publishers,
  canEdit,
  grid = false,
}: {
  targets: PublishingTargetRow[]
  audit: AuditLogRow[]
  /** The publishing boards, with the language names each one's site publishes. */
  boards: TargetsBoardInfo[]
  /** Who counts as publisher on Monday. */
  publishers: string[]
  /** Publishing targets granted: the edit controls show. Without it, read-only. */
  canEdit: boolean
  grid?: boolean          // when true, lay the board cards out side by side
}) {
  const byBoard = new Map<string, PublishingTargetRow[]>()
  for (const t of targets) {
    const arr = byBoard.get(t.board_id) ?? []
    arr.push(t)
    byBoard.set(t.board_id, arr)
  }
  // The boards in the order the page sends them, then any board that has a
  // target but is no longer configured, so a stray row is still visible.
  const boardList: TargetsBoardInfo[] = [
    ...boards,
    ...[...byBoard.keys()]
      .filter(id => !boards.some(b => b.id === id))
      .map(id => {
        const short = byBoard.get(id)?.[0]?.board_short ?? id
        return { id, short, name: short, languages: [] }
      }),
  ]

  return (
    <div className="space-y-8">
      <div className={grid ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : 'space-y-6'}>
        {boardList.map((b) => (
          <BoardTargets key={b.id} board={b} rows={byBoard.get(b.id) ?? []} canEdit={canEdit} />
        ))}
      </div>

      {boardList.length === 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-subtle p-8 text-center text-sm text-muted">
          No publishing boards yet.
        </div>
      )}

      <Publishers names={publishers} canEdit={canEdit} />

      <AuditHistory audit={audit} />
    </div>
  )
}

function BoardTargets({ board, rows, canEdit }: { board: TargetsBoardInfo; rows: PublishingTargetRow[]; canEdit: boolean }) {
  const router = useRouter()
  const sorted = [...rows].sort((a, b) => a.language.localeCompare(b.language))
  const abbr = shortAbbr(board.short) || board.name.slice(0, 4).toUpperCase()
  const [confirmDialog, confirm] = useConfirm()

  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function enterEdit() {
    setValues(Object.fromEntries(sorted.map((r) => [r.id, String(r.target_value)])))
    setError(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  function saveAll() {
    setError(null)
    const changed = sorted.filter(r => {
      const v = values[r.id]
      return v != null && v.trim() !== String(r.target_value)
    })
    // Every value is checked before any is sent, so a typo in the third row
    // does not leave the first two saved and the rest not.
    const bad = changed.filter(r => parseTarget(values[r.id]) === null).map(r => r.language)
    if (bad.length) {
      setError(`${BAD_TARGET} Check ${listNames(bad)}.`)
      return
    }
    if (changed.length === 0) { setEditing(false); return }

    start(async () => {
      // Row by row, as the server saves them. When one fails part way, the
      // message says which went in and which did not, rather than a single
      // "failed" over a list that is in fact half saved (audit, 10 October 2026).
      const saved: string[] = []
      const failed: string[] = []
      let reason = ''
      for (const r of changed) {
        const res = await saveTargetValue({ id: r.id, targetValue: parseTarget(values[r.id]) as number })
        if (res.ok) saved.push(r.language)
        else { failed.push(r.language); reason ||= res.error ?? 'Not saved. Try again in a moment.' }
      }
      if (failed.length === 0) {
        setEditing(false)
      } else {
        setError(saved.length
          ? `Saved ${listNames(saved)}. Not saved: ${listNames(failed)}. ${reason}`
          : `Not saved: ${listNames(failed)}. ${reason}`)
      }
      if (saved.length) router.refresh()
    })
  }

  async function removeRow(row: PublishingTargetRow) {
    const yes = await confirm({
      title: `Remove the weekly target for ${row.language} on ${abbr}?`,
      body: 'Past weeks keep the target they had.',
      action: 'Remove',
      danger: true,
    })
    if (!yes) return
    setError(null)
    start(async () => {
      const res = await deleteTarget({ id: row.id })
      if (!res.ok) setError(res.error ?? 'Not removed. Try again in a moment.')
      else router.refresh()
    })
  }

  const targeted = new Set(sorted.map(r => r.language.trim().toLowerCase()))
  const addable = board.languages.filter(l => !targeted.has(l.trim().toLowerCase()))

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      {confirmDialog}
      <div className="flex items-center gap-3 mb-4">
        <span className={`inline-flex w-9 h-9 items-center justify-center rounded-[9px] font-(family-name:--font-display) font-extrabold text-[12px] shrink-0 ${boardBadge(abbr)}`}>{abbr}</span>
        <div className="min-w-0">
          <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink truncate">{board.name}</div>
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
                  step={1}
                  inputMode="numeric"
                  value={values[row.id] ?? String(row.target_value)}
                  onChange={(e) => setValues((v) => ({ ...v, [row.id]: e.target.value }))}
                  className={paceInput}
                  aria-label={`${row.language} weekly target`}
                />
                <span className="text-[12px] text-muted">/wk</span>
                <button type="button" onClick={() => removeRow(row)} disabled={pending} className={iconBtn} title={`Remove ${row.language}`} aria-label={`Remove the weekly target for ${row.language}`}><Trash /></button>
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

      {editing && (addable.length > 0
        ? <AddTargetForm boardId={board.id} boardShort={abbr} languages={addable} />
        : <p className="mt-3 pt-3 border-t border-slate-100 text-[12.5px] text-muted">Every language this site publishes has a target.</p>)}

      {error && <p role="alert" className={errorText}>{error}</p>}

      {canEdit && (
        <div className="flex justify-end gap-2.5 mt-4 pt-4 border-t border-slate-100">
          {editing && (
            <button type="button" onClick={cancelEdit} disabled={pending} className={`${BTN.white} disabled:opacity-60`}>
              Cancel
            </button>
          )}
          {editing ? (
            <button type="button" onClick={saveAll} disabled={pending} className={`${BTN.navy} disabled:opacity-60`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <span>{pending ? 'Saving…' : 'Save'}</span>
            </button>
          ) : (
            <button type="button" onClick={enterEdit} disabled={pending} className={`${BTN.white} disabled:opacity-60`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              <span>Edit</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function AddTargetForm({ boardId, boardShort, languages }: { boardId: string; boardShort: string; languages: string[] }) {
  const router = useRouter()
  const ids = useId()
  const [language, setLanguage] = useState('')
  const [value, setValue] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    if (!language) { setError('Choose a language.'); return }
    const n = parseTarget(value)
    if (n === null) { setError(BAD_TARGET); return }
    start(async () => {
      // The board's short code is the server's to work out now; only the
      // board, the language and the number are sent.
      const res = await addTarget({ boardId, language, targetValue: n })
      if (!res.ok) {
        setError(res.error ?? 'Not saved. Try again in a moment.')
        return
      }
      setLanguage('')
      setValue('')
      router.refresh()
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <label htmlFor={`${ids}-lang`} className={fieldLabel}>Add a language</label>
          <Select
            id={`${ids}-lang`}
            value={language}
            onChange={setLanguage}
            options={languages.map(l => ({ value: l, label: l }))}
            placeholder="Choose a language"
            ariaLabel={`Language to add on ${boardShort}`}
            fullWidth
          />
        </div>
        <div>
          <label htmlFor={`${ids}-value`} className={fieldLabel}>Weekly target</label>
          <input
            id={`${ids}-value`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className={paceInput}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={pending || language === '' || value.trim() === ''}
          className={`${BTN.white} disabled:opacity-40`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>Add language</span>
        </button>
      </div>
      {error && <p role="alert" className={errorText}>{error}</p>}
    </div>
  )
}

// ── Publishers: who counts toward the goals ─────────────────────────────────
function Publishers({ names, canEdit }: { names: string[]; canEdit: boolean }) {
  const router = useRouter()
  const ids = useId()
  const [confirmDialog, confirm] = useConfirm()
  const [draft, setDraft] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const sorted = [...names].sort((a, b) => a.localeCompare(b))

  function add() {
    setError(null)
    const checked = checkPublisher(draft, names)
    if ('error' in checked) { setError(checked.error); return }
    start(async () => {
      const res = await addPublisher({ name: checked.name })
      if (!res.ok) { setError(res.error ?? 'Not saved. Try again in a moment.'); return }
      setDraft('')
      router.refresh()
    })
  }

  async function remove(name: string) {
    const yes = await confirm({
      title: `Remove ${name} from publishers?`,
      body: 'Their pages stop counting toward the goals.',
      action: 'Remove',
      danger: true,
    })
    if (!yes) return
    setError(null)
    start(async () => {
      const res = await removePublisher({ name })
      if (!res.ok) setError(res.error ?? 'Not removed. Try again in a moment.')
      else router.refresh()
    })
  }

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      {confirmDialog}
      <h3 className="m-0 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Publishers</h3>
      <p className="mt-1 mb-3 text-[12.5px] text-muted">
        Pages count only when one of these people is the publisher on Monday. Names must match Monday exactly.
      </p>

      <div>
        {sorted.map(name => (
          <div key={name} className="flex items-center gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[10.5px]">{initialsOf(name)}</span>
            <span className="flex-1 min-w-0 font-(family-name:--font-display) font-bold text-tn-ink text-[13.5px] truncate">{name}</span>
            {canEdit && (
              <button type="button" onClick={() => remove(name)} disabled={pending} className={iconBtn} title={`Remove ${name}`} aria-label={`Remove ${name} from publishers`}><Trash /></button>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="py-2 text-[13px] text-muted">No publishers yet, so no page counts toward the goals.</p>}
      </div>

      {canEdit && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor={`${ids}-name`} className={fieldLabel}>Add a publisher</label>
            <input
              id={`${ids}-name`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="Full name as Monday shows it"
              autoComplete="off"
              className={`${textInput} w-full`}
            />
          </div>
          <button type="button" onClick={add} disabled={pending || draft.trim() === ''} className={`${BTN.white} disabled:opacity-40`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>Add publisher</span>
          </button>
        </div>
      )}
      {error && <p role="alert" className={errorText}>{error}</p>}
    </div>
  )
}

// ── Change history, branded rows (avatar + badge + diff) ────────────────────
interface Change { label: string; kind: PillKind; summary: string }

/** Prettify an email into a display name: "ana.oliveira@x" -> "Ana Oliveira". */
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
    return { subject, change: { label: 'Weekly target', kind: 'teal', summary: `${before} to ${after} /wk` } }
  }
  if (e.action === 'insert') return { subject, change: { label: 'Added', kind: 'green', summary: `set to ${row.target_value} /wk` } }
  return { subject, change: { label: 'Removed', kind: 'grey', summary: '' } }
}

/** "Oct 9, 2026, 3:05 PM", New York. Exported for its test. */
export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
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
