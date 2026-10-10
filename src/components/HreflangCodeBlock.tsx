'use client'

/**
 * HreflangCodeBlock: the generated hreflang tags with a Copy button.
 *
 * This replaces the "paste special, values only" step of the old Google
 * Sheet: the assignee copies and pastes straight into WordPress.
 *
 * The code is offered only when every current site language has a link
 * (audit, 10 October 2026). It used to appear as soon as one link was saved,
 * so a page could go live with tags that left languages out; now the block
 * names the languages still missing instead.
 */

import { useState } from 'react'
import { renderHreflangHtml } from '@/lib/hreflang'
import type { PageUrl } from '@/lib/hreflang'
import { languageName } from '@/lib/language-display'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

interface Props {
  /** The saved links of the current site languages. */
  urls: PageUrl[]
  /** The site's current languages: the code needs a link for each. */
  languages: string[]
  defaultLang?: string
}

/** ["Spanish", "Swahili"] -> "Spanish and Swahili". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The current languages that have no saved link yet. */
export function missingLanguages(urls: PageUrl[], languages: string[]): string[] {
  const has = new Set(urls.filter(u => u.url.trim() !== '').map(u => u.language_code))
  return languages.filter(l => !has.has(l))
}

export function HreflangCodeBlock({ urls, languages, defaultLang = 'en' }: Props) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)

  const missing = missingLanguages(urls, languages)
  const ready = languages.length > 0 && missing.length === 0
  // Only the current languages go into the tags, in the site's order.
  const current = languages.map(l => urls.find(u => u.language_code === l)).filter((u): u is PageUrl => !!u)
  const code = ready ? renderHreflangHtml(current, defaultLang) : ''

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied('yes')
    } catch {
      setCopied('failed')
    }
    setTimeout(() => setCopied(null), 2500)
  }

  if (!ready) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-muted">
        {languages.length === 0
          ? 'This site has no languages set in Settings yet.'
          : `Add the ${listNames(missing.map(languageName))} ${missing.length === 1 ? 'link' : 'links'} to get the code.`}
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#1f2d3d]">
      {/* Toolbar: fixed dark chrome, like the handoff. */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#152030]">
        <span className="text-[11.5px] font-mono text-[#8ba0b8]">
          hreflang tags · {current.length} {current.length === 1 ? 'language' : 'languages'}
        </span>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-[11.5px] text-[#cfe0f2]">
            {copied === 'yes' ? 'Copied.' : copied === 'failed' ? 'Could not copy: select the code and copy it by hand.' : ''}
          </span>
          <button type="button" onClick={handleCopy} className={BTN.white}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {copied === 'yes'
                ? <path d="M20 6 9 17l-5-5" />
                : <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>}
            </svg>
            Copy code
          </button>
        </div>
      </div>
      <pre className="text-xs p-4 overflow-x-auto bg-[#0c1622] text-[#cfe0f2] leading-[1.7] font-mono whitespace-pre-wrap m-0">
        {code}
      </pre>
    </div>
  )
}
