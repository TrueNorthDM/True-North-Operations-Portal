/**
 * A read for an Href Links page that answers "failed" instead of throwing, so
 * the page can say so in place (audit, 10 October 2026). The reason goes to
 * the server log; the screen shows the short READ_ERROR sentence.
 */

export type Attempt<T> = { ok: true; value: T } | { ok: false }

export async function attempt<T>(what: string, read: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await read() }
  } catch (e) {
    console.error(`[href links] ${what}:`, e instanceof Error ? e.message : e)
    return { ok: false }
  }
}
