import { getCurrentTier } from '@/lib/auth/role'

/**
 * Guard for the report's export surfaces (CSV, PDF, image, print).
 *
 * Being signed in is not enough: the proxy only proves WHO the caller is, and
 * these routes return the full budget, per-person cost and hourly-rate data
 * that the report page deliberately hides from Team Leaders and Users. The
 * Export buttons are hidden for them, but a hidden button is not a gate, the
 * URLs answered to anyone with a session until this was added.
 *
 * Same tier as the buttons: admin and admin_assistant.
 *
 * Plain module (not "use server") so route handlers and pages can both import
 * it. Returns a 403 Response when the caller may not pass, else null.
 */
export async function requirePrivileged(): Promise<Response | null> {
  if ((await getCurrentTier()).isPrivileged) return null
  return new Response('Not authorized. This export is limited to admins.', {
    status: 403,
    headers: { 'Content-Type': 'text/plain' },
  })
}
