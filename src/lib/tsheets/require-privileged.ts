import { loadAccess } from '@/lib/access/resolve'

/**
 * Guard for the report's export surfaces (CSV, PDF, image, print).
 *
 * Being signed in is not enough: the proxy only proves WHO the caller is, and
 * these routes return the full budget, per-person cost and hourly-rate data
 * that the report page deliberately hides from Team Leaders and Users. The
 * Export buttons are hidden for them, but a hidden button is not a gate, the
 * URLs answered to anyone with a session until this was added.
 *
 * Gated on the same surface as the buttons, `report-export`, which is
 * configurable per level on Admin → Access levels.
 *
 * Plain module (not "use server") so route handlers and pages can both import
 * it. Returns a 403 Response when the caller may not pass, else null.
 */
export async function requirePrivileged(): Promise<Response | null> {
  if ((await loadAccess()).can('report-export')) return null
  return new Response('Not authorized. This export is limited to admins.', {
    status: 403,
    headers: { 'Content-Type': 'text/plain' },
  })
}
