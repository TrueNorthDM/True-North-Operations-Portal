'use client'

/**
 * SiteCard: per-site publishing config, styled to the True North handoff.
 *
 * One card holds: the tracked publishing languages (with a pause/resume toggle),
 * the Monday board ID, and the Dev/Live WordPress URLs. A per-card Edit button
 * flips the card into edit mode (toggles active, add enabled, fields editable);
 * Save persists the board/URL fields. Pausing/resuming and adding a language act
 * immediately (they refresh the server data). English is the x-default anchor,
 * it's not shown as a toggleable row.
 *
 * Audit, 10 October 2026: the add-language question is a real dialog
 * (useModal: focus kept inside, Escape closes, named by its title), the
 * switches are the portal's own (ui/Switch, named by the language), every
 * field has a <label>, and the buttons are the portal's two (lib/ui/buttons).
 */

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSiteLanguages, setLanguagePaused, saveMondayBoardId, saveSiteWpUrls } from '@/app/actions'
import { languageName, languageDot, codeFromInput } from '@/lib/language-display'
import { Switch } from '@/components/ui/Switch'
import { useModal } from '@/components/ui/useModal'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

interface SiteCardProps {
  site: {
    code: 'aaaf' | 'hfa'
    name: string
    domain: string
    languages: string[]
    paused_languages: string[]
    language_paths: Record<string, string>
    pagesWithUrlsCount: number
    monday_board_id: string | null
    wp_dev_url: string | null
    wp_live_url: string | null
  }
}

const BRAND: Record<'aaaf' | 'hfa', string> = {
  aaaf: 'bg-aaaf-soft text-aaaf-primary',
  hfa: 'bg-hfa-soft text-hfa-primary',
}

const PencilIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const CheckIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>

const textField = 'flex-1 min-w-0 text-sm font-semibold text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3 py-2.5 focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20 read-only:cursor-default'
const caption = 'block text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.09em] text-muted'
const envLabel = 'w-[52px] text-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-foreground bg-subtle rounded-[8px] py-[7px] shrink-0'

/** The add-language question, as a modal dialog (useModal keeps the keyboard in it). */
function AddLanguageDialog({ code, site, pending, onCancel, onConfirm }: {
  code: string
  site: SiteCardProps['site']
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(true, box, onCancel)
  const name = languageName(code)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,20,45,.44)] backdrop-blur-[2px] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-[16px] bg-white shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] p-6 space-y-4">
        <h3 id={titleId} className="font-(family-name:--font-display) font-extrabold text-tn-ink text-[17px]">Add {name}?</h3>
        <div className="text-[13.5px] text-foreground space-y-2">
          <p>Adds <b className="text-tn-ink">{name}</b> as a tracked publishing language for {site.name}.</p>
          {site.pagesWithUrlsCount > 0 ? (
            <p className="pt-2 border-t border-slate-100"><b className="text-[var(--bdg-gold-fg)]">Heads up:</b> {site.pagesWithUrlsCount} page{site.pagesWithUrlsCount === 1 ? '' : 's'} with URLs will be flagged as <em>needs update</em> so their hreflang tags get the new language.</p>
          ) : (
            <p className="pt-2 border-t border-slate-100 text-muted">No pages will be flagged, empty pages don&apos;t need attention.</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className={BTN.white}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={pending} className={`${BTN.navy} disabled:opacity-60`}>{pending ? 'Adding…' : 'Add and flag pages'}</button>
        </div>
      </div>
    </div>
  )
}

