'use client'

/**
 * The last safety net: an error the portal's own frame could not catch (the
 * layout failing to load who you are or your access, for instance). It
 * replaces the root layout, so it brings its own <html> and <body> and its own
 * styles, in the portal's colours, instead of Next's bare error screen
 * (audit, 8 October 2026). "Try again" fetches the page again.
 */

import { useEffect } from 'react'

export default function GlobalError({ error, reset, unstable_retry }: { error: Error & { digest?: string }; reset: () => void; unstable_retry?: () => void }) {
  useEffect(() => {
    console.error('[app] global error:', error)
  }, [error])
  const retry = unstable_retry ?? reset

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#efede8', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', color: '#012358' }}>
        <main style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>The portal could not load</h1>
          <p style={{ fontSize: 14, color: '#5b6878', margin: 0, lineHeight: 1.5 }}>
            This is usually brief. Try again in a moment; if it keeps happening, tell an admin.
          </p>
          {error.digest && <p style={{ fontSize: 12, color: '#8593a4', margin: '10px 0 0' }}>Reference: {error.digest}</p>}
          <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button type="button" onClick={() => retry()} style={{ background: '#012358', color: '#ffffff', border: 0, borderRadius: 10, padding: '11px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Try again
            </button>
            {/* A plain link on purpose: the app's router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ background: '#ffffff', color: '#012358', border: '1px solid #d7dde5', borderRadius: 10, padding: '11px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
