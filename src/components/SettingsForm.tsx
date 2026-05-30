'use client'

/**
 * SettingsForm — per-project language config UI.
 *
 * - Removable language chips (English locked because it's the x-default anchor)
 * - "Add language" input (validates BCP-47 shape)
 * - Live hreflang preview using placeholder URLs derived from `language_paths`
 * - Confirmation modal before save (shows # of pages that will be flagged)
 * - Empty state for unchanged config
 */

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { renderHreflangHtml } from '@/lib/hreflang'
import { updateSiteLanguages } from '@/app/actions'
import { languagePalette } from '@/lib/language-colors'

interface Props {
  site: {
    code: 'aaaf' | 'hfa'
    name: string
    domain: string
    languages: string[]
    language_paths: Record<string, string>
    pagesWithUrlsCount: number
  }
  /**
   * When true, render without the outer card chrome — the parent supplies
   * the rounded-xl/border/padding so siblings (e.g. MondayBoardField) can
   * sit inside the same visual card.
   */
  embedded?: boolean
}

const accentMap = {
  aaaf: {
    chip: 'bg-aaaf-soft text-aaaf-secondary border-aaaf-primary/30',
    btn: 'bg-aaaf-primary hover:bg-aaaf-primary-hover',
    ring: 'focus:ring-aaaf-primary',
  },
  hfa: {
    chip: 'bg-hfa-soft text-hfa-secondary border-hfa-primary/40',
    btn: 'bg-hfa-primary hover:bg-hfa-primary-hover',
    ring: 'focus:ring-hfa-primary',
  },
} as const

function buildPreviewUrls(
  domain: string,
  languages: string[],
  paths: Record<string, string>,
): { language_code: string; url: string }[] {
  return languages.map(lang => {
    // For known langs use the configured path prefix; for unknown ones (newly
    // added), fall back to using the language code as the prefix.
    const prefix = paths[lang] ?? lang
    const segment = prefix ? `${prefix}/` : ''
    return { language_code: lang, url: `${domain}/${segment}example-page/` }
  })
}

