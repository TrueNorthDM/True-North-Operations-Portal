import { describe, expect, it } from 'vitest'
import { docPagesOf, pageLabels, previewPagesText, receiptShow, receiptsOnText, sheetPages } from './receipt-pages'

const one = { pages: 1 }

describe('a reimbursement document with its receipts as pages', () => {
  it('knows what a stored receipt can be in a PDF', () => {
    expect(receiptShow('p/12/IMG_4471.JPG')).toBe('image')
    expect(receiptShow('p/12/a.webp')).toBe('image')
    expect(receiptShow('p/12/figma.pdf')).toBe('pdf')
    expect(receiptShow('p/12/photo.heic')).toBe('none')
  })
  it('says it as the prototype does', () => {
    expect(previewPagesText(1, [one, one])).toBe('Preview, 3 pages (the document and its 2 receipts).')
    expect(previewPagesText(1, [one])).toBe('Preview, 2 pages (the document and its receipt).')
    expect(previewPagesText(1, [])).toBe('Preview, 1 page.')
    expect(receiptsOnText(1, [one, one])).toBe('Receipts on pages 2 and 3.')
    expect(receiptsOnText(1, [one])).toBe('Receipt on page 2.')
    expect(receiptsOnText(1, [])).toBeNull()
  })
  it('counts a PDF receipt by its own pages, after a document that runs over', () => {
    expect(receiptsOnText(1, [one, { pages: 3 }])).toBe('Receipts on pages 2 to 5.')
    expect(receiptsOnText(2, [{ pages: 2 }])).toBe('Receipt on pages 3 and 4.')
    expect(pageLabels(2, [one, { pages: 2 }])).toEqual({ doc: 'Page 2 of 5', receipts: ['Page 3 of 5', 'Page 4 of 5', 'Page 5 of 5'], on: 'Receipts on pages 3 to 5.' })
  })
  it('measures the sheet in A4 pages', () => {
    expect(docPagesOf(840)).toBe(1)
    expect(docPagesOf(877)).toBe(1)
    expect(docPagesOf(1100)).toBe(2)
  })
})

describe('a document whose rows run onto a second page', () => {
  it('moves a row the page edge would cut, and counts the gap it leaves', () => {
    const P = 100
    // Rows of 30 from 0: the one at 90 would be cut at 100, so it moves 10 down.
    const rows = [0, 30, 60, 90].map(top => ({ top, height: 30 }))
    expect(sheetPages(120, rows, P)).toEqual({ pages: 2, push: 10 })
    // Nothing cut, nothing moved.
    expect(sheetPages(90, rows.slice(0, 3), P)).toEqual({ pages: 1, push: 0 })
    // The move itself can make the page it needs: 195 plus 10 runs past 200.
    expect(sheetPages(195, rows, P).pages).toBe(3)
  })
})
