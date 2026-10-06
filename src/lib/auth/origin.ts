import { headers } from 'next/headers'

/**
 * The origin people use (https://truenorthportal.online, or http://localhost:3000
 * in development). Links the portal puts in an email must point back to it. On the
 * server that is APP_URL; in development the request headers say it.
 */
export async function requestOrigin(): Promise<string> {
  // On the portal's own server a request arrives as https://localhost:3000
  // (see public-origin.ts); the address people use is APP_URL.
  const app = process.env.APP_URL
  if (app) return new URL(app).origin
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host')
  return `${proto}://${host}`
}
