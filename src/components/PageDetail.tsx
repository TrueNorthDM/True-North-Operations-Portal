'use client'

/**
 * PageDetail: one Href Links page, the heart of the workflow. Shared by both
 * sites' detail pages (components/href-links/SitePageDetail.tsx).
 *
 * Three sections:
 *   1. The links, one field per language, saved with savePageUrls
 *   2. The hreflang tags made from the saved links, with a Copy button
 *   3. The confirmations, one box per language, toggled with toggleConfirmation
 *
 * The rules the server keeps, mirrored so the screen agrees (audit,
 * 10 October 2026):
 *   - a link is https and a page on the site's own domain; a refused link is
 *     named under its field and nothing is saved
 *   - "confirmed live" waits for a saved link
 *   - changing a link already confirmed live takes its confirmation away and
 *     flags the page, so the new tags get pasted
 */

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HreflangCodeBlock } from '@/components/HreflangCodeBlock'
import { DeletePageButton } from '@/components/DeletePageButton'
import { NotRelevantButton } from '@/components/NotRelevantButton'
import { savePageUrls, toggleConfirmation } from '@/app/(app)/seo/href-links/actions'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ROUTES, hrefLinksSite } from '@/lib/nav/routes'
import { languageName } from '@/lib/language-display'
import { reportDate } from '@/lib/report/clock'
import { siteHost, type SiteCode } from '@/lib/href-links/rules'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { langChipStyle } from '@/components/href-links/lang-chip'

interface ConfirmationState {
  language_code: string
  confirmed_on_live: boolean
}

interface Props {
  pageId: string
  siteCode: SiteCode
  pageName: string
  /** The site's current languages, in order. */
  languages: string[]
  /** The site's domain from Settings: links must be pages on it. */
  domain: string | null
  savedUrls: { language_code: string; url: string }[]
  confirmations: ConfirmationState[]
  accent: SiteCode
  /** Flagged: a language was added or a live link changed since the tags were pasted. */
  needsUpdate?: boolean
  /** The day the page first got done. History only. */
  confirmedDoneAt?: string | null
  /** Set aside on purpose; counts as done. */
  notRelevant?: boolean
  /** Done by the one rule (rules.ts), from the server. */
  done?: boolean
}

const accentMap = {
  aaaf: { ring: 'focus:ring-aaaf-primary', check: 'accent-aaaf-primary' },
  hfa: { ring: 'focus:ring-hfa-primary', check: 'accent-hfa-primary' },
}

const LIVE_CHANGE_NOTE = 'Changing a link that is already live takes its confirmation away and flags the page, so the new tags get pasted.'

function urlsByLanguage(languages: string[], saved: { language_code: string; url: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const lang of languages) out[lang] = saved.find(u => u.language_code === lang)?.url ?? ''
  return out
}

/** The live languages whose field no longer holds the saved link. */
export function changedLiveLanguages(
  languages: string[],
  typed: Record<string, string>,
  saved: { language_code: string; url: string }[],
  confirmations: ConfirmationState[],
): string[] {
  return languages.filter(lang => {
    const was = saved.find(u => u.language_code === lang)?.url
    const live = confirmations.some(c => c.language_code === lang && c.confirmed_on_live)
    return live && was !== undefined && (typed[lang] ?? '').trim() !== was
  })
}

