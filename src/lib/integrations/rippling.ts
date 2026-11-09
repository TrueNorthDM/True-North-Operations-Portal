/**
 * Rippling's REST API v2 (https://rest.ripplingapis.com), called with the
 * company's API token that a Super Admin pastes in Company settings >
 * Integrations (owner, 9 November 2026). Only what the portal uses: the company
 * (to test the token), the workers (to match people), the leave types, leave
 * requests and time entries. Server only; the token never reaches a browser.
 *
 * A refusal that will not pass by trying again (a bad token, a missing
 * permission, a field Rippling rejects) is a RipplingError with `final`; a
 * busy or failing Rippling is not final, so the outbox tries again later.
 */

import type { RipplingWorker } from './rippling-rules'

const API = 'https://rest.ripplingapis.com'
const TIMEOUT_MS = 20_000
/** The longest list read: 50 pages, far more than the company has. */
const MAX_PAGES = 50

export class RipplingError extends Error {
  constructor(message: string, readonly status: number, readonly final: boolean) { super(message) }
}

/** What Rippling said, as one short sentence for the screens. */
function said(json: unknown): string {
  if (!json || typeof json !== 'object') return ''
  const j = json as Record<string, unknown>
  const first = [j.message, j.detail, j.error, j.description].find(x => typeof x === 'string') as string | undefined
  if (first) return first
  const errs = j.errors
  if (Array.isArray(errs) && errs.length) {
    const e = errs[0] as Record<string, unknown>
    return [e.code, e.message ?? e.detail].filter(x => typeof x === 'string').join(': ')
  }
  return ''
}

async function call<T>(token: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', pathOrUrl: string, body?: unknown): Promise<T> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${API}${pathOrUrl}`
  // Only Rippling's own address ever gets the token, even from a next_link.
  if (!url.startsWith(`${API}/`)) throw new RipplingError('Rippling answered with an unexpected address.', 0, true)
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    throw new RipplingError(`Rippling could not be reached (${e instanceof Error ? e.message : 'network'}).`, 0, false)
  }
  const text = await res.text()
  let json: unknown = null
  try { json = text ? JSON.parse(text) : null } catch { json = null }
  if (res.ok) return json as T
  const why = said(json)
  if (res.status === 401) throw new RipplingError('Rippling refused the token: it is wrong, revoked or unused for 30 days. Paste a new one in Company settings, Integrations.', 401, true)
  if (res.status === 403) throw new RipplingError(`The Rippling token is missing a permission${why ? ` (${why})` : ''}. Add it to the token in Rippling.`, 403, true)
  if (res.status === 429 || res.status >= 500) throw new RipplingError(`Rippling is busy (${res.status}). It is tried again later.`, res.status, false)
  throw new RipplingError(`Rippling said no (${res.status})${why ? `: ${why}` : '.'}`, res.status, true)
}

/** Every page of a list. */
async function listAll<T>(token: string, path: string): Promise<T[]> {
  const out: T[] = []
  let next: string | null = path
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const r: { results?: T[]; next_link?: string | null } = await call(token, 'GET', next)
    out.push(...(r?.results ?? []))
    next = r?.next_link ?? null
  }
  return out
}

/** The company the token belongs to: tests the token, and says where it points. */
export async function companyName(token: string): Promise<string> {
  const r = await call<{ results?: { name?: string; legal_name?: string }[] }>(token, 'GET', '/companies')
  const c = r?.results?.[0]
  return c?.name || c?.legal_name || 'Rippling'
}

export const listWorkers = (token: string) => listAll<RipplingWorker>(token, '/workers?expand=user')

export const listLeaveTypes = async (token: string) =>
  (await listAll<{ id: string; name?: string }>(token, '/leave-types')).map(t => ({ id: t.id, name: t.name ?? '' }))

/** One day off, already approved (no email from Rippling). Its id. */
export async function createLeave(token: string, x: { workerId: string; typeId: string; day: string; hours: number | null; comment: string }): Promise<string> {
  const r = await call<{ id?: string }>(token, 'POST', '/leave-requests', {
    worker_id: x.workerId, leave_type_id: x.typeId, status: 'APPROVED', start_date: x.day, end_date: x.day,
    ...(x.hours ? { start_date_custom_hours: x.hours, end_date_custom_hours: x.hours } : {}), comments: x.comment,
  })
  if (!r?.id) throw new RipplingError('Rippling took the time off but gave no id back.', 200, true)
  return r.id
}

/** A day off cancelled (there is no delete: status only, with its current dates). */
export async function cancelLeave(token: string, x: { id: string; workerId: string; day: string }): Promise<void> {
  await call(token, 'PATCH', `/leave-requests/${encodeURIComponent(x.id)}`, { worker_id: x.workerId, status: 'CANCELED', start_date: x.day, end_date: x.day })
}

/** One day's hours, already approved. Its id. */
export async function createHours(token: string, x: { workerId: string; day: string; hours: number; key: string }): Promise<string> {
  const r = await call<{ id?: string }>(token, 'POST', '/time-entries', { worker_id: x.workerId, start_date: x.day, duration: x.hours, status: 'APPROVED', idempotency_key: x.key })
  if (!r?.id) throw new RipplingError('Rippling took the hours but gave no id back.', 200, true)
  return r.id
}

export async function updateHours(token: string, x: { id: string; workerId: string; hours: number }): Promise<void> {
  await call(token, 'PATCH', `/time-entries/${encodeURIComponent(x.id)}`, { worker_id: x.workerId, duration: x.hours })
}

export async function deleteHours(token: string, id: string): Promise<void> {
  try {
    await call(token, 'DELETE', `/time-entries/${encodeURIComponent(id)}`)
  } catch (e) {
    // Already gone in Rippling: nothing left to remove.
    if (e instanceof RipplingError && e.status === 404) return
    throw e
  }
}
