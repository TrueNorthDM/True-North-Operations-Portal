/**
 * The maintenance pause, used on switch-over day (deploy/SWITCH-OVER.md) and
 * available for any later maintenance. Off unless MAINTENANCE_MODE is set, and
 * the proxy asks this before anything else.
 *
 * MAINTENANCE_MODE=1: nothing may change the data while it is being worked on.
 * Pages show /maintenance; API routes (cron jobs, Monday webhooks) and form
 * posts answer 503.
 *
 * The old address's redirect to truenorthportal.online lives in its own Vercel
 * project now (deploy/legacy-redirect), not in the portal.
 */

export type SwitchOverAction =
  | { kind: 'maintenance-page' }
  | { kind: 'unavailable'; status: 503 }
  | null

export interface SwitchOverInput {
  method: string
  pathname: string
  search: string
  env: { MAINTENANCE_MODE?: string }
}

const ON = new Set(['1', 'true', 'on', 'yes'])

/** Is MAINTENANCE_MODE switched on? */
export function maintenanceOn(value: string | undefined): boolean {
  return ON.has((value ?? '').trim().toLowerCase())
}

export function switchOverAction({ method, pathname, env }: SwitchOverInput): SwitchOverAction {
  if (maintenanceOn(env.MAINTENANCE_MODE)) {
    if (pathname === '/api' || pathname.startsWith('/api/')) return { kind: 'unavailable', status: 503 }
    // Form posts and server actions would write; only reading the page is allowed.
    if (method !== 'GET' && method !== 'HEAD') return { kind: 'unavailable', status: 503 }
    if (pathname === '/maintenance') return null
    return { kind: 'maintenance-page' }
  }

  return null
}
