'use client'

/**
 * MainContent — wraps the page children. Normal pages get a centered, padded
 * container; framed pages (a legacy dashboard in an iframe) get a full-height,
 * edge-to-edge wrapper so the frame fills the entire content area.
 *
 * Client Component because it needs usePathname() to pick the wrapper. The page
 * background is a single consistent tone (globals.css `--background`), so the
 * main area stays transparent — no per-route brand tint.
 */

import { usePathname } from 'next/navigation'

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Framed pages opt out of the centered max-width box and fill the whole area.
  // `<main>` is a stretched flex item with a definite height, so `h-full` here
  // resolves and the iframe fills it — no padding, no viewport math.
  const fullBleed = pathname === '/dashboards/publishing'

  return (
    // min-w-0: as a flex item next to the sidebar, <main> defaults to
    // min-width:auto and would refuse to shrink below its widest child (e.g.
    // the org chart's natural width), pushing a page-level horizontal scrollbar.
    // min-w-0 lets it shrink to the available width; wide children clip/scroll
    // within their own containers instead.
    <main className="flex-1 min-w-0">
      {fullBleed ? (
        <div className="h-full">{children}</div>
      ) : (
        // Full-bleed on every screen — use the whole width, just a little side
        // padding so content doesn't hug the edges.
        <div className="px-6 py-8 w-full">{children}</div>
      )}
    </main>
  )
}