export function PageDetail({
  pageId,
  siteCode,
  pageName,
  languages,
  domain,
  savedUrls,
  confirmations,
  accent,
  needsUpdate = false,
  confirmedDoneAt = null,
  notRelevant = false,
  done = false,
}: Props) {
  const router = useRouter()
  const a = accentMap[accent]
  const idBase = useId()
  const host = siteHost(domain)
  const doneDateLabel = confirmedDoneAt ? reportDate(confirmedDoneAt) : null

  // The fields, by language. When the saved links change (after a save the
  // server may have written the bare domain with "www", or Monday sent a new
  // one) the fields take the saved values again; typing alone never resets.
  const savedKey = JSON.stringify(savedUrls)
  const [seenKey, setSeenKey] = useState(savedKey)
  const [urlInputs, setUrlInputs] = useState(() => urlsByLanguage(languages, savedUrls))
  if (seenKey !== savedKey) {
    setSeenKey(savedKey)
    setUrlInputs(urlsByLanguage(languages, savedUrls))
  }

  const [saving, startSave] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Why the server refused a link, by language; the typed values stay.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // The saved links of the current languages (for the tags and the order rule).
  const persistedUrls = languages
    .map(lang => ({ language_code: lang, url: savedUrls.find(u => u.language_code === lang)?.url ?? '' }))
    .filter(u => u.url !== '')

  const hasUrlFor = (lang: string) => persistedUrls.some(u => u.language_code === lang)
  const confirmFor = (lang: string) => confirmations.find(c => c.language_code === lang)
  const changedLive = changedLiveLanguages(languages, urlInputs, savedUrls, confirmations)

  function handleSaveUrls() {
    setError(null)
    setFieldErrors({})
    startSave(async () => {
      const res = await savePageUrls({
        pageId,
        urls: languages.map(lang => ({ language_code: lang, url: urlInputs[lang] ?? '' })),
      })
      if (!res.ok) {
        if (res.rejected?.length) {
          setFieldErrors(Object.fromEntries(res.rejected.map(r => [r.language_code, r.reason])))
        }
        setError(res.error ?? 'Not saved. Try again in a moment.')
        return
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      router.refresh()
    })
  }

  function handleToggle(languageCode: string, value: boolean) {
    setError(null)
    startSave(async () => {
      const res = await toggleConfirmation({ pageId, languageCode, value })
      if (!res.ok) {
        setError(res.error ?? 'Not saved. Try again in a moment.')
        return
      }
      router.refresh()
    })
  }

  const liveCount = languages.filter(l => confirmFor(l)?.confirmed_on_live).length
  const liveDone = languages.length > 0 && liveCount === languages.length
  const pillStyle = liveDone
    ? { backgroundColor: '#1E9E6A1f', color: '#1E9E6A' }
    : liveCount > 0
      ? { backgroundColor: '#E0940E1f', color: '#c67f0c' }
      : undefined

  return (
    <div className="space-y-6">
      {/* Header and status at a glance */}
      <div>
        <Breadcrumb
          parents={[ROUTES.hrefLinks, { href: hrefLinksSite(siteCode), label: siteCode.toUpperCase() }]}
          now={pageName}
        />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-(family-name:--font-display) font-extrabold text-tn-ink">{pageName}</h1>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <span
              className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full ${pillStyle ? '' : 'bg-subtle text-muted'}`}
              style={pillStyle}
            >
              {liveDone ? '✓ Live on all languages' : `${liveCount}/${languages.length} confirmed live`}
            </span>
            {done && doneDateLabel && (
              <span
                title="The day it first got done"
                className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-subtle text-muted border border-slate-200"
              >
                Done {doneDateLabel}
              </span>
            )}
            <NotRelevantButton pageId={pageId} initialValue={notRelevant} />
            <DeletePageButton pageId={pageId} pageName={pageName} siteCode={siteCode} />
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {needsUpdate && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-3">
          <span aria-hidden="true" className="text-amber-700 leading-none">⚠</span>
          <div className="text-sm">
            <p className="font-medium text-amber-900">This page needs its hreflang tags pasted again.</p>
            <p className="text-amber-800 mt-0.5">A language was added or a live link changed since the tags were pasted. Check the links below, copy the new tags and paste them in WordPress, then confirm each language live.</p>
          </div>
        </div>
      )}

      {/* 1. The links */}
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Language URLs</h2>
          <button type="button" onClick={handleSaveUrls} disabled={saving} className={`${BTN.navy} disabled:opacity-50`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save URLs'}
          </button>
        </div>
        <div className="space-y-3">
          {languages.map(lang => {
            const savedUrl = savedUrls.find(u => u.language_code === lang)?.url
            const inputId = `${idBase}-url-${lang}`
            const helpId = `${idBase}-help`
            const errId = `${idBase}-err-${lang}`
            const fieldError = fieldErrors[lang]
            return (
              <div key={lang}>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor={inputId}
                    className="w-[42px] h-7 shrink-0 inline-flex items-center justify-center text-xs font-bold uppercase rounded-md"
                    style={langChipStyle(lang)}
                  >
                    {lang}
                  </label>
                  {/* Named in words: the chip only shows the code. */}
                  <input
                    id={inputId}
                    aria-label={`${languageName(lang)} link`}
                    type="url"
                    value={urlInputs[lang] ?? ''}
                    onChange={e => setUrlInputs(prev => ({ ...prev, [lang]: e.target.value }))}
                    placeholder={host ? `https://${host}/…` : 'https://…'}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? `${errId} ${helpId}` : helpId}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-[9px] border text-sm bg-white focus:outline-none focus:ring-2 ${a.ring} ${
                      fieldError ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  {/* Opens the SAVED link (the field may hold unsaved typing),
                      for checking the page in WordPress. */}
                  {savedUrl ? (
                    <a
                      href={savedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open the saved link in a new tab"
                      aria-label={`Open the saved ${languageName(lang)} link in a new tab`}
                      className="shrink-0 w-9 h-9 rounded-lg border border-slate-200 inline-flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                    >
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span
                      title="Save the link first"
                      aria-hidden="true"
                      className="shrink-0 w-9 h-9 rounded-lg border border-dashed border-slate-200 inline-flex items-center justify-center text-slate-300"
                    >
                      ↗
                    </span>
                  )}
                </div>
                {fieldError && (
                  <p id={errId} role="alert" className="mt-1 ml-[54px] text-xs text-red-700">
                    {fieldError}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <p id={`${idBase}-help`} className="text-xs text-muted m-0">
          {host ? `A link must be https and a page on ${host}.` : 'A link must be https and a page on the site\'s own domain, which is not set in Settings yet.'}
        </p>
        {changedLive.length > 0 && (
          <p className="text-xs text-muted m-0">{LIVE_CHANGE_NOTE}</p>
        )}
      </section>

      {/* 1b. Discontinued languages: saved links whose language was taken out
          of the site in Settings. Shown faded as history; not in the tags. */}
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
              These languages were removed from the site in Settings. Their data is kept here but is not used for the hreflang tags.
            </p>
            <div className="space-y-2">
              {discontinuedLangs.map(lang => {
                const url = discontinuedUrls.find(u => u.language_code === lang)?.url
                const conf = discontinuedConfs.find(c => c.language_code === lang)
                return (
                  <div key={lang} className="flex items-center gap-3 text-sm">
                    {/* Grey on purpose: the language is no longer active. */}
                    <span className="w-11 inline-flex items-center justify-center text-xs font-bold uppercase rounded px-2 py-0.5 bg-slate-100 text-slate-400" title={languageName(lang)}>{lang}</span>
                    <span className="flex-1 text-slate-500 truncate font-mono text-xs">{url ?? '-'}</span>
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

      {/* 2. The hreflang tags */}
      <section className="space-y-2">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Generated hreflang tags</h2>
        <HreflangCodeBlock urls={persistedUrls} languages={languages} />
      </section>

      {/* 3. The confirmations */}
      <section className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Confirmations</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-slate-200">
              <th scope="col" className="py-2 font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink w-1/2">Language</th>
              <th scope="col" className="py-2 font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink">Confirmed live</th>
            </tr>
          </thead>
          <tbody>
            {languages.map(lang => {
              const liveChecked = confirmFor(lang)?.confirmed_on_live ?? false
              const canConfirmLive = hasUrlFor(lang)
              return (
                <tr key={lang} className="border-b border-slate-100 last:border-0">
                  <td className="py-3">
                    <span
                      className="inline-flex items-center justify-center h-6 px-2.5 text-xs font-bold uppercase rounded-md"
                      style={langChipStyle(lang)}
                      title={languageName(lang)}
                    >
                      {lang}
                    </span>
                  </td>
                  <td className="py-3">
                    <label className="inline-flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={liveChecked}
                        disabled={saving || (!liveChecked && !canConfirmLive)}
                        onChange={e => handleToggle(lang, e.target.checked)}
                        aria-label={`${languageName(lang)} confirmed live on WordPress`}
                        className={`h-[17px] w-[17px] rounded disabled:opacity-40 ${a.check}`}
                      />
                      {!canConfirmLive && !liveChecked && (
                        <span className="text-xs text-muted">enter the link first</span>
                      )}
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
