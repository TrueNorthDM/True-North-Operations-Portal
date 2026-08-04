import { describe, it, expect } from 'vitest'

import { TOOLS, TOOL_KEYS, AUDIENCE_LABEL } from './tools'
import { surfaceForPath } from './nav'

// The catalogue is the single list behind two screens: the cards on Tools &
// Dashboards and the grant rows on the Directory's Teams tab. Its integrity is
// what keeps those two from drifting, which is exactly how "My Work" ended up
// grantable per team without ever being a card.

describe('tool catalogue', () => {
  it('has no duplicate keys', () => {
    const keys = TOOLS.map(t => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('keeps TOOL_KEYS in step with TOOLS', () => {
    // The write path validates against TOOL_KEYS and the resolver reads through
    // it, so a key present in one and not the other silently loses a grant.
    expect([...TOOL_KEYS].sort()).toEqual(TOOLS.map(t => t.key).sort())
  })

  it('gives every tool the fields both screens render', () => {
    for (const t of TOOLS) {
      expect(t.key, 'key').toBeTruthy()
      expect(t.label, `${t.key}.label`).toBeTruthy()
      expect(t.description, `${t.key}.description`).toBeTruthy()
      expect(t.href.startsWith('/'), `${t.key}.href`).toBe(true)
      expect(['Dashboards', 'Tools'], `${t.key}.group`).toContain(t.group)
    }
  })

  it('points every tool at a route the Tools area guards', () => {
    // A tool whose href fell outside the Tools surface would be granted per
    // team but gated by an unrelated rule.
    for (const t of TOOLS) {
      expect(surfaceForPath(t.href), `${t.key} -> ${t.href}`).toBe('tools')
    }
  })

  it('labels both grant audiences', () => {
    expect(AUDIENCE_LABEL.lead).toBeTruthy()
    expect(AUDIENCE_LABEL.all).toBeTruthy()
  })
})
