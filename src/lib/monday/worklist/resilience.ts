// The Monday sync holding up when something goes wrong (My Work plan, phase 5).
// Pure rules, so they can be tested without Monday or a database:
//
//   retryDecision  whether a failed Monday call is worth trying again, and
//                  how long to wait first.
//   selectAllPages read every row of a query, 1,000 at a time. PostgREST stops
//                  at 1,000 rows without saying so; the change log read a
//                  board's "before" that way and, on boards with more than
//                  1,000 steps, saw the rest as new and wrote "assigned" events
//                  for work nobody had touched.
//   goneBoards     which boards discovery no longer sees in Monday, refusing to
//                  decide when the listing looks cut short.

/** What a failed call looked like. */
export interface CallFailure {
  /** HTTP status, when Monday answered at all. */
  status?: number
  /** The request never got an answer: network error or timeout. */
  network?: boolean
  /** GraphQL error messages, when Monday answered with errors. */
  messages?: string[]
  /** The Retry-After header, in seconds, when there was one. */
  retryAfterSeconds?: number | null
}

export const MAX_ATTEMPTS = 3
const MAX_WAIT_MS = 30_000

/**
 * Monday's rate limits come back as HTTP 429 or, for the complexity budget, as
 * a 200 carrying an error whose message says when the budget resets.
 */
const TRANSIENT = /complexity budget exhausted|complexityexception|rate limit|too many requests|internal server error|timeout|temporarily unavailable|try again/i

export function retryDecision(f: CallFailure, attempt: number): { retry: boolean; waitMs: number } {
  if (attempt >= MAX_ATTEMPTS) return { retry: false, waitMs: 0 }
  const text = (f.messages ?? []).join(' ')
  const transient = f.network === true
    || f.status === 429
    || (f.status !== undefined && f.status >= 500)
    || TRANSIENT.test(text)
  if (!transient) return { retry: false, waitMs: 0 }

  // "... reset in 23 seconds" (complexity budget), or the Retry-After header.
  const resetIn = /reset in (\d+) seconds?/i.exec(text)
  const told = resetIn ? Number(resetIn[1]) : f.retryAfterSeconds ?? null
  const waitMs = told != null && Number.isFinite(told)
    ? (told + 1) * 1000
    : 2000 * 2 ** (attempt - 1)
  return { retry: true, waitMs: Math.min(waitMs, MAX_WAIT_MS) }
}

/** One page of a query, rows `from` to `to` inclusive (PostgREST's .range). */
export type PageQuery<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>

/** Every row, a page at a time, until a page comes back short. */
export async function selectAllPages<T>(page: PageQuery<T>, size = 1000): Promise<{ data: T[]; error: { message?: string; code?: string } | null }> {
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1)
    if (error) return { data: out, error }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < size) return { data: out, error: null }
  }
}

export interface KnownBoard {
  id: number
  goneAt: string | null
}

/**
 * Which boards discovery no longer sees (archived or deleted in Monday), and
 * which have come back.
 *
 * A listing that returns fewer than half the boards we know as present is
 * treated as cut short, not as half the account being archived overnight: then
 * nothing is marked gone, and the reason says why.
 */
export function goneBoards(known: KnownBoard[], activeIds: Set<number>): { gone: number[]; back: number[]; refused?: string } {
  const present = known.filter(b => b.goneAt == null)
  const back = known.filter(b => b.goneAt != null && activeIds.has(b.id)).map(b => b.id)
  const missing = present.filter(b => !activeIds.has(b.id)).map(b => b.id)
  if (present.length > 0 && activeIds.size < present.length / 2) {
    return { gone: [], back, refused: `Monday listed ${activeIds.size} boards against ${present.length} known; not marking any as gone.` }
  }
  return { gone: missing, back }
}
