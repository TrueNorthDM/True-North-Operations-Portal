import { headers } from 'next/headers'

/**
 * The origin the request came in on (https://truenorthoperationsportal.vercel.app,
 * http://localhost:3000, later https://truenorthportal.online), from the request
 * headers. Links the portal puts in an email must point back to the host the person
 * is actually using. Vercel and the Next.js dev server both set these headers, so no
 * environment variable has to be remembered.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host')
  return `${proto}://${host}`
}
