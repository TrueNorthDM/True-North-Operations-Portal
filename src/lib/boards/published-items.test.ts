/**
 * The stored facts must count exactly what the full snapshot counts.
 *
 * The point of storing a reduced copy is that Home stops reading 26 MB. The risk
 * is that the reduced copy quietly counts something different, and a goals card
 * that disagrees with the dashboard it links to is the failure already fixed once.
 * So the reduction is checked by running the dashboard's own counting function
 * over both and requiring the same answer.
 */

import { describe, it, expect } from 'vitest'
import { computePublishingMetrics, type PublishedItem } from './publishing'
import {
  compactFromItems, toPublishedItems, isCompactList, PUBLISHED_HORIZON_DAYS,
} from './published-items'
import type { TargetsMap } from './types'
import { publisherTest } from './publishing-rules'

const IS_PUB = publisherTest(['Samuel Manzi', 'Wendy Cacka'])

const AAAF = '462251934'
const NOW = new Date('2026-09-15T12:00:00Z')

const item = (over: Partial<PublishedItem> = {}): PublishedItem => ({
  id: '1', name: 'A page', boardId: AAAF, boardShort: 'AAAF-P',
  language: 'English', publishers: ['Samuel Manzi'],
  publishedDate: '2026-09-02T10:00:00Z', isPublished: true,
  currentStatusText: 'Done', logEventCount: 3, matchingEventCount: 1,
  isDoneWithoutEvent: false, group: 'Published', isInExcludedGroup: true, isStagedToPublish: false,
  ...over,
})

const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

describe('compactFromItems', () => {
  it('keeps only published items with a date', () => {
    const out = compactFromItems([
      item({ id: 'a' }),
      item({ id: 'b', isPublished: false }),
      item({ id: 'c', publishedDate: null }),
    ], NOW)
    expect(out.map(r => r.id)).toEqual(['a'])
  })

  it('drops what is older than the horizon and keeps what is inside it', () => {
    const out = compactFromItems([
      item({ id: 'old', publishedDate: daysAgo(PUBLISHED_HORIZON_DAYS + 1) }),
      item({ id: 'edge', publishedDate: daysAgo(PUBLISHED_HORIZON_DAYS - 1) }),
    ], NOW)
    expect(out.map(r => r.id)).toEqual(['edge'])
  })

  // The horizon has to outlast the widest window the card ever asks for: four
  // complete weeks, whose first Monday is at most 34 days back.
  it('reaches back further than the oldest day the card can show', () => {
    expect(PUBLISHED_HORIZON_DAYS).toBeGreaterThan(34)
  })

  // Whether a name counts is decided when the numbers are computed. Filtering
  // publishers here would freeze today's list into stored data.
  it('keeps publishers the counting rule does not recognise', () => {
    const out = compactFromItems([item({ publishers: ['Gad Rukundo'] })], NOW)
    expect(out[0].publishers).toEqual(['Gad Rukundo'])
  })

  it('skips a date it cannot read rather than treating it as recent', () => {
    expect(compactFromItems([item({ publishedDate: 'not a date' })], NOW)).toEqual([])
  })
})

describe('the stored facts count the same as the full items', () => {
  const targets: TargetsMap = { [AAAF]: { English: 2, Spanish: 3, Swahili: 3 } }
  const full: PublishedItem[] = [
    item({ id: '1', language: 'English', publishedDate: '2026-08-11T09:00:00Z' }),
    item({ id: '2', language: 'Spanish', publishedDate: '2026-08-12T09:00:00Z' }),
    item({ id: '3', language: 'Swahili', publishedDate: '2026-08-19T09:00:00Z', publishers: ['Wendy Cacka'] }),
    // Not a recognised publisher: must be excluded on both sides.
    item({ id: '4', language: 'English', publishedDate: '2026-08-20T09:00:00Z', publishers: ['Gad Rukundo'] }),
    // A language with no target: must be excluded on both sides.
    item({ id: '5', language: 'French', publishedDate: '2026-08-25T09:00:00Z' }),
    // Not published: dropped by the reduction, ignored by the count.
    item({ id: '6', isPublished: false, publishedDate: '2026-08-26T09:00:00Z' }),
    item({ id: '7', language: 'English', publishedDate: '2026-09-01T09:00:00Z' }),
  ]
  const reduced = toPublishedItems(AAAF, 'AAAF-P', compactFromItems(full, NOW))

  const weeks = [
    ['2026-08-10', '2026-08-16'], ['2026-08-17', '2026-08-23'],
    ['2026-08-24', '2026-08-30'], ['2026-08-31', '2026-09-06'],
  ]

  for (const [from, to] of weeks) {
    it(`week of ${from}`, () => {
      const start = new Date(`${from}T00:00:00Z`)
      const end = new Date(`${to}T23:59:59.999Z`)
      const a = computePublishingMetrics(full, targets, start, end, IS_PUB)
      const b = computePublishingMetrics(reduced, targets, start, end, IS_PUB)
      expect(b.boards).toEqual(a.boards)
    })
  }
})

describe('isCompactList', () => {
  it('accepts what compactFromItems writes', () => {
    expect(isCompactList(compactFromItems([item()], NOW))).toBe(true)
  })

  it('accepts an empty list, which is a real answer: nothing published lately', () => {
    expect(isCompactList([])).toBe(true)
  })

  // Null is how a board the ingest has not written since the column existed
  // arrives, and it must send the reader to the slow path, not to "zero".
  it('rejects null and anything that is not the stored shape', () => {
    expect(isCompactList(null)).toBe(false)
    expect(isCompactList({})).toBe(false)
    expect(isCompactList([{ id: 1 }])).toBe(false)
    expect(isCompactList([{ id: 'x', language: 'English', publishedDate: '2026-09-01' }])).toBe(false)
  })
})
