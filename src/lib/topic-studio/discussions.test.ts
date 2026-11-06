import { describe, expect, it } from 'vitest'
import { cleanCapture } from './capture-place'
import { discussionPages, discussionPayload, discussionSearchLinks, discussionsView, discussionThreads, MAX_DISCUSSION_BLOCKS } from './discussions'
import type { TopicPage } from './project'
import { PAGES } from './test-fixture'

const thread = (id: string | null, title: string, url: string, lines: string[]): TopicPage => ({
  artifactId: id, kind: 'discussion', url, title, desc: '', blocks: lines.map(t => ['p', t] as [string, string]), links: [], capturedAt: null, method: 'text',
})
const T1 = thread('d1', 'My firewood is still wet', 'https://www.reddit.com/r/firewood/comments/abc/my_firewood/', ['I split it last spring and it still hisses.', 'Is a moisture meter worth it?', 'Mine reads 28 percent.', 'Fourth line'])
const T2 = thread('d2', '', '', ['No address here, only words in this thread.'])
const ALL = [...PAGES, T1, T2]

describe('discussionsView', () => {
  it('lists only the discussion pages, with title, site, words and the first lines', () => {
    const v = discussionsView(ALL)
    expect(discussionPages(ALL)).toEqual([T1, T2])
    expect(v.total).toBe(2)
    expect(v.rows[0]).toMatchObject({ key: 'd1', title: 'My firewood is still wet', url: T1.url, domain: 'reddit.com' })
    expect(v.rows[0].words).toBe(9 + 6 + 4 + 2)
    expect(v.rows[0].lines).toEqual(['I split it last spring and it still hisses.', 'Is a moisture meter worth it?', 'Mine reads 28 percent.'])
    expect(v.rows[1]).toMatchObject({ title: 'Discussion', url: '', domain: '' })
    expect(v.words).toBe(v.rows[0].words + v.rows[1].words)
    expect(v.full).toBe(false)
  })
  it('is empty without discussions, and says when a topic is full', () => {
    expect(discussionsView(PAGES)).toEqual({ rows: [], total: 0, words: 0, full: false })
    expect(discussionsView(Array.from({ length: 40 }, (_, i) => thread(`d${i}`, 't', '', ['x']))).full).toBe(true)
  })
  it('cuts a long first line', () => {
    expect(discussionsView([thread('d', 't', '', ['w'.repeat(500)])]).rows[0].lines[0]).toHaveLength(161)
  })
})

describe('discussionSearchLinks', () => {
  it('searches the topic on each site, escaped, with Christian Forums only for a faith client', () => {
    const plain = discussionSearchLinks('dry firewood & wood', false)
    expect(plain.map(l => l.label)).toEqual(['Google forums', 'Reddit', 'Quora', 'YouTube', 'X'])
    expect(plain[1].href).toBe('https://www.reddit.com/search/?q=dry%20firewood%20%26%20wood')
    expect(discussionSearchLinks('x', true).map(l => l.label)).toEqual(['Google forums', 'Reddit', 'Quora', 'Christian Forums', 'YouTube', 'X'])
  })
})

describe('discussionThreads', () => {
  it('numbers each thread with its title and address and keeps its text', () => {
    const t = discussionThreads(ALL)
    expect(t).toBe([
      '--- Thread 1: My firewood is still wet (https://www.reddit.com/r/firewood/comments/abc/my_firewood/)',
      'I split it last spring and it still hisses.\nIs a moisture meter worth it?\nMine reads 28 percent.\nFourth line',
      '',
      '--- Thread 2:  (no url)',
      'No address here, only words in this thread.',
    ].join('\n'))
  })
  it('cuts each thread to 7,000 characters and the whole to the limit', () => {
    const big = thread('d', 'Big', 'https://a.test', ['x'.repeat(5000), 'y'.repeat(5000)])
    const t = discussionThreads([big])
    expect(t.length).toBe('--- Thread 1: Big (https://a.test)\n'.length + 7000 + 1)
    expect(t.endsWith('…')).toBe(true)
    expect(discussionThreads([big, big], 100)).toHaveLength(101)
  })
  it('is empty without discussions', () => {
    expect(discussionThreads(PAGES)).toBe('')
  })
})

describe('discussionPayload', () => {
  const cap = (() => { const c = cleanCapture({ url: 'https://forum.test/t/1', title: 'A thread', desc: 'd', blocks: Array.from({ length: 700 }, (_, i) => ['p', `line ${i}`]), links: [['https://x.test', 'x']] }, false); if (typeof c === 'string') throw new Error(c); return c })()
  it('makes a discussion page: a new id, blocks capped at 600, no links', () => {
    const p = discussionPayload(cap.url, cap, 1000)
    expect(p).toMatchObject({ kind: 'discussion', url: 'https://forum.test/t/1', title: 'A thread', captured_at: new Date(1000).toISOString() })
    expect(String(p.artifact_id)).toMatch(/^d[0-9a-z]+$/)
    const data = p.data as { blocks: unknown[]; links: unknown[]; desc: string; method: string }
    expect(data.blocks).toHaveLength(MAX_DISCUSSION_BLOCKS)
    expect(data.links).toEqual([])
    expect(data).toMatchObject({ desc: 'd', method: 'text' })
    expect(discussionPayload(cap.url, cap, 1001).artifact_id).not.toBe(p.artifact_id)
  })
  it('titles an untitled thread "Discussion" and accepts one without an address', () => {
    const p = discussionPayload('', { ...cap, url: '', title: '' }, 5)
    expect(p).toMatchObject({ title: 'Discussion', url: '' })
  })
})
