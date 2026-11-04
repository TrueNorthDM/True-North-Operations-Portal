import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render } from '@testing-library/react'

// The pictures are real screens: their routers and server actions never run here.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, back: () => {}, prefetch: () => {} }),
  usePathname: () => '/manual',
  useSearchParams: () => new URLSearchParams(),
}))

import { ManualContent } from './ManualContent'
import { PAGES } from '@/lib/manual/registry'

beforeAll(() => {
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
})

// The System manual as guides (owner, 4 November 2026): every page in the
// registry has content, draws without throwing, and keeps the house rules.
describe('System manual pages', () => {
  for (const p of PAGES) {
    it(`${p.tab}/${p.slug} draws its content`, () => {
      const { container } = render(<ManualContent slug={p.slug} superOnly={[]} />)
      expect(container.textContent?.length ?? 0).toBeGreaterThan(200)
      expect(container.textContent).not.toContain('—')
      expect(container.querySelector('select')).toBeNull()
    })
  }
})
