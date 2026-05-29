/**
 * HMAC verification of incoming Monday webhook payloads.
 *
 * Monday sends an `Authorization` header on each delivery (JWT format —
 * 3 base64url segments separated by dots). The middle segment, decoded,
 * is the JSON claim set. The signing key is the secret you configured
 * when creating the webhook in Monday.
 *
 * If verification fails or the secret isn't configured yet, the caller
 * decides what to do (200-and-log vs 401). In dev mode we typically log;
 * in prod we reject — see the route handler.
 *
 * Why we don't use a JWT library: Edge runtime + simpler audit, and the
 * standard Web Crypto API is enough for HS256.
 */

function base64UrlDecode(input: string): Uint8Array {
  // base64url → base64 → bytes
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export interface VerifyResult {
  ok: boolean
  reason?: string
  claims?: Record<string, unknown>
}

/**
 * Verify the `Authorization: Bearer <jwt>` header from a Monday webhook.
 * Returns claim set on success so the caller can read e.g. `webhookId`.
 */
export async function verifyMondayAuthHeader(
  authHeader: string | null,
  signingSecret: string,
): Promise<VerifyResult> {
  if (!authHeader) return { ok: false, reason: 'missing Authorization header' }
  // Monday's webhook docs show the header as just the JWT, no "Bearer" prefix,
  // but be defensive and accept both.
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed JWT' }
  const [headerB64, payloadB64, sigB64] = parts

  // Verify signature: HMAC-SHA256(`${headerB64}.${payloadB64}`)
  try {
    const key = await importHmacKey(signingSecret)
    const sig = base64UrlDecode(sigB64)
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const valid = await crypto.subtle.verify('HMAC', key, sig, signingInput)
    if (!valid) return { ok: false, reason: 'signature mismatch' }
  } catch (e) {
    return { ok: false, reason: `crypto error: ${(e as Error).message}` }
  }

  // Decode payload for the caller's convenience.
  let claims: Record<string, unknown>
  try {
    const json = new TextDecoder().decode(base64UrlDecode(payloadB64))
    claims = JSON.parse(json)
  } catch {
    return { ok: false, reason: 'malformed claims' }
  }

  return { ok: true, claims }
}

// Re-export helper used by tests / debugging.
export { bytesToBase64Url }
