/**
 * What to say when a save throws instead of answering.
 *
 * Most of the time it is the network. But a page opened before a deploy calls
 * its server actions by ids the new build no longer has, and Next answers
 * "Failed to find Server Action": blaming the connection there sent people
 * looking for a problem they did not have (owner, 28 October 2026). Next marks
 * that case itself, so it gets its own sentence: reload, and it works.
 */

import { unstable_isUnrecognizedActionError } from 'next/navigation'

export const UPDATED_TEXT = 'The portal was just updated. Reload the page and try again.'
export const NETWORK_TEXT = 'That did not go through. Check your connection and try again.'

/** Whether a thrown error is a page older than the deploy calling an action that is gone. */
export const isStalePage = (e: unknown): boolean => unstable_isUnrecognizedActionError(e)

/** The sentence for a save that threw: reload after a deploy, else the connection. */
export const failText = (e: unknown): string => (isStalePage(e) ? UPDATED_TEXT : NETWORK_TEXT)

/** A screen's own sentence for a call that threw, unless the page is older than the deploy. */
export const staleOr = (e: unknown, text: string): string => (isStalePage(e) ? UPDATED_TEXT : text)
