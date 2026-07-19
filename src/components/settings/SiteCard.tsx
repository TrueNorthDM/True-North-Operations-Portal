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
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSiteLanguages, setLanguagePaused, saveMondayBoardId, saveSiteWpUrls } from '@/app/actions'
import { languageName, languageDot, codeFromInput } from '@/lib/language-display'

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

const PencilGold = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const CheckGold = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
const PlusIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>

const textField = 'flex-1 min-w-0 text-sm font-semibold text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3 py-2.5 focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20 read-only:cursor-default'
const label = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.09em] text-muted'

function Switch({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-[22px] w-10 items-center rounded-full transition-colors shrink-0 ${on ? 'bg-tn-teal' : 'bg-slate-300'} ${disabled ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function SiteCard({ site }: SiteCardProps) {
  const router = useRouter()
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
      className={`inline-flex items-center gap-2 rounded-[10px] px-5 py-[11px] font-(family-name:--font-display) font-extrabold text-[13.5px] transition-all shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] hover:-translate-y-px disabled:opacity-60 ${editing ? 'bg-tn-teal text-white' : 'bg-tn-primary text-white'}`}
    >
      {editing ? <CheckGold /> : <PencilGold />}
      <span className="text-[#ffffff]">{editing ? (pending ? 'Saving…' : 'Save') : 'Edit'}</span>
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
            <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: languageDot(code) }} />
            <span className="flex-1 min-w-0 text-[14px] font-semibold text-tn-ink truncate">{languageName(code)}</span>
            <span className={`inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 ${active ? 'text-tn-teal bg-tn-teal-soft' : 'text-[var(--bdg-slate-fg)] bg-[var(--bdg-slate-bg)]'}`}>{active ? 'Active' : 'Paused'}</span>
            <Switch on={active} disabled={!editing || pending} onClick={() => toggle(code, active)} />
          </div>
        ))}

        {/* Add language */}
        {adding ? (
          <div className="flex items-center gap-2 pt-3.5 mt-1 border-t border-slate-200 flex-wrap">
            <input
              type="text"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), startAdd())}
              placeholder="Language name (e.g. French)"
              className="flex-1 min-w-[150px] text-sm font-semibold text-tn-ink bg-subtle border border-slate-200 rounded-[9px] px-3 py-2 focus:outline-none focus:border-tn-teal focus:bg-white focus:ring-2 focus:ring-tn-teal/20"
            />
            <button type="button" onClick={startAdd} disabled={pending} className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-white bg-tn-teal rounded-[9px] px-4 py-2 disabled:opacity-50">Add</button>
            <button type="button" onClick={() => { setAdding(false); setNewLang(''); setError(null) }} className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-muted px-2 py-2">Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setAdding(true); setError(null) }}
            disabled={!editing}
            className="inline-flex items-center gap-2 mt-3.5 font-(family-name:--font-display) font-extrabold text-[13px] text-tn-teal bg-tn-teal-soft border border-dashed border-tn-teal rounded-[10px] px-3.5 py-2.5 disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <PlusIcon /> Add language
          </button>
        )}
      </div>

      {/* Monday board ID */}
      <div className="border-t border-slate-200 mt-[18px] pt-[18px]">
        <div className={`${label} mb-2.5`}>Monday board ID</div>
        <input
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
        <div className={`${label} mb-3`}>WordPress URLs</div>
        <div className="flex items-center gap-2.5 mb-2.5">
          <span className="w-[52px] text-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-foreground bg-subtle rounded-[8px] py-[7px] shrink-0">Dev</span>
          <input type="url" value={dev} onChange={(e) => setDev(e.target.value)} readOnly={!editing} placeholder="https://devsite…" className={textField} />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="w-[52px] text-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-foreground bg-subtle rounded-[8px] py-[7px] shrink-0">Live</span>
          <input type="url" value={live} onChange={(e) => setLive(e.target.value)} readOnly={!editing} placeholder="https://www…" className={textField} />
        </div>
        <p className="text-[12px] text-muted mt-3">Used by the Dev / Live buttons on the project header. Leave blank to hide that button.</p>
      </div>

      {error && <p className="mt-3 text-xs text-[var(--bdg-red-fg)]">{error}</p>}

      <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">{editBtn}</div>

      {/* Confirm add, a new language flags existing pages for an hreflang update */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,20,45,.44)] backdrop-blur-[2px] p-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-md rounded-[16px] bg-white shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink text-[17px]">Add {languageName(confirm.code)}?</h3>
            <div className="text-[13.5px] text-foreground space-y-2">
              <p>Adds <b className="text-tn-ink">{languageName(confirm.code)}</b> as a tracked publishing language for {site.name}.</p>
              {site.pagesWithUrlsCount > 0 ? (
                <p className="pt-2 border-t border-slate-100"><b className="text-[var(--bdg-gold-fg)]">Heads up:</b> {site.pagesWithUrlsCount} page{site.pagesWithUrlsCount === 1 ? '' : 's'} with URLs will be flagged as <em>needs update</em> so their hreflang tags get the new language.</p>
              ) : (
                <p className="pt-2 border-t border-slate-100 text-muted">No pages will be flagged, empty pages don&apos;t need attention.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setConfirm(null)} className="font-(family-name:--font-display) font-extrabold text-[13px] text-muted px-3 py-2">Cancel</button>
              <button onClick={confirmAdd} disabled={pending} className="font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-4 py-2.5 disabled:opacity-60">{pending ? 'Adding…' : 'Add and flag pages'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