export function SettingsForm({ site, embedded = false }: Props) {
  const router = useRouter()
  const a = accentMap[site.code]
  const [langs, setLangs] = useState<string[]>(site.languages)
  const [newLang, setNewLang] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, startSave] = useTransition()

  const original = site.languages
  const added = useMemo(() => langs.filter(l => !original.includes(l)), [langs, original])
  const removed = useMemo(() => original.filter(l => !langs.includes(l)), [original, langs])
  const isDirty = added.length > 0 || removed.length > 0

  const beforeHtml = useMemo(
    () => renderHreflangHtml(buildPreviewUrls(site.domain, original, site.language_paths)),
    [site.domain, original, site.language_paths],
  )
  const afterHtml = useMemo(
    () => renderHreflangHtml(buildPreviewUrls(site.domain, langs, site.language_paths)),
    [site.domain, langs, site.language_paths],
  )

  function addLang() {
    setError(null)
    const v = newLang.trim().toLowerCase()
    if (!v) return
    if (!/^[a-z]{2,3}(-[a-z]{2})?$/i.test(v)) {
      setError(`"${v}" doesn't look like a valid BCP-47 code (e.g. "fr", "de", "pt-br").`)
      return
    }
    if (langs.includes(v)) {
      setError(`"${v}" is already in the list.`)
      return
    }
    setLangs([...langs, v])
    setNewLang('')
  }

  function removeLang(lang: string) {
    setError(null)
    if (lang === 'en') {
      setError('English (en) is the x-default anchor and cannot be removed.')
      return
    }
    setLangs(langs.filter(l => l !== lang))
  }

  function reset() {
    setLangs(original)
    setNewLang('')
    setError(null)
  }

  function handleSave() {
    setError(null)
    setConfirmOpen(false)
    startSave(async () => {
      const res = await updateSiteLanguages({ siteCode: site.code, newLanguages: langs })
      if (!res.ok) {
        setError(res.error ?? 'Failed to save.')
        return
      }
      router.refresh()
    })
  }

  // How many pages WILL be flagged on save (any language change — add OR remove — requires a hreflang update)
  const flagCountOnSave = isDirty ? site.pagesWithUrlsCount : 0

  return (
    <section className={embedded ? 'space-y-5' : 'rounded-xl bg-white border border-slate-200 p-6 space-y-5'}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
            {site.code}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{site.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{site.domain.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>

      {/* Languages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-700">Languages</h3>
          <span className="text-xs text-slate-400">
            Default: <strong className="font-semibold text-slate-700">en</strong> (locked — drives x-default)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {langs.map(lang => {
            const isEn = lang === 'en'
            const isNew = added.includes(lang)
            const langC = languagePalette(lang)
            return (
              <span
                key={lang}
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium uppercase ${langC.bg} ${langC.text} ${langC.border} ${isNew ? 'ring-2 ring-offset-1 ring-green-400/60' : ''}`}
              >
                {lang}
                {!isEn && (
                  <button
                    onClick={() => removeLang(lang)}
                    aria-label={`Remove ${lang}`}
                    className="text-slate-400 hover:text-red-600 transition-colors -mr-1 text-base leading-none"
                    type="button"
                  >
                    ×
                  </button>
                )}
              </span>
            )
          })}
          {/* Inline add */}
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="text"
              value={newLang}
              onChange={e => setNewLang(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addLang())}
              placeholder="add lang (e.g. fr)"
              className={`w-28 px-3 py-1 rounded-full border border-slate-200 text-sm focus:outline-none focus:ring-2 ${a.ring}`}
            />
            <button
              type="button"
              onClick={addLang}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
        {removed.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Removing: {removed.map(l => <span key={l} className="inline-block uppercase font-mono mr-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700">{l}</span>)}
            <span className="ml-1 text-slate-400">— existing URLs stay in DB, marked discontinued on the page.</span>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Hreflang preview</h3>
        <p className="text-xs text-slate-500">Using a placeholder slug <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">/example-page/</code> — your real page URLs follow the same pattern.</p>
        {isDirty ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <PreviewBlock label="Before" tone="neutral" html={beforeHtml} />
            <PreviewBlock label="After" tone="primary" html={afterHtml} />
          </div>
        ) : (
          <PreviewBlock label="Current" tone="neutral" html={beforeHtml} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        {isDirty && (
          <button
            onClick={reset}
            type="button"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel changes
          </button>
        )}
        <button
          type="button"
          disabled={!isDirty || saving}
          onClick={() => setConfirmOpen(true)}
          className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${a.btn}`}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Confirm language changes</h3>
            <div className="text-sm text-slate-600 space-y-2">
              {added.length > 0 && (
                <p>
                  <strong>Adding:</strong> {added.map(l => <span key={l} className="inline-block uppercase font-mono mr-1 px-1.5 py-0.5 rounded bg-green-50 text-green-700">{l}</span>)}
                </p>
              )}
              {removed.length > 0 && (
                <p>
                  <strong>Removing:</strong> {removed.map(l => <span key={l} className="inline-block uppercase font-mono mr-1 px-1.5 py-0.5 rounded bg-red-50 text-red-700">{l}</span>)}
                </p>
              )}
              {flagCountOnSave > 0 ? (
                <p className="pt-2 border-t border-slate-100">
                  <strong className="text-amber-700">Heads up:</strong>{' '}
                  <span className="text-slate-700"><strong>{flagCountOnSave}</strong> pages already have URLs and will be flagged as <em>needs update</em>. They&apos;ll appear in the &quot;Pages needing update&quot; list on the Dashboard and the project page.</span>
                </p>
              ) : (
                <p className="pt-2 border-t border-slate-100 text-slate-500">
                  No pages will be flagged — empty pages don&apos;t need attention.
                </p>
              )}
              {removed.length > 0 && (
                <p className="text-xs text-slate-500 pt-1">
                  URLs and confirmations for removed languages stay in the database (marked as <em>discontinued</em> on each page).
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${a.btn}`}
              >
                Save and flag pages
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PreviewBlock({ label, tone, html }: { label: string; tone: 'neutral' | 'primary'; html: string }) {
  const labelCls = tone === 'primary' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${labelCls}`}>{label}</div>
      <pre className="text-[11px] p-3 overflow-x-auto bg-slate-900 text-slate-100 leading-relaxed font-mono whitespace-pre-wrap">
        {html || '(no tags)'}
      </pre>
    </div>
  )
}
