'use client'

/**
 * PageDetail — the heart of the workflow. Shared by /aaaf/[id] and /hfa/[id].
 *
 * Renders three sections:
 *   1. URL entry form      — one input per language, saved via savePageUrls
 *   2. Hreflang code block — generated from the saved URLs, with a copy button
 *   3. Confirmation list   — per-language checkboxes, toggled via toggleConfirmation
 *
 * Enforce-order rules (mirrored from the server actions so the UI matches):
 *   - 'confirmed live' is disabled until a URL is saved for that language
 */

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HreflangCodeBlock } from '@/components/HreflangCodeBlock'
import { DeletePageButton } from '@/components/DeletePageButton'
import { NotRelevantButton } from '@/components/NotRelevantButton'
import { savePageUrls, toggleConfirmation } from '@/app/actions'
import { languagePalette } from '@/lib/language-colors'

interface ConfirmationState {
  language_code: string
  confirmed_on_live: boolean
}

interface Props {
  pageId: string
  siteCode: 'aaaf' | 'hfa'
  pageName: string
  languages: string[]
  savedUrls: { language_code: string; url: string }[]
  confirmations: ConfirmationState[]
  accent: 'aaaf' | 'hfa'
  /** True when the site's language config changed after this page was last addressed. */
  needsUpdate?: boolean
  /** ISO timestamp set the first time all languages were confirmed live. Preserved on un-toggle. */
  confirmedDoneAt?: string | null
  /** Marks the page as intentionally out of scope. Counts as done for progress. */
  notRelevant?: boolean
  /**
   * Optional slot rendered at the bottom of the page.
   * Used by HFA to mount the SEO metadata editor without coupling PageDetail
   * to HFA-specific concerns.
   */
  extraSection?: React.ReactNode
}

const accentMap = {
  aaaf: {
    btn: 'bg-aaaf-primary hover:bg-aaaf-primary-hover',
    ring: 'focus:ring-aaaf-primary',
    text: 'text-aaaf-primary',
  },
  hfa: {
    btn: 'bg-hfa-primary hover:bg-hfa-primary-hover',
    ring: 'focus:ring-hfa-primary',
    text: 'text-hfa-primary',
  },
}

