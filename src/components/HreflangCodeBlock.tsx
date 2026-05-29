'use client'

/**
 * HreflangCodeBlock — renders the generated hreflang HTML with a copy button.
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
      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
        Add URLs for all languages to generate the hreflang code.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-300">
        <span className="text-xs font-mono">hreflang tags</span>
        <button
          onClick={handleCopy}
          className="text-xs font-medium px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      {/* Code */}
      <pre className="text-xs p-4 overflow-x-auto bg-slate-900 text-slate-100 leading-relaxed font-mono whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}
