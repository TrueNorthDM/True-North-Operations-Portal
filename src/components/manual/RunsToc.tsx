'use client'

// The "On this page" list of How it runs, which follows the reader's scroll.
// The only part of that tab that runs in the browser: the text itself is
// rendered on the server (HowItRuns).

import { useEffect, useState } from 'react'
import { TOC } from './runs-toc'

export function RunsToc() {
  const [active, setActive] = useState(TOC[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    for (const t of TOC) { const el = document.getElementById(t.id); if (el) observer.observe(el) }
    return () => observer.disconnect()
  }, [])

  return (
    <nav className="lg:sticky lg:top-[81px] lg:max-h-[calc(100vh-97px)] lg:overflow-y-auto flex flex-col gap-0.5">
      <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-[.09em] text-muted px-3 pb-2">On this page</div>
      {TOC.map(t => (
        <a
          key={t.id}
          href={`#${t.id}`}
          onClick={() => setActive(t.id)}
          className={`text-[13px] px-3 py-[7px] rounded-lg border-l-2 transition-colors ${active === t.id ? 'border-tn-teal bg-tn-teal-soft text-tn-teal font-bold' : 'border-transparent text-muted font-semibold hover:text-tn-ink hover:bg-subtle'}`}
        >
          {t.label}
        </a>
      ))}
      <div className="mt-4 pt-3 px-3 border-t border-slate-200 text-xs leading-relaxed text-muted">
        Last updated<br /><strong className="font-bold text-foreground">October 7, 2026</strong>
      </div>
    </nav>
  )
}
