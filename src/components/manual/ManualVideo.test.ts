import { describe, expect, it } from 'vitest'
import { vimeoSrc } from './ManualVideo'
import { PAGES } from '@/lib/manual/registry'

describe('vimeoSrc', () => {
  it('plays a public video by its number', () => {
    expect(vimeoSrc('1247981310')).toBe('https://player.vimeo.com/video/1247981310?dnt=1&title=0&byline=0&portrait=0')
  })
  it('passes an unlisted video its code', () => {
    expect(vimeoSrc('1247981310/791d71cdbe')).toBe('https://player.vimeo.com/video/1247981310?h=791d71cdbe&dnt=1&title=0&byline=0&portrait=0')
  })
  it('refuses anything that is not a Vimeo number', () => {
    for (const bad of ['', 'abc', 'https://vimeo.com/1', '12/../x', '12?autoplay=1']) expect(vimeoSrc(bad)).toBeNull()
  })
  it('every video in the registry is a valid reference', () => {
    for (const p of PAGES) for (const v of p.videos ?? []) expect(vimeoSrc(v.vimeo), p.slug).not.toBeNull()
  })
})
