/**
 * Which copy of the portal this is: production (truenorthportal.online) or the
 * staging copy (staging.truenorthportal.online), where changes are tried before
 * they are promoted.
 *
 * NEXT_PUBLIC_APP_ENV is set at build time (deploy/portal/deploy.sh builds each
 * environment separately), so it is the same on the server and in the browser.
 * Unset means production.
 */

export const IS_STAGING = process.env.NEXT_PUBLIC_APP_ENV === 'staging'

/**
 * Staging holds a copy of the real data, people included, so the emails the
 * portal sends itself (invitations) go only to the addresses on
 * STAGING_EMAIL_ALLOWLIST (comma separated). An empty list sends nothing.
 */
export function stagingMayEmail(to: string, allowlist: string | undefined): boolean {
  const allowed = (allowlist ?? '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(to.trim().toLowerCase())
}
