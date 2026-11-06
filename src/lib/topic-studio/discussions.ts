/**
 * Social discussions of a topic (phase 4, 6 November 2026): Reddit threads,
 * forum posts and the like that the SEO pastes to see what real people ask and
 * feel about the topic. Ported from the Artifact (discView, the 'disc' branch
 * of handlePaste and the text summarizeDiscussions hands to Claude). A thread
 * is captured the way a competitor page is, but kept as kind 'discussion', with
 * no links and at most 600 blocks. Pure; the Claude call is not here.
 */

import { countWords, hashId, hostOf } from './engine'
import type { CleanCapture } from './capture-place'
import type { TopicPage } from './project'

export const MAX_DISCUSSION_BLOCKS = 600
/** The most threads a topic keeps. */
export const MAX_DISCUSSIONS = 40
/** What one thread contributes to the text for Claude. */
export const THREAD_CHARS = 7000
/** What all threads together contribute. */
export const THREADS_CHARS = 70000

const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s)

/** The pages that are discussions, in the order they were captured. */
export const discussionPages = (pages: readonly TopicPage[]): TopicPage[] => pages.filter(p => p.kind === 'discussion')

export interface DiscussionRow {
  /** The page's id, what removing it names. */
  key: string
  title: string
  url: string
  domain: string
  words: number
  /** The first lines of the thread, for a glance. */
  lines: string[]
}

export interface DiscussionsView {
  rows: DiscussionRow[]
  total: number
  words: number
  full: boolean
}

/** The captured threads as rows: title, address, site, words and the first lines. */
export function discussionsView(pages: readonly TopicPage[]): DiscussionsView {
  const rows = discussionPages(pages).map((p, i): DiscussionRow => ({
    key: p.artifactId ?? `${i}`,
    title: p.title || 'Discussion',
    url: p.url,
    domain: p.url ? hostOf(p.url) : '',
    words: p.blocks.reduce((n, b) => n + countWords(b[1]), 0),
    lines: p.blocks.slice(0, 3).map(b => clip(b[1], 160)),
  }))
  return { rows, total: rows.length, words: rows.reduce((n, r) => n + r.words, 0), full: rows.length >= MAX_DISCUSSIONS }
}

/** Where to look for threads about the topic: the Artifact's search links (Christian Forums only for a faith-based client). */
export function discussionSearchLinks(query: string, faith: boolean): { label: string; href: string }[] {
  const q = encodeURIComponent(query)
  const links = [
    { label: 'Google forums', href: `https://www.google.com/search?q=${q}&udm=18` },
    { label: 'Reddit', href: `https://www.reddit.com/search/?q=${q}` },
    { label: 'Quora', href: `https://www.google.com/search?q=site%3Aquora.com+${q}` },
    { label: 'YouTube', href: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'X', href: `https://x.com/search?q=${q}` },
  ]
  if (faith) links.splice(3, 0, { label: 'Christian Forums', href: `https://www.google.com/search?q=site%3Achristianforums.com+${q}` })
  return links
}

/**
 * The threads as one text block for Claude ("discussion_threads" of the insights
 * prompt): each thread numbered with its title and address, its text cut to
 * 7,000 characters, the whole cut to `maxChars`. Empty when there are no threads.
 */
export function discussionThreads(pages: readonly TopicPage[], maxChars = THREADS_CHARS): string {
  const body = discussionPages(pages)
    .map((d, i) => `--- Thread ${i + 1}: ${d.title} (${d.url || 'no url'})\n${clip(d.blocks.map(b => b[1]).join('\n'), THREAD_CHARS)}`)
    .join('\n\n')
  return clip(body, maxChars)
}

/** The ts_pages payload for a pasted thread (ts_save_page): a new id every time, as the Artifact makes one, blocks capped, links dropped. */
export function discussionPayload(url: string, cap: CleanCapture, now = Date.now()): Record<string, unknown> {
  const title = cap.title || 'Discussion'
  return {
    artifact_id: `d${hashId(url + cap.title + now)}`,
    kind: 'discussion',
    url,
    title,
    captured_at: new Date(now).toISOString(),
    data: { desc: cap.desc, blocks: cap.blocks.slice(0, MAX_DISCUSSION_BLOCKS), links: [], method: cap.method },
  }
}
