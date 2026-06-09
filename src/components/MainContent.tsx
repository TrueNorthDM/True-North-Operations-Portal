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
    <main className="flex-1">
      {fullBleed ? (
        <div className="h-full">{children}</div>
      ) : (
        <div className="px-6 py-8 max-w-7xl w-full mx-auto">{children}</div>
      )}
    </main>
  )
}
