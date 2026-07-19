'use client'

/**
 * WpUrlsField: Dev / Live WordPress URL inputs for a site.
 *
 * Saves both fields together in a single action because they're a pair: an
 * SEO 2 normally updates one when the other changes (e.g. moving the test
 * URL between environments).
 *
 * Lives inside each project card on /settings, below the Monday board ID.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSiteWpUrls } from '@/app/actions'

interface Props {
  siteCode: 'aaaf' | 'hfa'
  initialDev: string | null
  initialLive: string | null
  accent: 'aaaf' | 'hfa'
}

const accentBtn = {
  aaaf: 'bg-aaaf-primary hover:bg-aaaf-primary-hover',
  hfa: 'bg-hfa-primary hover:bg-hfa-primary-hover',
}

export function WpUrlsField({ siteCode, initialDev, initialLive, accent }: Props) {
  const router = useRouter()
  const [dev, setDev] = useState(initialDev ?? '')
  const [live, setLive] = useState(initialLive ?? '')
  const [saving, startSave] = useTransition()
  const [flash, setFlash] = useState<'saved' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dirty = dev.trim() !== (initialDev ?? '') || live.trim() !== (initialLive ?? '')

  function handleSave() {
    setError(null)
    startSave(async () => {
      const res = await saveSiteWpUrls({ siteCode, devUrl: dev, liveUrl: live })
      if (!res.ok) {
        setError(res.error ?? 'Could not save WordPress URLs.')
        return
      }
      setFlash('saved')
      setTimeout(() => setFlash(null), 2000)
      router.refresh()
    })
  }

  return (
    <div className="mt-5 pt-5 border-t border-slate-100">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        WordPress URLs
      </label>
      <div className="space-y-2">
        <UrlInput
          label="Dev"
          value={dev}
          onChange={setDev}
          placeholder="https://devsite.example.com/some-page/"
        />
        <UrlInput
          label="Live"
          value={live}
          onChange={setLive}
          placeholder="https://www.example.com/some-page/"
        />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`text-sm font-medium px-3 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accentBtn[accent]}`}
        >
          {saving ? 'Saving…' : 'Save URLs'}
        </button>
        {flash === 'saved' && (
          <span className="text-xs text-emerald-700">Saved ✓</span>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Used by the Dev / Live buttons on the project page header. Leave blank to hide that button.
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function UrlInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-12 shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-slate-100 text-slate-600">
        {label}
      </span>
      <input
        type="url"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
    </div>
  )
}
