/**
 * The gates on what counts as a published item.
 *
 * These are the rules the Publishing Goals dashboard and the Home widget both
 * answer to, and they are easy to get wrong in the direction that flatters:
 * every one of them can only ever remove an item from the count, so forgetting
 * one makes the number too high and nothing looks broken.
 */

import { describe, it, expect } from 'vitest'
import { computePublishingMetrics, type PublishedItem } from './publishing'
import type { TargetsMap } from './types'
import { publisherTest } from './publishing-rules'

const IS_PUB = publisherTest(['Samuel Manzi', 'Wendy Cacka'])

const AAAF = '462251934'

const item = (over: Partial<PublishedItem> = {}): PublishedItem => ({
  id: '1',
  name: 'An article',
  boardId: AAAF,
  boardShort: 'AAAF-P',
  language: 'English',
  publishers: ['Samuel Manzi'],
  publishedDate: '2026-08-12',
  isPublished: true,
  currentStatusText: 'Done',
  logEventCount: 0,
  matchingEventCount: 0,
  isDoneWithoutEvent: false,
  group: null,
  isInExcludedGroup: false,
  isStagedToPublish: false,
  ...over,
})

// A week's worth of targets in two languages, so "English only" would show.
const TARGETS: TargetsMap = { [AAAF]: { English: 2, Spanish: 1 } }

const start = new Date('2026-08-10T00:00:00Z')
const end = new Date('2026-08-16T23:59:59.999Z')

const board = (items: PublishedItem[], targets: TargetsMap = TARGETS) =>
  computePublishingMetrics(items, targets, start, end, IS_PUB).boards.find(b => b.boardId === AAAF)

describe('computePublishingMetrics', () => {
  // The question that started this: it is every language, not English alone.
  it('counts every language that has a target', () => {
    const b = board([
      item({ id: '1', language: 'English' }),
      item({ id: '2', language: 'Spanish' }),
    ])
    expect(b?.done).toBe(2)
    // And the board's target is the sum of the per-language targets.
    expect(b?.target).toBe(3)
  })

  // A language nobody set a goal for has nothing to be measured against, so it
  // is left out of the total rather than counted towards someone else's target.
  it('ignores a language with no target', () => {
    const b = board([item({ language: 'French' })])
    expect(b?.done).toBe(0)
  })

  it('ignores work published by someone who is not a publisher', () => {
    const b = board([item({ publishers: ['Kevin Ames'] })])
    expect(b?.done).toBe(0)
  })

  it('matches a publisher regardless of case or padding', () => {
    const b = board([item({ publishers: ['  samuel manzi '] })])
    expect(b?.done).toBe(1)
  })

  it('counts an item with more than one publisher once', () => {
    const b = board([item({ publishers: ['Kevin Ames', 'Wendy Cacka'] })])
    expect(b?.done).toBe(1)
  })

  it('ignores an item that is not published, and one with no date', () => {
    const b = board([
      item({ id: '1', isPublished: false }),
      item({ id: '2', publishedDate: null }),
    ])
    expect(b?.done).toBe(0)
  })

  it('ignores items either side of the week', () => {
    const b = board([
      item({ id: '1', publishedDate: '2026-08-09' }),
      item({ id: '2', publishedDate: '2026-08-17' }),
      item({ id: '3', publishedDate: '2026-08-16' }),
    ])
    expect(b?.done).toBe(1)
  })

  // A board nobody has set targets for is absent, not zero. The widget leans on
  // this to say "no weekly target set" instead of drawing four failed weeks.
  it('leaves out a board with no targets at all', () => {
    expect(board([item()], {})).toBeUndefined()
  })

  it('over one week, a board target is its weekly target, not a multiple', () => {
    expect(board([])?.target).toBe(3)
  })
})

describe('pages in a language with no target (decided 10 October 2026)', () => {
  it('are counted beside the score, not in it', () => {
    const b = board([
      item({ id: 'a', language: 'English' }),
      item({ id: 'b', language: 'French' }),
      item({ id: 'c', language: '' }),
    ])
    expect(b?.done).toBe(1)
    expect(b?.untargeted).toBe(2)
  })

  it('count one page once when Monday returned it twice', () => {
    expect(board([item({ id: 'a', language: 'English' }), item({ id: 'a', language: 'English' })])?.done).toBe(1)
  })
})
