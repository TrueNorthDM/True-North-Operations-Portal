'use client'

/**
 * MainContent — wraps the page children and tints the entire main area with
 * a soft pastel of the active project's brand color.
 *
 * Client Component because it needs usePathname() to detect the current route.
 * The tint applies to the FULL `<main>` (flex-1), not just the centered content,
 * so the brand color extends edge-to-edge from the sidebar to the viewport.
 *
 * Inner content blocks (cards, tables) stay white — they sit ON TOP of the tint.
 */

import { usePathname } from 'next/navigation'

function bgForPath(pathname: string): string {
  if (pathname === '/aaaf' || pathname.startsWith('/aaaf/')) return 'bg-aaaf-soft/50'
  if (pathname === '/hfa' || pathname.startsWith('/hfa/')) return 'bg-hfa-soft/50'
  return '' // Dashboard, Settings, etc. — keep neutral
}

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bg = bgForPath(pathname)

  // Framed pages (a legacy dashboard inside an iframe) need to fill the whole
  // content area edge-to-edge, so they opt out of the centered max-width box and
  // get a full-height wrapper instead. `<main>` is a stretched flex item with a
  // definite height, so `h-full` here resolves — no viewport math needed, the
  // iframe just fills via flex-1.
  const fullBleed = pathname === '/dashboards/publishing'

  return (
    <main className={`flex-1 transition-colors ${bg}`}>
      {fullBleed ? (
        <div className="h-full p-3">{children}</div>
      ) : (
        <div className="px-6 py-8 max-w-7xl w-full mx-auto">{children}</div>
      )}
    </main>
  )
}