export function PageDetail({
  pageId,
  siteCode,
  pageName,
  languages,
  savedUrls,
  confirmations,
  accent,
  needsUpdate = false,
  confirmedDoneAt = null,
  notRelevant = false,
  extraSection = null,
}: Props) {
  const doneDateLabel = confirmedDoneAt
    ? new Date(confirmedDoneAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : null
  const router = useRouter()
  const a = accentMap[accent]

  // URL form state, keyed by language code
  const initialUrls: Record<string, string> = {}
  for (const lang of languages) {
    initialUrls[lang] = savedUrls.find(u => u.language_code === lang)?.url ?? ''
  }
  const [urlInputs, setUrlInputs] = useState(initialUrls)
  const [saving, startSave] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // View / edit mode toggle — page opens in view mode by default.
  // Edit mode unlocks URL inputs and confirmation checkboxes.
  // A page flagged as needsUpdate auto-opens in edit mode so the workflow
  // is obvious: "fix me now, not later".
  const [isEditing, setIsEditing] = useState(needsUpdate)

  // The URLs currently persisted (used for the hreflang block + enforce-order)
  const persistedUrls = languages
    .map(lang => ({ language_code: lang, url: savedUrls.find(u => u.language_code === lang)?.url ?? '' }))
    .filter(u => u.url !== '')

  const hasUrlFor = (lang: string) => persistedUrls.some(u => u.language_code === lang)
  const confirmFor = (lang: string) => confirmations.find(c => c.language_code === lang)

  function handleSaveUrls() {
    setError(null)
    startSave(async () => {
      const res = await savePageUrls({
        pageId,
        siteCode,
        urls: languages.map(lang => ({ language_code: lang, url: urlInputs[lang] ?? '' })),
      })
      if (!res.ok) {
        setError(res.error ?? 'Failed to save URLs.')
        return
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      router.refresh()
    })
  }

  function handleToggle(
    languageCode: string,
    field: 'confirmed_on_live',
    value: boolean,
  ) {
    setError(null)
    startSave(async () => {
      const res = await toggleConfirmation({ pageId, siteCode, languageCode, field, value })
      if (!res.ok) {
        setError(res.error ?? 'Failed to update confirmation.')
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header + at-a-glance status */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/" className="hover:text-slate-800">Dashboard</Link>
          <span>/</span>
          <Link href={`/${siteCode}`} className="hover:text-slate-800 uppercase">{siteCode}</Link>
          <span>/</span>
          <span>{pageName}</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{pageName}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {(() => {
              const liveCount = languages.filter(l => confirmFor(l)?.confirmed_on_live).length
              const liveDone = liveCount === languages.length
              return (
                <>
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                      liveDone ? 'bg-green-100 text-green-700'
                        : liveCount > 0 ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {liveDone ? '✓ Live on all languages' : `${liveCount}/${languages.length} confirmed live`}
                  </span>
                  {liveDone && doneDateLabel && (
                    <span
                      title="Date all languages first went live"
                      className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200"
                    >
                      Done {doneDateLabel}
                    </span>
                  )}
                </>
              )
            })()}
            {/* View / Edit toggle */}
            {isEditing ? (
              <button
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                View mode
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors ${a.btn}`}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                Edit
              </button>
            )}
            {/* Delete — destructive, kept visually separate (red outline) so it
                doesn't compete with the primary Edit action. */}
            <NotRelevantButton pageId={pageId} siteCode={siteCode} initialValue={notRelevant} />
            <DeletePageButton pageId={pageId} pageName={pageName} siteCode={siteCode} />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {needsUpdate && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
          <span aria-hidden="true" className="text-amber-700 leading-none">⚠</span>
          <div className="text-sm">
            <p className="font-medium text-amber-900">Language settings changed after this page was last updated.</p>
            <p className="text-amber-800 mt-0.5">Review the URLs below, click <strong>Save URLs</strong>, then re-paste the regenerated hreflang code in WordPress. Saving will clear this flag.</p>
          </div>
        </div>
      )}

      {/* 1. URL entry */}
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Language URLs</h2>
          {isEditing && (
            <button
              onClick={handleSaveUrls}
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${a.btn}`}
            >
              {saving ? 'Saving…' : savedFlash ? '✓ Saved' : 'Save URLs'}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {languages.map(lang => {
            const savedUrl = savedUrls.find(u => u.language_code === lang)?.url
            const langC = languagePalette(lang)
            return (
              <div key={lang} className="flex items-center gap-3">
                <span className={`w-11 inline-flex items-center justify-center text-xs font-bold uppercase rounded px-2 py-0.5 ${langC.bg} ${langC.text}`}>{lang}</span>
                <input
                  type="url"
                  value={urlInputs[lang] ?? ''}
                  onChange={e => setUrlInputs(prev => ({ ...prev, [lang]: e.target.value }))}
                  placeholder={isEditing ? `https://… (${lang})` : '—'}
                  readOnly={!isEditing}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none ${
                    isEditing
                      ? `border-slate-200 focus:ring-2 ${a.ring} bg-white`
                      : 'border-transparent bg-slate-50 text-slate-700 cursor-default'
                  }`}
                />
                {/* Open the SAVED URL in a new tab — used for the WordPress verification step.
                    Only enabled when there's a saved URL (the input may have unsaved edits). */}
                {savedUrl ? (
                  <a
                    href={savedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open saved URL in new tab (for WP verification)"
                    className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    ↗
                  </a>
                ) : (
                  <span
                    title="Save the URL first"
                    className="shrink-0 w-9 h-9 rounded-lg border border-dashed border-slate-200 inline-flex items-center justify-center text-slate-300"
                  >
                    ↗
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 1b. Discontinued languages — saved URLs whose language isn't in the
          current site config (someone removed it from Settings). Show faded
          as read-only history; not included in hreflang generation. */}
      {(() => {
        const langSet = new Set(languages)
        const discontinuedUrls = savedUrls.filter(u => !langSet.has(u.language_code))
        const discontinuedConfs = confirmations.filter(c => !langSet.has(c.language_code))
        const discontinuedLangs = [...new Set([
          ...discontinuedUrls.map(u => u.language_code),
          ...discontinuedConfs.map(c => c.language_code),
        ])]
        if (discontinuedLangs.length === 0) return null
        return (
          <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-3 opacity-80">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-600 text-sm">Discontinued languages</h2>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">read-only history</span>
            </div>
            <p className="text-xs text-slate-500">
              These languages were removed from the project settings. The data is preserved here but won&apos;t be used to generate hreflang tags.
            </p>
            <div className="space-y-2">
              {discontinuedLangs.map(lang => {
                const url = discontinuedUrls.find(u => u.language_code === lang)?.url
                const conf = discontinuedConfs.find(c => c.language_code === lang)
                return (
                  <div key={lang} className="flex items-center gap-3 text-sm">
                    {/* Discontinued: show lang in muted greyscale (the language color
                        identity is intentionally lost here — it's no longer active). */}
                    <span className="w-11 inline-flex items-center justify-center text-xs font-bold uppercase rounded px-2 py-0.5 bg-slate-100 text-slate-400">{lang}</span>
                    <span className="flex-1 text-slate-500 truncate font-mono text-xs">{url ?? '—'}</span>
                    <span className="text-[10px] uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-semibold">
                      discontinued
                    </span>
                    {conf?.confirmed_on_live && (
                      <span className="text-[10px] uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded font-semibold">
                        was live
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })()}

      {/* 2. Generated hreflang code */}
      <section className="space-y-2">
        <h2 className="font-semibold text-slate-800">Generated hreflang tags</h2>
        <HreflangCodeBlock urls={persistedUrls} />
      </section>

      {/* 3. Confirmation checklist */}
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Confirmations</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100">
              <th className="py-2 font-medium">Language</th>
              <th className="py-2 font-medium">Confirmed live</th>
            </tr>
          </thead>
          <tbody>
            {languages.map(lang => {
              const c = confirmFor(lang)
              const liveChecked = c?.confirmed_on_live ?? false
              const canConfirmLive = hasUrlFor(lang)
              const langC = languagePalette(lang)
              return (
                <tr key={lang} className="border-b border-slate-100 last:border-0">
                  <td className="py-3">
                    <span className={`inline-flex items-center justify-center text-xs font-bold uppercase rounded px-2 py-0.5 ${langC.bg} ${langC.text}`}>{lang}</span>
                  </td>
                  <td className="py-3">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={liveChecked}
                        disabled={!isEditing || saving || (!liveChecked && !canConfirmLive)}
                        onChange={e => handleToggle(lang, 'confirmed_on_live', e.target.checked)}
                        className="h-4 w-4 rounded disabled:opacity-40"
                      />
                      {isEditing && !canConfirmLive && !liveChecked && (
                        <span className="text-xs text-slate-400">enter URL first</span>
                      )}
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* Site-specific bottom slot (e.g. HFA SEO metadata editor). */}
      {extraSection}
    </div>
  )
}
