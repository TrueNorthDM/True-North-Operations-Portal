/**
 * The shared secret that authenticates Monday webhook deliveries.
 *
 * WHY A SECRET IN THE URL AND NOT A SIGNATURE. Monday only signs webhooks that
 * belong to an integration app: "to enable this feature, create the webhook
 * with an integration app token". These webhooks were created with a personal
 * API token and the account has no app at all (Developer Center -> My apps is
 * empty), so no signing secret exists to verify against. An unguessable path
 * segment is the standard fallback for unsigned webhook providers, and it is
 * what the endpoint had instead of nothing: before this, POST /api/monday/webhook
 * with no credential of any kind returned 200 and ran as service_role.
 *
 * WHAT IT IS AND IS NOT. It is a bearer credential: whoever holds it can post
 * events. It travels inside the URL on every delivery, so unlike an HMAC it can
 * appear in access logs and in Monday's own webhook configuration screen. TLS
 * protects it in transit. That is weaker than a signature and stronger than the
 * nothing it replaces; the upgrade path (create a Monday app, recreate the
 * webhooks with its OAuth token, verify the JWT) stays open and is written up
 * in the audit notes.
 *
 * The secret is generated here rather than typed by a person: 32 bytes of
 * crypto randomness beats anything anyone would pick, and there is no source to
 * copy it from the way there would be with a provider-issued key.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/** 43 base64url chars from 32 random bytes. */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

/**
 * Constant-time string comparison.
 *
 * A timing attack against a path segment over the public internet is not a
 * realistic threat, but an early-exit compare is the kind of detail that gets
 * copied into a place where it does matter, so it is not worth having in the
 * codebase at all.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Length is not secret (it is fixed by generateWebhookSecret), so comparing
  // it directly is fine and avoids indexing past the end below.
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Whether `candidate` is the configured secret.
 *
 * Fails CLOSED: no secret stored means nothing is accepted on the secret URL.
 * That is the opposite of the old signature check, which treated "not
 * configured" as "skip the check" and is exactly how the endpoint ended up
 * unauthenticated in the first place.
 */
export async function webhookSecretMatches(candidate: string): Promise<boolean> {
  if (!candidate) return false
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_settings')
    .select('monday_webhook_secret')
    .eq('singleton_id', 1)
    .maybeSingle<{ monday_webhook_secret: string | null }>()
  const stored = data?.monday_webhook_secret ?? ''
  if (!stored) return false
  return timingSafeEqual(candidate, stored)
}
