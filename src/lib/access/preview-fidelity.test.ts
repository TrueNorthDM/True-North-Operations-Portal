import { describe, it, expect } from 'vitest'

import { PREVIEW_CAVEATS } from './preview-fidelity'
import { SURFACE_KEYS } from './surfaces'

/**
 * The list is hand-kept, so the one thing worth pinning is that it cannot drift
 * away from the matrix it annotates. A caveat naming a surface that no longer
 * exists is worse than no caveat: it is a warning nobody can act on, sitting on
 * the screen an admin consults to decide what is safe.
 */
describe('preview caveats', () => {
  it('every caveat names a real surface', () => {
    for (const c of PREVIEW_CAVEATS) {
      expect(SURFACE_KEYS.has(c.surfaceKey), `unknown surface: ${c.surfaceKey}`).toBe(true)
    }
  })

  it('names each surface at most once', () => {
    const keys = PREVIEW_CAVEATS.map(c => c.surfaceKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  // The client report was the reason this file exists. It now decides access in
  // the access layer, so it must never come back to this list: if it does,
  // somebody has put a database rule back under a client-facing number.
  it('does not list the client report', () => {
    const keys = PREVIEW_CAVEATS.map(c => c.surfaceKey)
    expect(keys).not.toContain('report-full')
    expect(keys).not.toContain('tools')
  })
})