export function SiteCard({ site }: SiteCardProps) {
  const router = useRouter()
  const ids = useId()
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [boardId, setBoardId] = useState(site.monday_board_id ?? '')
  const [dev, setDev] = useState(site.wp_dev_url ?? '')
  const [live, setLive] = useState(site.wp_live_url ?? '')

  const [adding, setAdding] = useState(false)
  const [newLang, setNewLang] = useState('')
  const [confirm, setConfirm] = useState<{ code: string } | null>(null)

  const byName = (a: string, b: string) => languageName(a).localeCompare(languageName(b))
  const activeLangs = site.languages.filter((l) => l !== 'en').sort(byName)
  const pausedLangs = [...site.paused_languages].sort(byName)
  const rows = [...activeLangs.map((c) => ({ code: c, active: true })), ...pausedLangs.map((c) => ({ code: c, active: false }))]
  const activeCount = activeLangs.length
  const totalCount = activeLangs.length + pausedLangs.length

  const boardDirty = boardId.trim() !== (site.monday_board_id ?? '')
  const urlsDirty = dev.trim() !== (site.wp_dev_url ?? '') || live.trim() !== (site.wp_live_url ?? '')

  function enterEdit() {
    setError(null)
    setBoardId(site.monday_board_id ?? '')
    setDev(site.wp_dev_url ?? '')
    setLive(site.wp_live_url ?? '')
    setEditing(true)
  }
  function saveCard() {
    setError(null)
    start(async () => {
      if (boardDirty) {
        const r = await saveMondayBoardId({ siteCode: site.code, boardId })
        if (!r.ok) { setError(r.error ?? 'Could not save board ID.'); return }
      }
      if (urlsDirty) {
        const r = await saveSiteWpUrls({ siteCode: site.code, devUrl: dev, liveUrl: live })
        if (!r.ok) { setError(r.error ?? 'Could not save URLs.'); return }
      }
      setAdding(false)
      setNewLang('')
      setEditing(false)
      router.refresh()
    })
  }
  function toggle(code: string, currentlyActive: boolean) {
    setError(null)
    start(async () => {
      const r = await setLanguagePaused({ siteCode: site.code, language: code, paused: currentlyActive })
      if (!r.ok) setError(r.error ?? 'Could not update language.')
      else router.refresh()
    })
  }
  function startAdd() {
    setError(null)
    const code = codeFromInput(newLang)
    if (!code) { setError('Enter a language name or code, e.g. “French” or “fr”.'); return }
    if (site.languages.includes(code) || site.paused_languages.includes(code)) {
      setError(`${languageName(code)} is already tracked for this site.`)
      return
    }
    setConfirm({ code })
  }
  function confirmAdd() {
    if (!confirm) return
    const code = confirm.code
    start(async () => {
      const r = await updateSiteLanguages({ siteCode: site.code, newLanguages: [...site.languages, code] })
      if (!r.ok) { setError(r.error ?? 'Could not add language.'); setConfirm(null); return }
      setConfirm(null)
      setAdding(false)
      setNewLang('')
      router.refresh()
    })
  }

  const editBtn = (
    <button
      type="button"
      onClick={editing ? saveCard : enterEdit}
      disabled={pending}
      className={`${BTN.navy} disabled:opacity-60`}
    >
      {editing ? <CheckIcon /> : <PencilIcon />}
      {editing ? (pending ? 'Saving…' : 'Save') : 'Edit'}
    </button>
  )

  return (
    <div className="rounded-[16px] border border-slate-200 bg-white p-[22px] shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-flex w-[34px] h-[34px] items-center justify-center rounded-[9px] font-(family-name:--font-display) font-black text-[13px] shrink-0 ${BRAND[site.code]}`}>{site.code.toUpperCase()}</span>
          <div className="min-w-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink truncate">{site.name}</div>
            <div className="text-[12px] text-muted truncate">{site.code.toUpperCase()} · Publishing board</div>
          </div>
        </div>
        <span className="text-[12px] text-muted whitespace-nowrap">{activeCount} of {totalCount} active</span>
      </div>

      {/* Languages */}
      <div>
        {rows.length === 0 && <p className="py-2 text-[13px] text-muted">No languages tracked yet.</p>}
        {rows.map(({ code, active }) => (
          <div key={code} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
            <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: languageDot(code) }} aria-hidden="true" />
            <span className="flex-1 min-w-0 text-[14px] font-semibold text-tn-ink truncate">{languageName(code)}</span>
            <span className={`inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 ${active ? 'text-tn-teal bg-tn-teal-soft' : 'text-[var(--bdg-slate-fg)] bg-[var(--bdg-slate-bg)]'}`}>{active ? 'Active' : 'Paused'}</span>
            <Switch on={active} disabled={!editing || pending} onChange={() => toggle(code, active)} label={`Track ${languageName(code)}`} />
          </div>
        ))}

        {/* Add language */}
        {adding ? (
          <div className="flex items-center gap-2 pt-3.5 mt-1 border-t border-slate-200 flex-wrap">
            <label htmlFor={`${ids}-new-lang`} className="sr-only">Language to add</label>
            <input
              id={`${ids}-new-lang`}
              type="text"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), startAdd())}
              placeholder="Language name (e.g. French)"
              className="flex-1 min-w-[150px] text-sm font-semibold text-tn-ink bg-subtle border border-slate-200 rounded-[9px] px-3 py-2 focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20"
            />
            <button type="button" onClick={startAdd} disabled={pending} className={`${BTN.navy} disabled:opacity-50`}>Add</button>
            <button type="button" onClick={() => { setAdding(false); setNewLang(''); setError(null) }} className={BTN.white}>Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setAdding(true); setError(null) }}
            disabled={!editing}
            className={`${BTN.white} mt-3.5 disabled:opacity-45 disabled:cursor-not-allowed`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Add language
          </button>
        )}
      </div>

      {/* Monday board ID */}
      <div className="border-t border-slate-200 mt-[18px] pt-[18px]">
        <label htmlFor={`${ids}-board`} className={`${caption} mb-2.5`}>Monday board ID</label>
        <input
          id={`${ids}-board`}
          type="text"
          inputMode="numeric"
          value={boardId}
          onChange={(e) => setBoardId(e.target.value.replace(/[^\d]/g, ''))}
          readOnly={!editing}
          placeholder="e.g. 462251934"
          className={textField}
        />
        <p className="text-[12px] text-muted mt-2">The number in the board URL: monday.com/boards/<b className="text-foreground">1234567890</b></p>
      </div>

      {/* WordPress URLs */}
      <div className="border-t border-slate-200 mt-[18px] pt-[18px]">
        <div className={`${caption} mb-3`} aria-hidden="true">WordPress URLs</div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <label htmlFor={`${ids}-dev`} className={envLabel}><span className="sr-only">WordPress </span>Dev</label>
          <input id={`${ids}-dev`} type="url" value={dev} onChange={(e) => setDev(e.target.value)} readOnly={!editing} placeholder="https://devsite…" className={textField} />
        </div>
        <div className="flex items-center gap-2.5">
          <label htmlFor={`${ids}-live`} className={envLabel}><span className="sr-only">WordPress </span>Live</label>
          <input id={`${ids}-live`} type="url" value={live} onChange={(e) => setLive(e.target.value)} readOnly={!editing} placeholder="https://www…" className={textField} />
        </div>
        <p className="text-[12px] text-muted mt-3">Used by the Dev / Live buttons on the project header. Leave blank to hide that button.</p>
      </div>

      {error && <p role="alert" className="mt-3 text-xs text-[var(--bdg-red-fg)]">{error}</p>}

      <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">{editBtn}</div>

      {/* Confirm add: a new language flags existing pages for an hreflang update. */}
      {confirm && (
        <AddLanguageDialog code={confirm.code} site={site} pending={pending} onCancel={() => setConfirm(null)} onConfirm={confirmAdd} />
      )}
    </div>
  )
}
