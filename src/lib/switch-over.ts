/**
 * The two switches the old portal (Vercel) uses on switch-over day
 * (deploy/SWITCH-OVER.md). Both are off unless their environment variable is
 * set, and the proxy asks this before anything else.
 *
 * MAINTENANCE_MODE=1 (step p6-freeze): nothing may change the old data while it
 * is copied. Pages show /maintenance; API routes (cron jobs, Monday webhooks)
 * and form posts answer 503.
 *
 * LEGACY_REDIRECT_TO=https://truenorthportal.online (after the go/no-go): every
 * address on the old host goes to the same path on the new one, so bookmarks
 * and the links in PDFs already sent keep working. Vercel's own cron calls get
 * 410 instead, so the jobs never run twice on the new server.
 */

export type SwitchOverAction =
  | { kind: 'redirect'; location: string }
  | { kind: 'maintenance-page' }
  | { kind: 'unavailable'; status: 503 | 410 }
  | null

export interface SwitchOverInput {
  method: string
  pathname: string
  search: string
  env: { MAINTENANCE_MODE?: string; LEGACY_REDIRECT_TO?: string }
}

const ON = new Set(['1', 'true', 'on', 'yes'])

/** Is MAINTENANCE_MODE switched on? */
export function maintenanceOn(value: string | undefined): boolean {
  return ON.has((value ?? '').trim().toLowerCase())
}

/** The new address, only when it is a plain https origin; anything else leaves the switch off. */
function redirectOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

export function switchOverAction({ method, pathname, search, env }: SwitchOverInput): SwitchOverAction {
  const origin = redirectOrigin(env.LEGACY_REDIRECT_TO)
  if (origin) {
    if (pathname === '/api/cron' || pathname.startsWith('/api/cron/')) return { kind: 'unavailable', status: 410 }
    return { kind: 'redirect', location: origin + pathname + search }
  }

  if (maintenanceOn(env.MAINTENANCE_MODE)) {
    if (pathname === '/api' || pathname.startsWith('/api/')) return { kind: 'unavailable', status: 503 }
    // Form posts and server actions would write; only reading the page is allowed.
    if (method !== 'GET' && method !== 'HEAD') return { kind: 'unavailable', status: 503 }
    if (pathname === '/maintenance') return null
    return { kind: 'maintenance-page' }
  }

  return null
}
