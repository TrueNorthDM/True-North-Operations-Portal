'use client'

/**
 * HreflangCodeBlock: renders the generated hreflang HTML with a copy button.
 *
 * This replaces the "paste special → values only" step from the Google Sheet.
 * The assignee clicks Copy, then pastes directly into WordPress.
 */

import { useState } from 'react'
import { renderHreflangHtml } from '@/lib/hreflang'
import type { PageUrl } from '@/lib/hreflang'

interface Props {
  urls: PageUrl[]
  defaultLang?: string
}

export function HreflangCodeBlock({ urls, defaultLang = 'en' }: Props) {
  const [copied, setCopied] = useState(false)

  const hasAllUrls = urls.length > 0
  const code = hasAllUrls ? renderHreflangHtml(urls, defaultLang) : ''

  async function handleCopy() {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!hasAllUrls) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-muted">
        Add URLs for all languages to generate the hreflang code.
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden border border-[#1f2d3d]">
      {/* Toolbar: fixed dark chrome (same in light & dark, like the handoff). */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#152030]">
        <span className="text-[11.5px] font-mono text-[#8ba0b8]">
          hreflang tags · {urls.length} {urls.length === 1 ? 'language' : 'languages'}
        </span>
        <button
          onClick={handleCopy}
          className="text-[11.5px] font-semibold px-3 py-1 rounded-md text-[#e7eef7] transition-colors"
          style={{ backgroundColor: copied ? '#1E9E6A' : '#2a3d55' }}
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code */}
      <pre className="text-xs p-4 overflow-x-auto bg-[#0c1622] text-[#cfe0f2] leading-[1.7] font-mono whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}
